// routes/branding.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { query } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { asyncHandler, HttpError } = require('../middleware/errorHandler');

const router = express.Router();

// Configure multer for logo uploads
const logoStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = './uploads/logos';
        fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `logo-${req.user.id}${ext}`);
    }
});

const upload = multer({
    storage: logoStorage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        const allowed = ['.png', '.jpg', '.jpeg', '.svg'];
        if (allowed.includes(path.extname(file.originalname).toLowerCase())) {
            cb(null, true);
        } else {
            cb(new HttpError(400, 'Only PNG, JPG, JPEG, or SVG files are supported'));
        }
    }
});

// ============================================================
// GET /api/branding - Get user's branding settings
// ============================================================
router.get('/', authenticate, asyncHandler(async (req, res) => {
    const result = await query(
        'SELECT * FROM broker_branding WHERE user_id = $1',
        [req.user.id]
    );
    
    if (result.rows.length === 0) {
        // Return default branding
        return res.json({
            branding: {
                user_id: req.user.id,
                firm_name: '',
                logo_url: null,
                contact_email: '',
                contact_phone: '',
                website: '',
                primary_color: '#1a3a5c',
                secondary_color: '#2e7d32',
                accent_color: '#4F46E5',
                template_layout: 'professional',
                disclaimer_text: null,
                show_watermark: false
            }
        });
    }
    
    res.json({ branding: result.rows[0] });
}));

// ============================================================
// PUT /api/branding - Update branding settings
// ============================================================
router.put('/', authenticate, asyncHandler(async (req, res) => {
    const {
        firm_name,
        contact_email,
        contact_phone,
        website,
        primary_color,
        secondary_color,
        accent_color,
        template_layout,
        disclaimer_text,
        show_watermark
    } = req.body;

    // Check if branding exists
    const existing = await query(
        'SELECT * FROM broker_branding WHERE user_id = $1',
        [req.user.id]
    );

    let result;
    if (existing.rows.length === 0) {
        // Insert new branding
        result = await query(
            `INSERT INTO broker_branding (
                user_id, firm_name, contact_email, contact_phone, website,
                primary_color, secondary_color, accent_color, template_layout,
                disclaimer_text, show_watermark
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING *`,
            [req.user.id, firm_name, contact_email, contact_phone, website,
             primary_color, secondary_color, accent_color, template_layout,
             disclaimer_text, show_watermark]
        );
    } else {
        // Update existing branding
        result = await query(
            `UPDATE broker_branding SET
                firm_name = COALESCE($1, firm_name),
                contact_email = COALESCE($2, contact_email),
                contact_phone = COALESCE($3, contact_phone),
                website = COALESCE($4, website),
                primary_color = COALESCE($5, primary_color),
                secondary_color = COALESCE($6, secondary_color),
                accent_color = COALESCE($7, accent_color),
                template_layout = COALESCE($8, template_layout),
                disclaimer_text = $9,
                show_watermark = COALESCE($10, show_watermark),
                updated_at = now()
            WHERE user_id = $11
            RETURNING *`,
            [firm_name, contact_email, contact_phone, website,
             primary_color, secondary_color, accent_color, template_layout,
             disclaimer_text, show_watermark, req.user.id]
        );
    }

    res.json({ branding: result.rows[0] });
}));

// ============================================================
// POST /api/branding/logo - Upload logo
// ============================================================
router.post('/logo', authenticate, upload.single('logo'), asyncHandler(async (req, res) => {
    if (!req.file) {
        throw new HttpError(400, 'No logo file uploaded');
    }

    const logoUrl = `/uploads/logos/${req.file.filename}`;
    
    // Update branding with logo URL
    const existing = await query(
        'SELECT * FROM broker_branding WHERE user_id = $1',
        [req.user.id]
    );

    if (existing.rows.length === 0) {
        // Create branding with logo
        await query(
            `INSERT INTO broker_branding (user_id, logo_url)
             VALUES ($1, $2)`,
            [req.user.id, logoUrl]
        );
    } else {
        // Delete old logo file if exists
        if (existing.rows[0].logo_url) {
            const oldPath = path.join(__dirname, '..', existing.rows[0].logo_url);
            if (fs.existsSync(oldPath)) {
                fs.unlinkSync(oldPath);
            }
        }
        
        await query(
            'UPDATE broker_branding SET logo_url = $1, updated_at = now() WHERE user_id = $2',
            [logoUrl, req.user.id]
        );
    }

    res.json({ logo_url: logoUrl });
}));

// ============================================================
// DELETE /api/branding/logo - Remove logo
// ============================================================
router.delete('/logo', authenticate, asyncHandler(async (req, res) => {
    const result = await query(
        'SELECT logo_url FROM broker_branding WHERE user_id = $1',
        [req.user.id]
    );

    if (result.rows.length > 0 && result.rows[0].logo_url) {
        const oldPath = path.join(__dirname, '..', result.rows[0].logo_url);
        if (fs.existsSync(oldPath)) {
            fs.unlinkSync(oldPath);
        }
        
        await query(
            'UPDATE broker_branding SET logo_url = NULL, updated_at = now() WHERE user_id = $1',
            [req.user.id]
        );
    }

    res.json({ success: true });
}));

module.exports = router;