// routes/reports.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const { query, getClient } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { asyncHandler, HttpError } = require('../middleware/errorHandler');
const { parseFinancialFile } = require('../services/fileParser');
const { 
    categorizeAndDetectAddbacks, 
    generateExecutiveSummary, 
    fallbackCategorization,
    isQuotaError 
} = require('../services/aiProcessor');
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

// ============================================================
// POST /api/reports/upload - Upload report
// ============================================================
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

  // Process report asynchronously
  processReport(report.id).catch((err) => {
    console.error(`Report ${report.id} processing failed:`, err);
    query('UPDATE reports SET status = $1, error_message = $2 WHERE id = $3',
      ['failed', err.message, report.id]).catch(console.error);
  });

  res.status(202).json({ report });
}));

// ============================================================
// Process Report - AI Categorization with Full Validation
// ============================================================
async function processReport(reportId) {
  try {
    await query("UPDATE reports SET status = 'parsing' WHERE id = $1", [reportId]);

    const reportRes = await query('SELECT * FROM reports WHERE id = $1', [reportId]);
    const report = reportRes.rows[0];
    if (!report) throw new Error('Report not found');

    // ✅ Parse and validate the financial file
    let rawTransactions;
    try {
      rawTransactions = parseFinancialFile(report.source_file_path);
    } catch (parseErr) {
      console.error('❌ File parsing/validation error:', parseErr.message);
      
      // Check if it's a validation error (contains "Invalid financial file")
      const errorMessage = parseErr.message.includes('Invalid financial file') 
        ? parseErr.message 
        : `File validation failed: ${parseErr.message}`;
      
      await query(
        `UPDATE reports SET 
          status = 'failed', 
          error_message = $1 
         WHERE id = $2`,
        [errorMessage, reportId]
      );
      return; // ✅ Stop processing
    }

    // ✅ Check transaction count
    if (rawTransactions.length > 2000) {
      const errorMessage = 'File has more than 2000 transactions. Please split into smaller periods (max 2000 transactions per report).';
      await query(
        `UPDATE reports SET 
          status = 'failed', 
          error_message = $1 
         WHERE id = $2`,
        [errorMessage, reportId]
      );
      return;
    }

    // ✅ Check minimum transactions
    if (rawTransactions.length < 3) {
      const errorMessage = 'File contains too few transactions (minimum 3 required). Please ensure this is a valid financial statement.';
      await query(
        `UPDATE reports SET 
          status = 'failed', 
          error_message = $1 
         WHERE id = $2`,
        [errorMessage, reportId]
      );
      return;
    }

    console.log(`📊 Processing ${rawTransactions.length} transactions for report ${reportId}`);

    await query("UPDATE reports SET status = 'categorizing' WHERE id = $1", [reportId]);

    // ============================================================
    // AI CATEGORIZATION
    // ============================================================
    let categorized;
    let executiveSummary;
    
    try {
      categorized = await categorizeAndDetectAddbacks(rawTransactions, {
        businessName: report.business_name,
        industry: report.industry,
      });
    } catch (aiErr) {
      // ✅ Check if it's a quota error - stop processing and show friendly message
      if (isQuotaError(aiErr) || aiErr.message === 'AI_QUOTA_EXHAUSTED') {
        console.error('❌ AI quota exhausted for report:', reportId);
        
        const errorMessage = 
          'AI token quota exhausted. Please enable billing in Google AI Studio (https://aistudio.google.com/) to continue processing reports.\n\n' +
          'If you need immediate processing, try:\n' +
          '1. Using a different Google Cloud project\n' +
          '2. Waiting for quota to reset (usually 24 hours)\n' +
          '3. Contacting support for increased limits';
        
        await query(
          `UPDATE reports SET 
            status = 'failed', 
            error_message = $1 
           WHERE id = $2`,
          [errorMessage, reportId]
        );
        
        return; // ✅ Stop processing - don't use fallback for quota errors
      }
      
      // ✅ Other AI errors - use fallback
      console.warn('⚠️ AI categorization failed, using fallback:', aiErr.message);
      categorized = fallbackCategorization(rawTransactions);
    }

    // ✅ Ensure we have categorized data
    if (!categorized || categorized.length === 0) {
      throw new Error('Categorization failed - no data available');
    }

    // ============================================================
    // COMPUTE METRICS
    // ============================================================
    const metrics = computeMetrics(categorized);
    const addbackSchedule = buildAddbackSchedule(categorized);
    
    // ============================================================
    // GENERATE EXECUTIVE SUMMARY
    // ============================================================
    try {
      executiveSummary = await generateExecutiveSummary(metrics, {
        businessName: report.business_name,
        industry: report.industry,
      });
    } catch (summaryErr) {
      // ✅ If quota error on summary, use fallback without retrying
      if (isQuotaError(summaryErr)) {
        console.warn('⚠️ AI quota exhausted for summary. Using fallback.');
        executiveSummary = generateFallbackSummary(metrics, report);
      } else {
        console.warn('⚠️ Failed to generate AI summary:', summaryErr.message);
        executiveSummary = generateFallbackSummary(metrics, report);
      }
    }

    // ============================================================
    // SAVE TO DATABASE
    // ============================================================
    const client = await getClient();
    try {
      await client.query('BEGIN');

      // Insert transactions
      for (const t of categorized) {
        await client.query(
          `INSERT INTO transactions (report_id, txn_date, description, amount, raw_category, category, is_addback, addback_reason, confidence)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [reportId, t.date || null, t.description, t.amount, t.rawCategory || null, t.category, t.isAddback, t.addbackReason, t.confidence]
        );
      }

      // Insert addback schedule
      for (const a of addbackSchedule) {
        await client.query(
          `INSERT INTO addback_schedule (report_id, label, category, amount, justification, transaction_count)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [reportId, a.label, a.category, a.amount, a.justification, a.count]
        );
      }

      // Update report with metrics
      await client.query(
        `UPDATE reports SET
          status = 'ready_for_review',
          total_revenue = $1, 
          total_expenses = $2, 
          net_income = $3,
          ebitda = $4, 
          sde = $5, 
          total_addbacks = $6, 
          ai_summary = $7,
          error_message = NULL
         WHERE id = $8`,
        [
          metrics.totalRevenue, 
          metrics.totalExpenses, 
          metrics.netIncome,
          metrics.ebitda, 
          metrics.sde, 
          metrics.totalAddbacks, 
          executiveSummary, 
          reportId
        ]
      );

      await client.query('COMMIT');
      console.log(`✅ Report ${reportId} processed successfully with ${categorized.length} transactions.`);
      
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    
  } catch (err) {
    console.error(`❌ Report ${reportId} processing failed:`, err);
    
    // ✅ Don't overwrite quota or validation error messages if they're already set
    const errorMessage = err.message || 'Processing failed';
    
    // Check if we already set a specific error message (quota, validation, etc.)
    const existingError = await query(
      'SELECT error_message FROM reports WHERE id = $1',
      [reportId]
    );
    
    // Only update if no specific error message was set
    if (!existingError.rows[0]?.error_message) {
      await query(
        'UPDATE reports SET status = $1, error_message = $2 WHERE id = $3',
        ['failed', errorMessage, reportId]
      );
    }
  }
}

// ============================================================
// Helper: Generate Fallback Summary (No AI required)
// ============================================================
function generateFallbackSummary(metrics, report) {
  const revenue = metrics.totalRevenue || 0;
  const ebitda = metrics.ebitda || 0;
  const sde = metrics.sde || 0;
  const addbacks = metrics.totalAddbacks || 0;

  const formatCurrency = (value) => {
    if (!value) return '₹0';
    return '₹' + Number(value).toLocaleString('en-IN', { maximumFractionDigits: 0 });
  };

  let summary = `${report.business_name || 'The business'} generated ${formatCurrency(revenue)} in revenue with EBITDA of ${formatCurrency(ebitda)} and Seller's Discretionary Earnings (SDE) of ${formatCurrency(sde)}.`;

  if (addbacks > 0) {
    summary += ` Add-backs totaling ${formatCurrency(addbacks)} were identified as personal, discretionary, or non-recurring expenses.`;
  } else {
    summary += ` No significant add-backs were identified in the financial records.`;
  }

  return summary;
}


// ============================================================
// Helper: Generate Fallback Summary (No AI required)
// ============================================================
function generateFallbackSummary(metrics, report) {
  const revenue = metrics.totalRevenue || 0;
  const ebitda = metrics.ebitda || 0;
  const sde = metrics.sde || 0;
  const addbacks = metrics.totalAddbacks || 0;

  const formatCurrency = (value) => {
    if (!value) return '₹0';
    return '₹' + Number(value).toLocaleString('en-IN', { maximumFractionDigits: 0 });
  };

  let summary = `${report.business_name || 'The business'} generated ${formatCurrency(revenue)} in revenue with EBITDA of ${formatCurrency(ebitda)} and Seller's Discretionary Earnings (SDE) of ${formatCurrency(sde)}.`;

  if (addbacks > 0) {
    summary += ` Add-backs totaling ${formatCurrency(addbacks)} were identified as personal, discretionary, or non-recurring expenses.`;
  } else {
    summary += ` No significant add-backs were identified in the financial records.`;
  }

  return summary;
}

// ============================================================
// GET /api/reports - List all reports
// ============================================================
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT id, business_name, industry, status, payment_status, total_revenue, ebitda, sde,
            created_at, updated_at
     FROM reports WHERE user_id = $1 ORDER BY created_at DESC`,
    [req.user.id]
  );
  res.json({ reports: result.rows });
}));

// ============================================================
// GET /api/reports/:id - Get specific report
// ============================================================
router.get('/:id', authenticate, asyncHandler(async (req, res) => {
  const report = await getOwnedReport(req.params.id, req.user.id);

  const [txns, addbacks] = await Promise.all([
    query('SELECT * FROM transactions WHERE report_id = $1 ORDER BY txn_date NULLS LAST', [report.id]),
    query('SELECT * FROM addback_schedule WHERE report_id = $1 ORDER BY amount DESC', [report.id]),
  ]);

  res.json({ report, transactions: txns.rows, addbackSchedule: addbacks.rows });
}));

// ============================================================
// PATCH /api/reports/:id/transactions/:txnId - Update transaction
// ============================================================
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

// ============================================================
// POST /api/reports/:id/generate-pdf - Generate PDF
// ============================================================
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

// ============================================================
// GET /api/reports/:id/download - Download PDF
// ============================================================
router.get('/:id/download', authenticate, asyncHandler(async (req, res) => {
  const report = await getOwnedReport(req.params.id, req.user.id);
  if (report.status !== 'completed' || !report.report_pdf_path) {
    throw new HttpError(400, 'Report PDF is not ready yet');
  }
  res.download(report.report_pdf_path, `QOE-Report-${report.business_name}.pdf`);
}));

// ============================================================
// Helper Functions
// ============================================================

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