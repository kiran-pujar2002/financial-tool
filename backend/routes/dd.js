// routes/dd.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { query } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { asyncHandler, HttpError } = require('../middleware/errorHandler');

const router = express.Router();

// Configure multer for document uploads
const documentStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = './uploads/dd_documents';
        fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${Date.now()}-${Math.random().toString(36).substring(7)}${ext}`);
    }
});

const upload = multer({
    storage: documentStorage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// ============================================================
// GET /api/dd/templates - Get all DD templates
// ============================================================
router.get('/templates', authenticate, asyncHandler(async (req, res) => {
    const templates = await query(
        'SELECT * FROM dd_templates ORDER BY name'
    );
    
    const items = await query(
        'SELECT * FROM dd_items ORDER BY category, order_index'
    );
    
    res.json({
        templates: templates.rows,
        items: items.rows
    });
}));

// ============================================================
// GET /api/dd/progress/:reportId - Get DD progress for a report
// ============================================================
router.get('/progress/:reportId', authenticate, asyncHandler(async (req, res) => {
    const { reportId } = req.params;
    
    // Verify report ownership
    const reportResult = await query(
        'SELECT id FROM reports WHERE id = $1 AND user_id = $2',
        [reportId, req.user.id]
    );
    if (reportResult.rows.length === 0) {
        throw new HttpError(404, 'Report not found');
    }
    
    // Get all items with progress
    const result = await query(
        `SELECT 
            i.id, i.category, i.title, i.description, i.priority as default_priority,
            COALESCE(p.status, 'pending') as status,
            p.notes, p.assigned_to, p.due_date, p.completed_at,
            p.priority as custom_priority
        FROM dd_items i
        LEFT JOIN dd_progress p ON i.id = p.item_id AND p.report_id = $1
        ORDER BY i.category, i.order_index`,
        [reportId]
    );
    
    // Calculate stats
    const total = result.rows.length;
    const completed = result.rows.filter(r => r.status === 'completed').length;
    const inProgress = result.rows.filter(r => r.status === 'in_progress').length;
    const blocked = result.rows.filter(r => r.status === 'blocked').length;
    const pending = result.rows.filter(r => r.status === 'pending').length;
    
    res.json({
        items: result.rows,
        stats: {
            total,
            completed,
            inProgress,
            blocked,
            pending,
            progressPercentage: total > 0 ? Math.round((completed / total) * 100) : 0
        }
    });
}));

// ============================================================
// PUT /api/dd/progress/:reportId/:itemId - Update item progress
// ============================================================
router.put('/progress/:reportId/:itemId', authenticate, asyncHandler(async (req, res) => {
    const { reportId, itemId } = req.params;
    const { status, notes, priority, assignedTo, dueDate } = req.body;
    
    // Verify report ownership
    const reportResult = await query(
        'SELECT id FROM reports WHERE id = $1 AND user_id = $2',
        [reportId, req.user.id]
    );
    if (reportResult.rows.length === 0) {
        throw new HttpError(404, 'Report not found');
    }
    
    // Check if progress exists
    const existing = await query(
        'SELECT * FROM dd_progress WHERE report_id = $1 AND item_id = $2',
        [reportId, itemId]
    );
    
    let result;
    if (existing.rows.length === 0) {
        // Create new progress
        result = await query(
            `INSERT INTO dd_progress (report_id, item_id, status, notes, priority, assigned_to, due_date)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [reportId, itemId, status || 'pending', notes, priority, assignedTo, dueDate]
        );
    } else {
        // Update existing progress
        const completedAt = status === 'completed' ? new Date() : null;
        result = await query(
            `UPDATE dd_progress 
             SET status = $1, notes = $2, priority = $3, assigned_to = $4, 
                 due_date = $5, completed_at = $6, updated_at = now()
             WHERE report_id = $7 AND item_id = $8
             RETURNING *`,
            [status, notes, priority, assignedTo, dueDate, completedAt, reportId, itemId]
        );
    }
    
    res.json({ progress: result.rows[0] });
}));

// ============================================================
// POST /api/dd/documents/:progressId - Upload document
// ============================================================
router.post('/documents/:progressId', authenticate, upload.single('file'), asyncHandler(async (req, res) => {
    const { progressId } = req.params;
    
    if (!req.file) {
        throw new HttpError(400, 'No file uploaded');
    }
    
    // Verify progress belongs to user's report
    const progressResult = await query(
        `SELECT p.*, r.user_id 
         FROM dd_progress p
         JOIN reports r ON p.report_id = r.id
         WHERE p.id = $1`,
        [progressId]
    );
    
    if (progressResult.rows.length === 0) {
        throw new HttpError(404, 'Progress not found');
    }
    
    if (progressResult.rows[0].user_id !== req.user.id) {
        throw new HttpError(403, 'Unauthorized');
    }
    
    const filePath = `/uploads/dd_documents/${req.file.filename}`;
    
    const result = await query(
        `INSERT INTO dd_documents (progress_id, filename, file_path, file_size, mime_type, uploaded_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [progressId, req.file.originalname, filePath, req.file.size, req.file.mimetype, req.user.id]
    );
    
    res.json({ document: result.rows[0] });
}));

// ============================================================
// GET /api/dd/documents/:progressId - Get documents for a progress
// ============================================================
router.get('/documents/:progressId', authenticate, asyncHandler(async (req, res) => {
    const { progressId } = req.params;
    
    const result = await query(
        `SELECT d.*, u.full_name as uploaded_by_name
         FROM dd_documents d
         LEFT JOIN users u ON d.uploaded_by = u.id
         WHERE d.progress_id = $1
         ORDER BY d.created_at DESC`,
        [progressId]
    );
    
    res.json({ documents: result.rows });
}));

module.exports = router;