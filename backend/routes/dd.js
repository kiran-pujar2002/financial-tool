// routes/dd.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { query } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { asyncHandler, HttpError } = require('../middleware/errorHandler');
const { generatePDF } = require('../services/pdf');

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
// Helper: Get or create progress
// ============================================================
async function getOrCreateProgress(reportId, itemId) {
    let result = await query(
        'SELECT * FROM dd_progress WHERE report_id = $1 AND item_id = $2',
        [reportId, itemId]
    );
    
    if (result.rows.length > 0) {
        console.log('✅ Progress already exists:', result.rows[0].id);
        return result.rows[0];
    }
    
    console.log('📝 Creating new progress record...');
    result = await query(
        `INSERT INTO dd_progress (report_id, item_id, status)
         VALUES ($1, $2, 'pending')
         RETURNING *`,
        [reportId, itemId]
    );
    
    console.log('✅ Progress created:', result.rows[0].id);
    return result.rows[0];
}

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
    
    const reportResult = await query(
        'SELECT id FROM reports WHERE id = $1 AND user_id = $2',
        [reportId, req.user.id]
    );
    if (reportResult.rows.length === 0) {
        throw new HttpError(404, 'Report not found');
    }
    
    const result = await query(
        `SELECT 
            i.id, i.category, i.title, i.description, i.priority as default_priority,
            COALESCE(p.status, 'pending') as status,
            p.id as progress_id,
            p.notes, p.assigned_to, p.due_date, p.completed_at,
            p.priority as custom_priority
        FROM dd_items i
        LEFT JOIN dd_progress p ON i.id = p.item_id AND p.report_id = $1
        ORDER BY i.category, i.order_index`,
        [reportId]
    );
    
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
    
    const reportResult = await query(
        'SELECT id FROM reports WHERE id = $1 AND user_id = $2',
        [reportId, req.user.id]
    );
    if (reportResult.rows.length === 0) {
        throw new HttpError(404, 'Report not found');
    }
    
    const progress = await getOrCreateProgress(reportId, itemId);
    
    const completedAt = status === 'completed' ? new Date() : null;
    
    const result = await query(
        `UPDATE dd_progress 
         SET status = $1, notes = $2, priority = $3, assigned_to = $4, 
             due_date = $5, completed_at = $6, updated_at = now()
         WHERE id = $7
         RETURNING *`,
        [status, notes, priority, assignedTo, dueDate, completedAt, progress.id]
    );
    
    res.json({ progress: result.rows[0] });
}));

// ============================================================
// POST /api/dd/documents/:itemId - Upload document
// ============================================================
router.post('/documents/:itemId', authenticate, upload.single('file'), asyncHandler(async (req, res) => {
    const { itemId } = req.params;
    const { reportId } = req.query;
    
    console.log('📤 Uploading document for item:', itemId);
    console.log('📤 Report ID:', reportId);
    
    if (!req.file) {
        throw new HttpError(400, 'No file uploaded');
    }
    
    if (!reportId) {
        throw new HttpError(400, 'reportId is required');
    }
    
    const reportResult = await query(
        'SELECT id FROM reports WHERE id = $1 AND user_id = $2',
        [reportId, req.user.id]
    );
    if (reportResult.rows.length === 0) {
        throw new HttpError(404, 'Report not found');
    }
    
    const progress = await getOrCreateProgress(reportId, itemId);
    
    const filePath = `/uploads/dd_documents/${req.file.filename}`;
    
    const result = await query(
        `INSERT INTO dd_documents (progress_id, filename, file_path, file_size, mime_type, uploaded_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [progress.id, req.file.originalname, filePath, req.file.size, req.file.mimetype, req.user.id]
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

// ============================================================
// POST /api/dd/generate-report - Generate Due Diligence Report PDF
// ============================================================
router.post('/generate-report', authenticate, asyncHandler(async (req, res) => {
    const { reportId } = req.body;
    
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
    
    const progressResult = await query(
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
    
    const items = progressResult.rows;
    const total = items.length;
    const completed = items.filter(r => r.status === 'completed').length;
    const inProgress = items.filter(r => r.status === 'in_progress').length;
    const blocked = items.filter(r => r.status === 'blocked').length;
    const pending = items.filter(r => r.status === 'pending').length;
    
    const stats = {
        total,
        completed,
        inProgress,
        blocked,
        pending,
        progressPercentage: total > 0 ? Math.round((completed / total) * 100) : 0
    };
    
    const brandingResult = await query(
        'SELECT * FROM broker_branding WHERE user_id = $1',
        [req.user.id]
    );
    const branding = brandingResult.rows[0] || null;
    
    const outputDir = path.join(__dirname, '../reports/dd');
    fs.mkdirSync(outputDir, { recursive: true });
    const filename = `dd-${report.id}-${Date.now()}.pdf`;
    const outputPath = path.join(outputDir, filename);
    
    // ✅ Use unified PDF generator
    await generatePDF({
        type: 'dd',
        report: report,
        data: {
            items,
            stats,
            coverInfo: {
                subtitle: 'Due Diligence Checklist',
            },
        },
        branding,
        outputPath,
    });
    
    res.json({ 
        success: true, 
        downloadUrl: `/api/dd/download/${filename}`
    });
}));

// ============================================================
// GET /api/dd/download/:filename - Download Due Diligence Report
// ============================================================
router.get('/download/:filename', authenticate, asyncHandler(async (req, res) => {
    const { filename } = req.params;
    
    const safeFilename = path.basename(filename);
    const filePath = path.join(__dirname, '../reports/dd', safeFilename);
    
    if (!fs.existsSync(filePath)) {
        throw new HttpError(404, 'File not found');
    }
    
    res.download(filePath, `Due-Diligence-${safeFilename}`, (err) => {
        if (err) {
            console.error('❌ Download error:', err);
            res.status(500).json({ error: 'Download failed' });
        }
    });
}));

module.exports = router;