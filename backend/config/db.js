// config/db.js
const { Pool } = require('pg');
require('dotenv').config();

// ✅ Use Neon's pooled connection for better performance
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 20, // Max connections
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// ✅ Log slow queries
const originalQuery = pool.query.bind(pool);
pool.query = async (text, params) => {
    const start = Date.now();
    try {
        const result = await originalQuery(text, params);
        const duration = Date.now() - start;
        if (duration > 100) {
            console.log(`⏱️ Slow query (${duration}ms): ${text.substring(0, 100)}...`);
        }
        return result;
    } catch (err) {
        console.error('❌ Query error:', err);
        throw err;
    }
};

module.exports = { query: pool.query.bind(pool), getClient: pool.connect.bind(pool) };