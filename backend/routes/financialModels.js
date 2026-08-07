// routes/financialModels.js
const express = require('express');
const { query } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { asyncHandler, HttpError } = require('../middleware/errorHandler');
const {
    createModel,
    getModels,
    getModel,
    createScenario,
    generateProjections,
    calculateDCF,
} = require('../services/financialModeling');

const router = express.Router();

// ============================================================
// POST /api/financial-models - Create a new model
// ============================================================
router.post('/', authenticate, asyncHandler(async (req, res) => {
    const { reportId, name, description, baseYear, projectionYears } = req.body;
    
    if (!reportId) {
        throw new HttpError(400, 'reportId is required');
    }
    
    const model = await createModel(reportId, req.user.id, {
        name,
        description,
        baseYear,
        projectionYears,
    });
    
    res.status(201).json({ model });
}));

// ============================================================
// GET /api/financial-models/:reportId - Get models for a report
// ============================================================
router.get('/:reportId', authenticate, asyncHandler(async (req, res) => {
    const { reportId } = req.params;
    
    const models = await getModels(reportId, req.user.id);
    
    res.json({ models });
}));

// ============================================================
// GET /api/financial-models/model/:modelId - Get full model
// ============================================================
router.get('/model/:modelId', authenticate, asyncHandler(async (req, res) => {
    const { modelId } = req.params;
    
    const model = await getModel(modelId, req.user.id);
    
    res.json({ model });
}));

// ============================================================
// POST /api/financial-models/:modelId/scenarios - Create scenario
// ============================================================
router.post('/:modelId/scenarios', authenticate, asyncHandler(async (req, res) => {
    const { modelId } = req.params;
    const data = req.body;
    
    const scenario = await createScenario(modelId, data);
    
    res.status(201).json({ scenario });
}));

// ============================================================
// POST /api/financial-models/scenarios/:scenarioId/regenerate - Regenerate projections
// ============================================================
router.post('/scenarios/:scenarioId/regenerate', authenticate, asyncHandler(async (req, res) => {
    const { scenarioId } = req.params;
    
    // Get model to know base year and projection years
    const scenarioResult = await query(
        `SELECT s.*, m.base_year, m.projection_years 
         FROM model_scenarios s
         JOIN financial_models m ON s.model_id = m.id
         WHERE s.id = $1`,
        [scenarioId]
    );
    
    if (scenarioResult.rows.length === 0) {
        throw new HttpError(404, 'Scenario not found');
    }
    
    const scenario = scenarioResult.rows[0];
    
    // Delete existing projections
    await query('DELETE FROM model_projections WHERE scenario_id = $1', [scenarioId]);
    
    // Generate new projections
    const projections = await generateProjections(
        scenarioId,
        scenario.base_year,
        scenario.projection_years
    );
    
    res.json({ projections });
}));

// ============================================================
// GET /api/financial-models/scenarios/:scenarioId/dcf - Calculate DCF
// ============================================================
router.get('/scenarios/:scenarioId/dcf', authenticate, asyncHandler(async (req, res) => {
    const { scenarioId } = req.params;
    
    const valuation = await calculateDCF(scenarioId);
    
    res.json({ valuation });
}));

module.exports = router;