require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  // 1. Run schema.sql
  const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  console.log('Applying schema.sql ...');
  await pool.query(schemaSql);
  console.log('✅ Schema applied successfully.');

  // 2. Run migration_add_editor_tables.sql from config folder
  try {
    const editorSql = fs.readFileSync(path.join(__dirname, '../config/migration_add_editor_tables.sql'), 'utf8');
    console.log('Applying migration_add_editor_tables.sql ...');
    await pool.query(editorSql);
    console.log('✅ Editor tables migration applied successfully.');
  } catch (err) {
    console.log('⚠️ Editor migration file not found or already applied:', err.message);
  }

  await pool.end();
}

main().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});