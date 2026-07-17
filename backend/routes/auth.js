// routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const { query } = require('../config/db');
const { asyncHandler, HttpError } = require('../middleware/errorHandler');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const signupSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    fullName: z.string().min(2),
    companyName: z.string().optional(),
    phone: z.string().optional(),
});

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
});

function signToken(user) {
    return jwt.sign(
        { sub: user.id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
}

function sanitizeUser(user) {
    const { password_hash, ...rest } = user;
    return rest;
}

// ============================================================
// POST /api/auth/signup - Register new user
// ============================================================
router.post('/signup', asyncHandler(async (req, res) => {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) {
        throw new HttpError(400, parsed.error.errors[0].message);
    }
    const { email, password, fullName, companyName, phone } = parsed.data;

    const existing = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
        throw new HttpError(409, 'An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await query(
        `INSERT INTO users (email, password_hash, full_name, company_name, phone)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, email, full_name, company_name, phone, plan, created_at`,
        [email.toLowerCase(), passwordHash, fullName, companyName || null, phone || null]
    );

    const user = result.rows[0];
    const token = signToken(user);

    res.status(201).json({ user, token });
}));

// ============================================================
// POST /api/auth/login - Login user
// ============================================================
router.post('/login', asyncHandler(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
        throw new HttpError(400, 'Email and password are required');
    }
    const { email, password } = parsed.data;

    const result = await query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    const user = result.rows[0];

    const validPassword = user ? await bcrypt.compare(password, user.password_hash) : false;
    if (!user || !validPassword) {
        throw new HttpError(401, 'Invalid email or password');
    }

    const token = signToken(user);
    res.json({ user: sanitizeUser(user), token });
}));

// ============================================================
// GET /api/auth/me - Get current user
// ============================================================
router.get('/me', authenticate, asyncHandler(async (req, res) => {
    const result = await query(
        'SELECT id, email, full_name, company_name, phone, plan, plan_expires_at, created_at FROM users WHERE id = $1',
        [req.user.id]
    );
    if (result.rows.length === 0) throw new HttpError(404, 'User not found');
    res.json({ user: result.rows[0] });
}));

// ============================================================
// PUT /api/auth/profile - Update user profile
// ============================================================
router.put('/profile', authenticate, asyncHandler(async (req, res) => {
    const { fullName, companyName, phone } = req.body;
    
    const result = await query(
        `UPDATE users SET
            full_name = COALESCE($1, full_name),
            company_name = COALESCE($2, company_name),
            phone = COALESCE($3, phone),
            updated_at = now()
         WHERE id = $4
         RETURNING id, email, full_name, company_name, phone, plan, created_at`,
        [fullName, companyName, phone, req.user.id]
    );
    
    if (result.rows.length === 0) {
        throw new HttpError(404, 'User not found');
    }
    
    res.json({ user: result.rows[0] });
}));

// ============================================================
// POST /api/auth/change-password - Change user password
// ============================================================
router.post('/change-password', authenticate, asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
        throw new HttpError(400, 'Current password and new password are required');
    }
    
    if (newPassword.length < 8) {
        throw new HttpError(400, 'New password must be at least 8 characters');
    }
    
    // Get user with password hash
    const result = await query(
        'SELECT * FROM users WHERE id = $1',
        [req.user.id]
    );
    
    if (result.rows.length === 0) {
        throw new HttpError(404, 'User not found');
    }
    
    const user = result.rows[0];
    
    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, user.password_hash);
    
    if (!isValid) {
        throw new HttpError(401, 'Current password is incorrect');
    }
    
    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 12);
    
    // Update password
    await query(
        'UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2',
        [newPasswordHash, req.user.id]
    );
    
    res.json({ success: true, message: 'Password changed successfully' });
}));

module.exports = router;