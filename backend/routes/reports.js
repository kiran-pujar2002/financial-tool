const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const { query, getClient } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { asyncHandler, HttpError } = require('../middleware/errorHandler');
const { parseFinancialFile } = require('../services/fileParser');
const { categorizeAndDetectAddbacks, generateExecutiveSummary } = require('../services/aiProcessor');
const { computeMetrics, buildAddbackSchedule } = require('../utils/calculations');
const { generateReportPdf } = require('../services/pdfGenerator');

const router = express.Router();

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
const REPORTS_DIR = process.env.REPORTS_DIR || './reports';
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(REPORTS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
});
const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.csv', '.xlsx', '.xls', '.pdf'];
    if (allowed.includes(path.extname(file.originalname).toLowerCase())) cb(null, true);
    else cb(new HttpError(400, 'Only CSV, Excel, or PDF files are supported'));
  },
});

router.post('/upload', authenticate, upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) throw new HttpError(400, 'No file uploaded');

  const { businessName, industry, periodStart, periodEnd } = req.body;
  if (!businessName) throw new HttpError(400, 'businessName is required');

  const result = await query(
    `INSERT INTO reports (user_id, business_name, industry, period_start, period_end, source_filename, source_file_path, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'uploaded')
     RETURNING *`,
    [req.user.id, businessName, industry || null, periodStart || null, periodEnd || null, req.file.originalname, req.file.path]
  );

  const report = result.rows[0];

  processReport(report.id).catch((err) => {
    console.error(`Report ${report.id} processing failed:`, err);
    query('UPDATE reports SET status = $1, error_message = $2 WHERE id = $3',
      ['failed', err.message, report.id]).catch(console.error);
  });

  res.status(202).json({ report });
}));

async function processReport(reportId) {
  await query("UPDATE reports SET status = 'parsing' WHERE id = $1", [reportId]);

  const reportRes = await query('SELECT * FROM reports WHERE id = $1', [reportId]);
  const report = reportRes.rows[0];
  if (!report) throw new Error('Report not found');

  const rawTransactions = parseFinancialFile(report.source_file_path);
  if (rawTransactions.length > 2000) {
    throw new Error('File has more than 2000 transactions; please split into smaller periods');
  }

  await query("UPDATE reports SET status = 'categorizing' WHERE id = $1", [reportId]);

  const categorized = await categorizeAndDetectAddbacks(rawTransactions, {
    businessName: report.business_name,
    industry: report.industry,
  });

  const metrics = computeMetrics(categorized);
  const addbackSchedule = buildAddbackSchedule(categorized);
  const executiveSummary = await generateExecutiveSummary(metrics, {
    businessName: report.business_name,
    industry: report.industry,
  });

  const client = await getClient();
  try {
    await client.query('BEGIN');

    for (const t of categorized) {
      await client.query(
        `INSERT INTO transactions (report_id, txn_date, description, amount, raw_category, category, is_addback, addback_reason, confidence)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [reportId, t.date || null, t.description, t.amount, t.rawCategory || null, t.category, t.isAddback, t.addbackReason, t.confidence]
      );
    }

    for (const a of addbackSchedule) {
      await client.query(
        `INSERT INTO addback_schedule (report_id, label, category, amount, justification, transaction_count)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [reportId, a.label, a.category, a.amount, a.justification, a.count]
      );
    }

    await client.query(
      `UPDATE reports SET
        status = 'ready_for_review',
        total_revenue = $1, total_expenses = $2, net_income = $3,
        ebitda = $4, sde = $5, total_addbacks = $6, ai_summary = $7
       WHERE id = $8`,
      [metrics.totalRevenue, metrics.totalExpenses, metrics.netIncome,
       metrics.ebitda, metrics.sde, metrics.totalAddbacks, executiveSummary, reportId]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

router.get('/', authenticate, asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT id, business_name, industry, status, payment_status, total_revenue, ebitda, sde,
            created_at, updated_at
     FROM reports WHERE user_id = $1 ORDER BY created_at DESC`,
    [req.user.id]
  );
  res.json({ reports: result.rows });
}));

router.get('/:id', authenticate, asyncHandler(async (req, res) => {
  const report = await getOwnedReport(req.params.id, req.user.id);

  const [txns, addbacks] = await Promise.all([
    query('SELECT * FROM transactions WHERE report_id = $1 ORDER BY txn_date NULLS LAST', [report.id]),
    query('SELECT * FROM addback_schedule WHERE report_id = $1 ORDER BY amount DESC', [report.id]),
  ]);

  res.json({ report, transactions: txns.rows, addbackSchedule: addbacks.rows });
}));

router.patch('/:id/transactions/:txnId', authenticate, asyncHandler(async (req, res) => {
  const report = await getOwnedReport(req.params.id, req.user.id);
  if (report.status === 'completed') {
    throw new HttpError(400, 'Cannot edit transactions on a completed report');
  }

  const { category, isAddback, addbackReason } = req.body;
  const result = await query(
    `UPDATE transactions SET
       category = COALESCE($1, category),
       is_addback = COALESCE($2, is_addback),
       addback_reason = $3
     WHERE id = $4 AND report_id = $5
     RETURNING *`,
    [category || null, typeof isAddback === 'boolean' ? isAddback : null, addbackReason || null, req.params.txnId, report.id]
  );
  if (result.rows.length === 0) throw new HttpError(404, 'Transaction not found');

  const allTxns = await query('SELECT * FROM transactions WHERE report_id = $1', [report.id]);
  const metrics = computeMetrics(allTxns.rows.map(mapDbTxn));
  await query(
    `UPDATE reports SET total_revenue=$1, total_expenses=$2, net_income=$3, ebitda=$4, sde=$5, total_addbacks=$6 WHERE id=$7`,
    [metrics.totalRevenue, metrics.totalExpenses, metrics.netIncome, metrics.ebitda, metrics.sde, metrics.totalAddbacks, report.id]
  );

  res.json({ transaction: result.rows[0], metrics });
}));

router.post('/:id/generate-pdf', authenticate, asyncHandler(async (req, res) => {
  const report = await getOwnedReport(req.params.id, req.user.id);

  const isEnterprise = await hasActiveEnterprisePlan(req.user.id);
  if (report.payment_status !== 'paid' && !isEnterprise) {
    throw new HttpError(402, 'Payment required before generating the final report');
  }
  if (!['ready_for_review', 'paid', 'completed'].includes(report.status)) {
    throw new HttpError(400, `Report is not ready (status: ${report.status})`);
  }

  await query("UPDATE reports SET status = 'generating_pdf' WHERE id = $1", [report.id]);

  const [txns, addbacks] = await Promise.all([
    query('SELECT * FROM transactions WHERE report_id = $1 ORDER BY txn_date NULLS LAST', [report.id]),
    query('SELECT * FROM addback_schedule WHERE report_id = $1 ORDER BY amount DESC', [report.id]),
  ]);

  const metrics = {
    totalRevenue: Number(report.total_revenue),
    totalExpenses: Number(report.total_expenses),
    netIncome: Number(report.net_income),
    ebitda: Number(report.ebitda),
    sde: Number(report.sde),
    totalAddbacks: Number(report.total_addbacks),
    categoryBreakdown: buildCategoryBreakdown(txns.rows),
  };

  const outputPath = path.join(REPORTS_DIR, `${report.id}.pdf`);
  await generateReportPdf({
    report,
    transactions: txns.rows.map(mapDbTxn),
    addbackSchedule: addbacks.rows,
    metrics,
    executiveSummary: report.ai_summary,
    outputPath,
  });

  await query(
    "UPDATE reports SET status = 'completed', report_pdf_path = $1 WHERE id = $2",
    [outputPath, report.id]
  );

  res.json({ message: 'Report generated', downloadUrl: `/api/reports/${report.id}/download` });
}));

router.get('/:id/download', authenticate, asyncHandler(async (req, res) => {
  const report = await getOwnedReport(req.params.id, req.user.id);
  if (report.status !== 'completed' || !report.report_pdf_path) {
    throw new HttpError(400, 'Report PDF is not ready yet');
  }
  res.download(report.report_pdf_path, `QOE-Report-${report.business_name}.pdf`);
}));

async function getOwnedReport(reportId, userId) {
  const result = await query('SELECT * FROM reports WHERE id = $1 AND user_id = $2', [reportId, userId]);
  if (result.rows.length === 0) throw new HttpError(404, 'Report not found');
  return result.rows[0];
}

async function hasActiveEnterprisePlan(userId) {
  const result = await query(
    "SELECT plan, plan_expires_at FROM users WHERE id = $1 AND plan = 'enterprise' AND (plan_expires_at IS NULL OR plan_expires_at > now())",
    [userId]
  );
  return result.rows.length > 0;
}

function mapDbTxn(row) {
  return {
    date: row.txn_date,
    description: row.description,
    amount: Number(row.amount),
    category: row.category,
    isAddback: row.is_addback,
    addbackReason: row.addback_reason,
  };
}

function buildCategoryBreakdown(txnRows) {
  const sums = {};
  for (const t of txnRows) {
    sums[t.category] = (sums[t.category] || 0) + Number(t.amount);
  }
  return sums;
}

module.exports = router;