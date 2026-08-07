// routes/benchmarks.js
const express = require('express');
const { query } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { asyncHandler, HttpError } = require('../middleware/errorHandler');
const { getBenchmarks, compareReport } = require('../services/benchmarkService');

const router = express.Router();

// ============================================================
// GET /api/benchmarks - Get all benchmarks
// ============================================================
router.get('/', authenticate, asyncHandler(async (req, res) => {
    const { industry } = req.query;
    const benchmarks = await getBenchmarks(industry);
    res.json({ benchmarks });
}));

// ============================================================
// GET /api/benchmarks/compare/:reportId - Compare report
// ============================================================
router.get('/compare/:reportId', authenticate, asyncHandler(async (req, res) => {
    const { reportId } = req.params;
    
    const result = await compareReport(reportId, req.user.id);
    res.json(result);
}));

// ============================================================
// GET /api/benchmarks/industries - Get all industries
// ============================================================
router.get('/industries', authenticate, asyncHandler(async (req, res) => {
    const result = await query(
        'SELECT DISTINCT industry FROM industry_benchmarks ORDER BY industry'
    );
    res.json({ industries: result.rows.map(r => r.industry) });
}));

module.exports = router;