// routes/cim.js
const express = require('express');
const path = require('path');
const fs = require('fs');
const { query } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { asyncHandler, HttpError } = require('../middleware/errorHandler');
const { generatePDF } = require('../services/pdf');

const router = express.Router();

// ============================================================
// POST /api/cim/generate - Generate CIM for a report
// ============================================================
router.post('/generate', authenticate, asyncHandler(async (req, res) => {
    const { reportId } = req.body;
    
    if (!reportId) {
        throw new HttpError(400, 'reportId is required');
    }
    
    // Get report
    const reportResult = await query(
        'SELECT * FROM reports WHERE id = $1 AND user_id = $2',
        [reportId, req.user.id]
    );
    
    if (reportResult.rows.length === 0) {
        throw new HttpError(404, 'Report not found');
    }
    
    const report = reportResult.rows[0];
    
    // Get transactions
    const txnsResult = await query(
        'SELECT * FROM transactions WHERE report_id = $1 ORDER BY txn_date NULLS LAST',
        [reportId]
    );
    
    // Get addbacks
    const addbacksResult = await query(
        'SELECT * FROM addback_schedule WHERE report_id = $1 ORDER BY amount DESC',
        [reportId]
    );
    
    // Get branding
    const brandingResult = await query(
        'SELECT * FROM broker_branding WHERE user_id = $1',
        [req.user.id]
    );
    const branding = brandingResult.rows[0] || null;
    
    // Calculate metrics
    const metrics = {
        totalRevenue: Number(report.total_revenue) || 0,
        totalExpenses: Number(report.total_expenses) || 0,
        netIncome: Number(report.net_income) || 0,
        ebitda: Number(report.ebitda) || 0,
        sde: Number(report.sde) || 0,
        totalAddbacks: Number(report.total_addbacks) || 0,
    };
    
    const outputDir = path.join(__dirname, '../reports/cims');
    fs.mkdirSync(outputDir, { recursive: true });
    const filename = `CIM-${report.business_name.replace(/\s+/g, '-')}-${Date.now()}.pdf`;
    const outputPath = path.join(outputDir, filename);
    
    // ✅ Use unified PDF generator
    await generatePDF({
        type: 'cim',
        report: report,
        data: {
            metrics,
            addbackSchedule: addbacksResult.rows,
            coverInfo: {
                subtitle: 'Confidential Information Memorandum',
            },
        },
        branding,
        outputPath,
    });
    
    res.json({
        success: true,
        filename: filename,
        downloadUrl: `/api/cim/download/${filename}`
    });
}));

// ============================================================
// GET /api/cim/download/:filename - Download CIM
// ============================================================
router.get('/download/:filename', authenticate, asyncHandler(async (req, res) => {
    const { filename } = req.params;
    
    const safeFilename = path.basename(filename);
    const filePath = path.join(__dirname, '../reports/cims', safeFilename);
    
    console.log('📄 Looking for CIM file:', filePath);
    
    if (!fs.existsSync(filePath)) {
        console.error('❌ CIM file not found:', filePath);
        throw new HttpError(404, 'File not found');
    }
    
    res.download(filePath, `CIM-${safeFilename}`, (err) => {
        if (err) {
            console.error('❌ Download error:', err);
            res.status(500).json({ error: 'Download failed' });
        }
    });
}));

module.exports = router;