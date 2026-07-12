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

router.get('/me', authenticate, asyncHandler(async (req, res) => {
  const result = await query(
    'SELECT id, email, full_name, company_name, phone, plan, plan_expires_at, created_at FROM users WHERE id = $1',
    [req.user.id]
  );
  if (result.rows.length === 0) throw new HttpError(404, 'User not found');
  res.json({ user: result.rows[0] });
}));

module.exports = router;