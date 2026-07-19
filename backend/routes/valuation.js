// routes/valuation.js
const express = require('express');
const path = require('path');
const fs = require('fs');
const { query } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { asyncHandler, HttpError } = require('../middleware/errorHandler');
const { generatePDF } = require('../services/pdf');

const router = express.Router();

// ============================================================
// GET /api/valuation/multiples - Get all industry multiples
// ============================================================
router.get('/multiples', authenticate, asyncHandler(async (req, res) => {
    const result = await query(
        'SELECT * FROM industry_multiples ORDER BY industry'
    );
    res.json({ multiples: result.rows });
}));

// ============================================================
// GET /api/valuation/multiples/:industry - Get multiples for industry
// ============================================================
router.get('/multiples/:industry', authenticate, asyncHandler(async (req, res) => {
    const { industry } = req.params;
    const result = await query(
        'SELECT * FROM industry_multiples WHERE industry ILIKE $1',
        [`%${industry}%`]
    );
    
    if (result.rows.length === 0) {
        return res.json({
            multiples: [{
                industry: industry,
                sde_multiple_min: 2.0,
                sde_multiple_mid: 3.0,
                sde_multiple_max: 4.5,
                ebitda_multiple_min: 2.5,
                ebitda_multiple_mid: 4.0,
                ebitda_multiple_max: 6.0,
                revenue_multiple_min: 0.5,
                revenue_multiple_mid: 1.0,
                revenue_multiple_max: 2.0
            }]
        });
    }
    
    res.json({ multiples: result.rows });
}));

// ============================================================
// POST /api/valuation/calculate - Calculate valuation
// ============================================================
router.post('/calculate', authenticate, asyncHandler(async (req, res) => {
    const { reportId, method, multiple, riskFactors = [] } = req.body;
    
    if (!reportId) {
        throw new HttpError(400, 'reportId is required');
    }
    
    const reportResult = await query(
        'SELECT * FROM reports WHERE id = $1 AND user_id = $2',
        [reportId, req.user.id]
    );
    
    if (reportResult.rows.length === 0) {
        throw new HttpError(404, 'Report not found');
    }
    
    const report = reportResult.rows[0];
    
    let industryMultiples = null;
    if (report.industry) {
        const multiplesResult = await query(
            'SELECT * FROM industry_multiples WHERE industry ILIKE $1',
            [`%${report.industry}%`]
        );
        if (multiplesResult.rows.length > 0) {
            industryMultiples = multiplesResult.rows[0];
        }
    }
    
    let valuation = calculateValuation(report, method, multiple, industryMultiples, riskFactors);
    
    const result = await query(
        `INSERT INTO valuations (
            report_id, user_id, method, 
            value_min, value_mid, value_max, selected_value,
            multiple_used, adjustments, risk_factors
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *`,
        [reportId, req.user.id, method,
         valuation.min, valuation.mid, valuation.max, valuation.selected,
         valuation.multipleUsed, valuation.adjustments, riskFactors]
    );
    
    res.json({
        valuation: result.rows[0],
        summary: {
            min: valuation.min,
            mid: valuation.mid,
            max: valuation.max,
            selected: valuation.selected,
            method: method,
            multipleUsed: valuation.multipleUsed,
            adjustments: valuation.adjustments
        }
    });
}));

// ============================================================
// GET /api/valuation/history/:reportId - Get valuation history
// ============================================================
router.get('/history/:reportId', authenticate, asyncHandler(async (req, res) => {
    const { reportId } = req.params;
    
    const result = await query(
        `SELECT * FROM valuations 
         WHERE report_id = $1 AND user_id = $2 
         ORDER BY created_at DESC`,
        [reportId, req.user.id]
    );
    
    res.json({ history: result.rows });
}));

// ============================================================
// POST /api/valuation/generate-report - Generate Valuation Report PDF
// ============================================================
router.post('/generate-report', authenticate, asyncHandler(async (req, res) => {
    const { reportId, valuationId } = req.body;
    
    if (!reportId) {
        throw new HttpError(400, 'reportId is required');
    }
    
    const reportResult = await query(
        'SELECT * FROM reports WHERE id = $1 AND user_id = $2',
        [reportId, req.user.id]
    );
    
    if (reportResult.rows.length === 0) {
        throw new HttpError(404, 'Report not found');
    }
    
    const report = reportResult.rows[0];
    
    let valuation;
    if (valuationId) {
        const valuationResult = await query(
            'SELECT * FROM valuations WHERE id = $1 AND report_id = $2 AND user_id = $3',
            [valuationId, reportId, req.user.id]
        );
        if (valuationResult.rows.length === 0) {
            throw new HttpError(404, 'Valuation not found');
        }
        valuation = valuationResult.rows[0];
    } else {
        const valuationResult = await query(
            'SELECT * FROM valuations WHERE report_id = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT 1',
            [reportId, req.user.id]
        );
        if (valuationResult.rows.length === 0) {
            throw new HttpError(404, 'No valuation found for this report');
        }
        valuation = valuationResult.rows[0];
    }
    
    const brandingResult = await query(
        'SELECT * FROM broker_branding WHERE user_id = $1',
        [req.user.id]
    );
    const branding = brandingResult.rows[0] || null;
    
    const outputDir = path.join(__dirname, '../reports/valuations');
    fs.mkdirSync(outputDir, { recursive: true });
    const filename = `valuation-${report.id}-${Date.now()}.pdf`;
    const outputPath = path.join(outputDir, filename);
    
    // ✅ Use unified PDF generator
    await generatePDF({
        type: 'valuation',
        report: report,
        data: {
            valuation: valuation,
            metrics: {
                totalRevenue: Number(report.total_revenue) || 0,
                ebitda: Number(report.ebitda) || 0,
                sde: Number(report.sde) || 0,
            },
            coverInfo: {
                subtitle: 'Broker\'s Opinion of Value',
            },
        },
        branding,
        outputPath,
    });
    
    res.json({ 
        success: true, 
        downloadUrl: `/api/valuation/download/${filename}`
    });
}));

// ============================================================
// GET /api/valuation/download/:filename - Download Valuation Report
// ============================================================
router.get('/download/:filename', authenticate, asyncHandler(async (req, res) => {
    const { filename } = req.params;
    
    const safeFilename = path.basename(filename);
    const filePath = path.join(__dirname, '../reports/valuations', safeFilename);
    
    if (!fs.existsSync(filePath)) {
        throw new HttpError(404, 'File not found');
    }
    
    res.download(filePath, `Valuation-Report-${safeFilename}`, (err) => {
        if (err) {
            console.error('❌ Download error:', err);
            res.status(500).json({ error: 'Download failed' });
        }
    });
}));

// ============================================================
// HELPER: Calculate Valuation
// ============================================================
function calculateValuation(report, method, multiple, industryMultiples, riskFactors) {
    let baseValue = 0;
    let multipleUsed = multiple || 3.0;
    let adjustments = {};
    
    const sde = Number(report.sde) || 0;
    const ebitda = Number(report.ebitda) || 0;
    const revenue = Number(report.total_revenue) || 0;
    
    if (industryMultiples) {
        switch(method) {
            case 'sde':
                multipleUsed = industryMultiples.sde_multiple_mid || 3.0;
                break;
            case 'ebitda':
                multipleUsed = industryMultiples.ebitda_multiple_mid || 4.0;
                break;
            case 'revenue':
                multipleUsed = industryMultiples.revenue_multiple_mid || 1.0;
                break;
        }
    }
    
    switch(method) {
        case 'sde':
            baseValue = sde * multipleUsed;
            break;
        case 'ebitda':
            baseValue = ebitda * multipleUsed;
            break;
        case 'revenue':
            baseValue = revenue * multipleUsed;
            break;
        default:
            baseValue = sde * 3.0;
    }
    
    let adjustmentFactor = 1.0;
    const riskAdjustments = [];
    
    for (const risk of riskFactors) {
        const factor = risk.factor || 0;
        adjustmentFactor -= factor;
        riskAdjustments.push({
            name: risk.name,
            factor: factor,
            description: risk.description
        });
    }
    
    const adjustedValue = baseValue * adjustmentFactor;
    const range = 0.2;
    const min = adjustedValue * (1 - range);
    const max = adjustedValue * (1 + range);
    
    return {
        min: Math.round(min * 100) / 100,
        mid: Math.round(adjustedValue * 100) / 100,
        max: Math.round(max * 100) / 100,
        selected: Math.round(adjustedValue * 100) / 100,
        multipleUsed: multipleUsed,
        adjustments: {
            baseValue: Math.round(baseValue * 100) / 100,
            adjustmentFactor: adjustmentFactor,
            adjustments: riskAdjustments
        }
    };
}

module.exports = router;