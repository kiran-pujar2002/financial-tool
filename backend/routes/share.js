// routes/share.js
const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { query } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { asyncHandler, HttpError } = require('../middleware/errorHandler');

const router = express.Router();

// ============================================================
// Helper: Generate unique token
// ============================================================
function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

// ============================================================
// POST /api/share - Create a share link
// ============================================================
router.post('/', authenticate, asyncHandler(async (req, res) => {
    const {
        reportId,
        password,
        expiresAt,
        maxViews,
        allowDownload = false,
        allowPrint = true
    } = req.body;

    if (!reportId) {
        throw new HttpError(400, 'reportId is required');
    }

    // Verify report ownership
    const reportResult = await query(
        'SELECT * FROM reports WHERE id = $1 AND user_id = $2',
        [reportId, req.user.id]
    );
    if (reportResult.rows.length === 0) {
        throw new HttpError(404, 'Report not found');
    }

    const token = generateToken();
    let passwordHash = null;
    if (password) {
        passwordHash = await bcrypt.hash(password, 10);
    }

    const result = await query(
        `INSERT INTO share_links (
            report_id, user_id, token, password_hash,
            expires_at, max_views, allow_download, allow_print
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *`,
        [reportId, req.user.id, token, passwordHash,
         expiresAt || null, maxViews || null, allowDownload, allowPrint]
    );

    const shareLink = result.rows[0];
    
    // Generate share URL
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const shareUrl = `${baseUrl}/share/${token}`;

    res.status(201).json({
        shareLink,
        shareUrl,
        token
    });
}));

// ============================================================
// GET /api/share/:reportId - Get all share links for a report
// ============================================================
router.get('/:reportId', authenticate, asyncHandler(async (req, res) => {
    const { reportId } = req.params;

    const result = await query(
        `SELECT * FROM share_links 
         WHERE report_id = $1 AND user_id = $2
         ORDER BY created_at DESC`,
        [reportId, req.user.id]
    );

    res.json({ shareLinks: result.rows });
}));

// ============================================================
// DELETE /api/share/:linkId - Revoke a share link
// ============================================================
router.delete('/:linkId', authenticate, asyncHandler(async (req, res) => {
    const { linkId } = req.params;

    const result = await query(
        'DELETE FROM share_links WHERE id = $1 AND user_id = $2 RETURNING id',
        [linkId, req.user.id]
    );

    if (result.rows.length === 0) {
        throw new HttpError(404, 'Share link not found');
    }

    res.json({ success: true });
}));

// ============================================================
// GET /api/share/analytics/:linkId - Get analytics for a share link
// ============================================================
router.get('/analytics/:linkId', authenticate, asyncHandler(async (req, res) => {
    const { linkId } = req.params;

    const linkResult = await query(
        'SELECT * FROM share_links WHERE id = $1 AND user_id = $2',
        [linkId, req.user.id]
    );
    if (linkResult.rows.length === 0) {
        throw new HttpError(404, 'Share link not found');
    }

    const analytics = await query(
        `SELECT 
            COUNT(*) as total_views,
            COUNT(DISTINCT ip_address) as unique_viewers,
            MIN(viewed_at) as first_view,
            MAX(viewed_at) as last_view
         FROM share_analytics 
         WHERE share_link_id = $1`,
        [linkId]
    );

    // Get detailed views
    const views = await query(
        `SELECT * FROM share_analytics 
         WHERE share_link_id = $1 
         ORDER BY viewed_at DESC 
         LIMIT 50`,
        [linkId]
    );

    res.json({
        stats: analytics.rows[0],
        views: views.rows
    });
}));

// ============================================================
// GET /api/share/public/:token - Get public report data
// ============================================================
router.get('/public/:token', asyncHandler(async (req, res) => {
    const { token } = req.params;
    const { password } = req.query;

    console.log('🔗 Public share access - Token:', token); // Debug log

    // Get share link
    const linkResult = await query(
        'SELECT * FROM share_links WHERE token = $1',
        [token]
    );

    if (linkResult.rows.length === 0) {
        console.log('❌ Token not found:', token);
        throw new HttpError(404, 'Invalid share link');
    }

    const shareLink = linkResult.rows[0];
    console.log('✅ Share link found:', shareLink.id);

    // Check expiration
    if (shareLink.expires_at && new Date(shareLink.expires_at) < new Date()) {
        throw new HttpError(410, 'This share link has expired');
    }

    // Check max views
    if (shareLink.max_views && shareLink.views >= shareLink.max_views) {
        throw new HttpError(410, 'This share link has reached its maximum views');
    }

    // Check password
    if (shareLink.password_hash) {
        if (!password) {
            return res.status(401).json({ 
                error: 'Password required',
                requiresPassword: true
            });
        }
        const bcrypt = require('bcryptjs');
        const valid = await bcrypt.compare(password, shareLink.password_hash);
        if (!valid) {
            return res.status(401).json({ 
                error: 'Invalid password',
                requiresPassword: true
            });
        }
    }

    // Get report data
    const reportResult = await query(
        `SELECT id, business_name, industry, total_revenue, 
                ebitda, sde, total_addbacks, ai_summary
         FROM reports 
         WHERE id = $1`,
        [shareLink.report_id]
    );

    if (reportResult.rows.length === 0) {
        throw new HttpError(404, 'Report not found');
    }

    const report = reportResult.rows[0];

    // Get transactions (limited for public view)
    const transactions = await query(
        `SELECT id, description, category, amount, is_addback
         FROM transactions 
         WHERE report_id = $1
         ORDER BY txn_date DESC
         LIMIT 100`,
        [shareLink.report_id]
    );

    // Get addbacks
    const addbacks = await query(
        `SELECT label, amount, justification
         FROM addback_schedule 
         WHERE report_id = $1
         ORDER BY amount DESC`,
        [shareLink.report_id]
    );

    // Update view count
    await query(
        'UPDATE share_links SET views = views + 1, last_viewed_at = now() WHERE id = $1',
        [shareLink.id]
    );

    // Track analytics
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    await query(
        `INSERT INTO share_analytics (share_link_id, ip_address, user_agent)
         VALUES ($1, $2, $3)`,
        [shareLink.id, ip, userAgent]
    );

    res.json({
        report,
        transactions: transactions.rows,
        addbacks: addbacks.rows,
        allowDownload: shareLink.allow_download,
        allowPrint: shareLink.allow_print
    });
}));
// ============================================================
// GET /api/share/download/:token - Download shared report
// ============================================================
router.get('/download/:token', asyncHandler(async (req, res) => {
    const { token } = req.params;

    // Get share link
    const linkResult = await query(
        'SELECT * FROM share_links WHERE token = $1',
        [token]
    );

    if (linkResult.rows.length === 0) {
        throw new HttpError(404, 'Invalid share link');
    }

    const shareLink = linkResult.rows[0];

    // Check permissions
    if (!shareLink.allow_download) {
        throw new HttpError(403, 'Download not permitted for this share link');
    }

    // Check expiration
    if (shareLink.expires_at && new Date(shareLink.expires_at) < new Date()) {
        throw new HttpError(410, 'This share link has expired');
    }

    // Check max views
    if (shareLink.max_views && shareLink.views >= shareLink.max_views) {
        throw new HttpError(410, 'This share link has reached its maximum views');
    }

    // Get report
    const reportResult = await query(
        'SELECT * FROM reports WHERE id = $1',
        [shareLink.report_id]
    );

    if (reportResult.rows.length === 0) {
        throw new HttpError(404, 'Report not found');
    }

    const report = reportResult.rows[0];

    // Check if PDF exists
    if (!report.report_pdf_path || !fs.existsSync(report.report_pdf_path)) {
        throw new HttpError(404, 'PDF not found for this report');
    }

    // Update download count
    await query(
        'UPDATE share_links SET downloads = downloads + 1 WHERE id = $1',
        [shareLink.id]
    );

    res.download(report.report_pdf_path, `QOE-Report-${report.business_name}.pdf`);
}));

module.exports = router;