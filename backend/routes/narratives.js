// routes/narratives.js
const express = require('express');
const { query } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { asyncHandler, HttpError } = require('../middleware/errorHandler');
const { generateNarrative, getNarratives } = require('../services/narrativeGenerator');

const router = express.Router();

// Test route to verify it's working
router.get('/test', authenticate, asyncHandler(async (req, res) => {
    res.json({ message: 'Narratives route is working!', userId: req.user.id });
}));

// POST /api/narratives/generate - Generate a narrative
router.post('/generate', authenticate, asyncHandler(async (req, res) => {
    const { reportId, section, tone } = req.body;
    
    console.log('📝 Generating narrative for:', { reportId, section, tone });
    
    if (!reportId) {
        throw new HttpError(400, 'reportId is required');
    }
    
    if (!section) {
        throw new HttpError(400, 'section is required');
    }
    
    // Verify report ownership
    const reportResult = await query(
        'SELECT id FROM reports WHERE id = $1 AND user_id = $2',
        [reportId, req.user.id]
    );
    
    if (reportResult.rows.length === 0) {
        throw new HttpError(404, 'Report not found');
    }
    
    const content = await generateNarrative(reportId, req.user.id, section, tone || 'professional');
    
    res.json({
        success: true,
        section,
        content,
        tone: tone || 'professional'
    });
}));

// GET /api/narratives/:reportId - Get all narratives for a report
router.get('/:reportId', authenticate, asyncHandler(async (req, res) => {
    const { reportId } = req.params;
    
    const narratives = await getNarratives(reportId, req.user.id);
    
    res.json({ narratives });
}));

// PUT /api/narratives/:narrativeId - Update a narrative
router.put('/:narrativeId', authenticate, asyncHandler(async (req, res) => {
    const { narrativeId } = req.params;
    const { content, isPublished } = req.body;
    
    const result = await query(
        `UPDATE generated_narratives 
         SET content = COALESCE($1, content),
             is_published = COALESCE($2, is_published),
             updated_at = now()
         WHERE id = $3 AND user_id = $4
         RETURNING *`,
        [content, isPublished, narrativeId, req.user.id]
    );
    
    if (result.rows.length === 0) {
        throw new HttpError(404, 'Narrative not found');
    }
    
    res.json({ narrative: result.rows[0] });
}));

module.exports = router;