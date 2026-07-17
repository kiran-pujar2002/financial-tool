require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');

const authRoutes = require('./routes/auth');
const reportRoutes = require('./routes/reports');
const paymentRoutes = require('./routes/payments');
const editorRoutes = require('./routes/editor');
const brandingRoutes = require('./routes/branding');
const valuationRoutes = require('./routes/valuation');
const cimRoutes = require('./routes/cim');          // ✅ Add this
const ddRoutes = require('./routes/dd');
const shareRoutes = require('./routes/share');


const { errorHandler } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 5000;

// ============================================================
// Middleware
// ============================================================

// Security headers
app.use(helmet());

// CORS configuration
const allowedOrigins = [
  "http://localhost:3000",
  "https://financial-tool-ruddy.vercel.app",
  "https://financial-tool-h426ygev8-team-hp1.vercel.app",
];

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
}));

// Logging
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// JSON parsing
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', apiLimiter);

// ============================================================
// Static files (uploads)
// ============================================================
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ============================================================
// Health Check
// ============================================================
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================================
// Routes
// ============================================================
app.use('/api/auth', authRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/editor', editorRoutes);
app.use('/api/branding', brandingRoutes);
app.use('/api/valuation', valuationRoutes);    // ✅ Add this
app.use('/api/cim', cimRoutes);                // ✅ Add this
app.use('/api/dd', ddRoutes);
app.use('/api/share', shareRoutes);

// ============================================================
// Error Handling
// ============================================================
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});
app.use(errorHandler);

// ============================================================
// Start Server
// ============================================================
app.listen(PORT, () => {
  console.log(`✅ Financial Restatement backend running on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
});

module.exports = app;