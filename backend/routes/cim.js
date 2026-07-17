// routes/cim.js
const express = require('express');
const path = require('path');
const fs = require('fs');
const { query } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { asyncHandler, HttpError } = require('../middleware/errorHandler');
const { generateCIM } = require('../services/cimGenerator');

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
    
    // Generate CIM
    const outputPath = await generateCIM({
        report,
        transactions: txnsResult.rows,
        addbacks: addbacksResult.rows,
        metrics,
        branding,
        user: req.user
    });
    
    // ✅ Get just the filename from the path
    const filename = path.basename(outputPath);
    
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
    
    // ✅ Security: Prevent path traversal
    const safeFilename = path.basename(filename);
    const filePath = path.join(__dirname, '../reports/cims', safeFilename);
    
    console.log('📄 Looking for file:', filePath);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
        console.error('❌ File not found:', filePath);
        throw new HttpError(404, 'File not found');
    }
    
    // ✅ Send file for download
    res.download(filePath, `CIM-${filename}`, (err) => {
        if (err) {
            console.error('❌ Download error:', err);
            res.status(500).json({ error: 'Download failed' });
        }
    });
}));

module.exports = router;