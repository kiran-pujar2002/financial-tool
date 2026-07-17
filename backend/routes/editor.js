// backend/routes/editor.js
const express = require('express');
const { query, getClient } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { asyncHandler, HttpError } = require('../middleware/errorHandler');
const { computeMetrics, buildAddbackSchedule } = require('../utils/calculations');

const router = express.Router();

// ============================================================
// GET /api/editor/:reportId/draft - Get current draft
// ============================================================
router.get('/:reportId/draft', authenticate, asyncHandler(async (req, res) => {
    const { reportId } = req.params;
    
    // Verify report ownership
    const reportResult = await query(
        'SELECT * FROM reports WHERE id = $1 AND user_id = $2',
        [reportId, req.user.id]
    );
    if (reportResult.rows.length === 0) {
        throw new HttpError(404, 'Report not found');
    }
    
    const report = reportResult.rows[0];
    
    // Get latest draft
    const draftResult = await query(
        `SELECT draft_data, version, saved_at 
         FROM editor_drafts 
         WHERE report_id = $1 
         ORDER BY version DESC 
         LIMIT 1`,
        [reportId]
    );
    
    // Get current transactions
    const txnsResult = await query(
        'SELECT * FROM transactions WHERE report_id = $1 ORDER BY txn_date NULLS LAST',
        [reportId]
    );
    
    // Get addback schedule
    const addbacksResult = await query(
        'SELECT * FROM addback_schedule WHERE report_id = $1 ORDER BY amount DESC',
        [reportId]
    );
    
    // Get custom categories for this user
    const categoriesResult = await query(
        'SELECT * FROM custom_categories WHERE user_id = $1 AND is_active = true ORDER BY name',
        [req.user.id]
    );
    
    const draft = draftResult.rows[0] || null;
    
    res.json({
        report,
        transactions: txnsResult.rows,
        addbackSchedule: addbacksResult.rows,
        customCategories: categoriesResult.rows,
        draft: draft ? {
            data: draft.draft_data,
            version: draft.version,
            savedAt: draft.saved_at
        } : null,
        isDraftAvailable: !!draft
    });
}));

// ============================================================
// PUT /api/editor/:reportId/draft - Save draft
// ============================================================
router.put('/:reportId/draft', authenticate, asyncHandler(async (req, res) => {
    const { reportId } = req.params;
    const { draftData, comment } = req.body;
    
    if (!draftData) {
        throw new HttpError(400, 'draftData is required');
    }
    
    // Verify report ownership and status
    const reportResult = await query(
        'SELECT * FROM reports WHERE id = $1 AND user_id = $2',
        [reportId, req.user.id]
    );
    if (reportResult.rows.length === 0) {
        throw new HttpError(404, 'Report not found');
    }
    
    const report = reportResult.rows[0];
    if (report.status === 'completed') {
        throw new HttpError(400, 'Cannot edit a completed report');
    }
    
    const client = await getClient();
    try {
        await client.query('BEGIN');
        
        // Get current max version
        const versionResult = await client.query(
            'SELECT COALESCE(MAX(version), 0) as max_version FROM editor_drafts WHERE report_id = $1',
            [reportId]
        );
        const newVersion = versionResult.rows[0].max_version + 1;
        
        // Save draft
        await client.query(
            `INSERT INTO editor_drafts (report_id, draft_data, version, saved_by)
             VALUES ($1, $2, $3, $4)`,
            [reportId, draftData, newVersion, req.user.id]
        );
        
        // Create version history entry (every 5 versions or on significant changes)
        if (newVersion % 5 === 0 || comment) {
            await client.query(
                `INSERT INTO report_versions (report_id, version_data, version_number, created_by, comment)
                 VALUES ($1, $2, $3, $4, $5)`,
                [reportId, draftData, newVersion, req.user.id, comment || `Auto-save v${newVersion}`]
            );
        }
        
        await client.query('COMMIT');
        
        res.json({
            success: true,
            version: newVersion,
            savedAt: new Date().toISOString()
        });
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}));

// ============================================================
// POST /api/editor/:reportId/transactions/bulk - Bulk update transactions
// ============================================================
router.post('/:reportId/transactions/bulk', authenticate, asyncHandler(async (req, res) => {
    const { reportId } = req.params;
    const { updates } = req.body;
    
    if (!updates || !Array.isArray(updates) || updates.length === 0) {
        throw new HttpError(400, 'updates array is required');
    }
    
    // Verify report ownership
    const reportResult = await query(
        'SELECT * FROM reports WHERE id = $1 AND user_id = $2',
        [reportId, req.user.id]
    );
    if (reportResult.rows.length === 0) {
        throw new HttpError(404, 'Report not found');
    }
    
    const report = reportResult.rows[0];
    if (report.status === 'completed') {
        throw new HttpError(400, 'Cannot edit a completed report');
    }
    
    const client = await getClient();
    try {
        await client.query('BEGIN');
        
        const updatedTransactions = [];
        for (const update of updates) {
            const { id, category, isAddback, addbackReason, editorNotes } = update;
            
            const result = await client.query(
                `UPDATE transactions 
                 SET category = COALESCE($1, category),
                     is_addback = COALESCE($2, is_addback),
                     addback_reason = $3,
                     editor_notes = $4,
                     is_manually_edited = true,
                     last_edited_at = now(),
                     last_edited_by = $5
                 WHERE id = $6 AND report_id = $7
                 RETURNING *`,
                [category, isAddback, addbackReason, editorNotes, req.user.id, id, reportId]
            );
            
            if (result.rows.length > 0) {
                updatedTransactions.push(result.rows[0]);
            }
        }
        
        // Recalculate metrics
        const allTxns = await client.query(
            'SELECT * FROM transactions WHERE report_id = $1',
            [reportId]
        );
        
        const metrics = computeMetrics(allTxns.rows);
        const addbackSchedule = buildAddbackSchedule(allTxns.rows);
        
        // Update report metrics
        await client.query(
            `UPDATE reports SET 
                total_revenue = $1,
                total_expenses = $2,
                net_income = $3,
                ebitda = $4,
                sde = $5,
                total_addbacks = $6
             WHERE id = $7`,
            [metrics.totalRevenue, metrics.totalExpenses, metrics.netIncome,
             metrics.ebitda, metrics.sde, metrics.totalAddbacks, reportId]
        );
        
        // Update addback schedule
        await client.query('DELETE FROM addback_schedule WHERE report_id = $1', [reportId]);
        for (const a of addbackSchedule) {
            await client.query(
                `INSERT INTO addback_schedule (report_id, label, category, amount, justification, transaction_count)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [reportId, a.label, a.category, a.amount, a.justification, a.count]
            );
        }
        
        await client.query('COMMIT');
        
        res.json({
            success: true,
            updatedTransactions,
            metrics,
            addbackSchedule
        });
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}));

// ============================================================
// POST /api/editor/:reportId/finalize - Finalize report
// ============================================================
router.post('/:reportId/finalize', authenticate, asyncHandler(async (req, res) => {
    const { reportId } = req.params;
    const { finalizedData } = req.body;
    
    // Verify report ownership
    const reportResult = await query(
        'SELECT * FROM reports WHERE id = $1 AND user_id = $2',
        [reportId, req.user.id]
    );
    if (reportResult.rows.length === 0) {
        throw new HttpError(404, 'Report not found');
    }
    
    const report = reportResult.rows[0];
    if (report.status === 'completed') {
        throw new HttpError(400, 'Report is already completed');
    }
    
    // Update status to ready_for_review if it was in progress
    await query(
        "UPDATE reports SET status = 'ready_for_review' WHERE id = $1",
        [reportId]
    );
    
    res.json({
        success: true,
        message: 'Report finalized and ready for payment',
        status: 'ready_for_review'
    });
}));

// ============================================================
// GET /api/editor/:reportId/versions - Get version history
// ============================================================
router.get('/:reportId/versions', authenticate, asyncHandler(async (req, res) => {
    const { reportId } = req.params;
    
    // Verify report ownership
    const reportResult = await query(
        'SELECT * FROM reports WHERE id = $1 AND user_id = $2',
        [reportId, req.user.id]
    );
    if (reportResult.rows.length === 0) {
        throw new HttpError(404, 'Report not found');
    }
    
    const versions = await query(
        `SELECT id, version_number, created_at, created_by, comment
         FROM report_versions
         WHERE report_id = $1
         ORDER BY version_number DESC
         LIMIT 50`,
        [reportId]
    );
    
    res.json({ versions: versions.rows });
}));

// ============================================================
// GET /api/editor/:reportId/versions/:versionId - Get specific version
// ============================================================
router.get('/:reportId/versions/:versionId', authenticate, asyncHandler(async (req, res) => {
    const { reportId, versionId } = req.params;
    
    // Verify report ownership
    const reportResult = await query(
        'SELECT * FROM reports WHERE id = $1 AND user_id = $2',
        [reportId, req.user.id]
    );
    if (reportResult.rows.length === 0) {
        throw new HttpError(404, 'Report not found');
    }
    
    const version = await query(
        `SELECT * FROM report_versions
         WHERE id = $1 AND report_id = $2`,
        [versionId, reportId]
    );
    
    if (version.rows.length === 0) {
        throw new HttpError(404, 'Version not found');
    }
    
    res.json({ version: version.rows[0] });
}));

// ============================================================
// POST /api/editor/:reportId/versions/:versionId/restore - Restore version
// ============================================================
router.post('/:reportId/versions/:versionId/restore', authenticate, asyncHandler(async (req, res) => {
    const { reportId, versionId } = req.params;
    const { comment } = req.body;
    
    // Verify report ownership
    const reportResult = await query(
        'SELECT * FROM reports WHERE id = $1 AND user_id = $2',
        [reportId, req.user.id]
    );
    if (reportResult.rows.length === 0) {
        throw new HttpError(404, 'Report not found');
    }
    
    // Get the version data
    const versionResult = await query(
        'SELECT * FROM report_versions WHERE id = $1 AND report_id = $2',
        [versionId, reportId]
    );
    if (versionResult.rows.length === 0) {
        throw new HttpError(404, 'Version not found');
    }
    
    const versionData = versionResult.rows[0].version_data;
    
    // Save as new draft with restore comment
    const client = await getClient();
    try {
        await client.query('BEGIN');
        
        const versionResult2 = await client.query(
            'SELECT COALESCE(MAX(version), 0) as max_version FROM editor_drafts WHERE report_id = $1',
            [reportId]
        );
        const newVersion = versionResult2.rows[0].max_version + 1;
        
        await client.query(
            `INSERT INTO editor_drafts (report_id, draft_data, version, saved_by)
             VALUES ($1, $2, $3, $4)`,
            [reportId, versionData, newVersion, req.user.id]
        );
        
        await client.query(
            `INSERT INTO report_versions (report_id, version_data, version_number, created_by, comment)
             VALUES ($1, $2, $3, $4, $5)`,
            [reportId, versionData, newVersion, req.user.id, comment || `Restored from version ${versionResult.rows[0].version_number}`]
        );
        
        await client.query('COMMIT');
        
        res.json({
            success: true,
            message: 'Version restored successfully',
            version: newVersion
        });
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}));

// ============================================================
// Category Management Routes
// ============================================================

// POST /api/editor/custom-categories - Create custom category
router.post('/custom-categories', authenticate, asyncHandler(async (req, res) => {
    const { name, color } = req.body;
    
    if (!name) {
        throw new HttpError(400, 'Category name is required');
    }
    
    const result = await query(
        `INSERT INTO custom_categories (user_id, name, color)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [req.user.id, name, color || '#6B7280']
    );
    
    res.status(201).json({ category: result.rows[0] });
}));

// PUT /api/editor/custom-categories/:id - Update category
router.put('/custom-categories/:id', authenticate, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name, color, isActive } = req.body;
    
    const result = await query(
        `UPDATE custom_categories 
         SET name = COALESCE($1, name),
             color = COALESCE($2, color),
             is_active = COALESCE($3, is_active)
         WHERE id = $4 AND user_id = $5
         RETURNING *`,
        [name, color, isActive, id, req.user.id]
    );
    
    if (result.rows.length === 0) {
        throw new HttpError(404, 'Category not found');
    }
    
    res.json({ category: result.rows[0] });
}));

// DELETE /api/editor/custom-categories/:id - Delete category
router.delete('/custom-categories/:id', authenticate, asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    const result = await query(
        'DELETE FROM custom_categories WHERE id = $1 AND user_id = $2 RETURNING id',
        [id, req.user.id]
    );
    
    if (result.rows.length === 0) {
        throw new HttpError(404, 'Category not found');
    }
    
    res.json({ success: true });
}));

module.exports = router;  // ✅ IMPORTANT: This must be at the end