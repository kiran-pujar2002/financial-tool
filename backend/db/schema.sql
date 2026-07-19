-- Financial Restatement Tool — Database Schema
-- Run with: npm run migrate  (applies this whole file every time — all
-- statements below are idempotent and safe to re-run against an existing DB)

CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- for gen_random_uuid()

-- =========================
-- USERS (brokers / advisors)
-- =========================
CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    full_name       VARCHAR(255) NOT NULL,
    company_name    VARCHAR(255),
    phone           VARCHAR(50),
    plan            VARCHAR(20) NOT NULL DEFAULT 'pay_per_report', -- 'pay_per_report' | 'enterprise'
    plan_expires_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================
-- REPORTS (one per QOE engagement)
-- =========================
CREATE TABLE IF NOT EXISTS reports (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    business_name       VARCHAR(255) NOT NULL,
    industry            VARCHAR(255),
    period_start        DATE,
    period_end          DATE,
    source_filename     VARCHAR(500),
    source_file_path    VARCHAR(1000),
    status              VARCHAR(30) NOT NULL DEFAULT 'uploaded',
        -- uploaded | parsing | categorizing | ready_for_review | paid | generating_pdf | completed | failed
    payment_status      VARCHAR(20) NOT NULL DEFAULT 'unpaid', -- unpaid | paid | refunded
    total_revenue       NUMERIC(16,2),
    total_expenses      NUMERIC(16,2),
    net_income          NUMERIC(16,2),
    ebitda              NUMERIC(16,2),
    sde                 NUMERIC(16,2),
    total_addbacks      NUMERIC(16,2),
    report_pdf_path     VARCHAR(1000),
    ai_summary          TEXT,
    error_message       TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);

-- =========================
-- TRANSACTIONS (line items parsed + categorized)
-- =========================
CREATE TABLE IF NOT EXISTS transactions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id       UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    txn_date        DATE,
    description     TEXT NOT NULL,
    amount          NUMERIC(16,2) NOT NULL,
    raw_category    VARCHAR(255),          -- category as it appeared in source file, if any
    category        VARCHAR(100) NOT NULL, -- normalized: Revenue, COGS, Payroll, Rent, Utilities, Marketing, ...
    is_addback      BOOLEAN NOT NULL DEFAULT false,
    addback_reason  TEXT,
    confidence      NUMERIC(4,3), -- AI confidence score 0.000–1.000
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transactions_report_id ON transactions(report_id);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);
CREATE INDEX IF NOT EXISTS idx_transactions_is_addback ON transactions(is_addback);

-- =========================
-- ADDBACK SCHEDULE (aggregated, one row per add-back type per report)
-- Denormalized on purpose: this is what renders directly in the PDF table.
-- =========================
CREATE TABLE IF NOT EXISTS addback_schedule (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id       UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    label           VARCHAR(255) NOT NULL,   -- e.g. "Owner's personal auto lease"
    category        VARCHAR(100) NOT NULL,   -- Personal Expense | One-Time | Non-Operating | Owner Compensation
    amount          NUMERIC(16,2) NOT NULL,
    justification   TEXT,
    transaction_count INTEGER DEFAULT 1,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_addback_schedule_report_id ON addback_schedule(report_id);

-- =========================
-- PAYMENTS (Razorpay Orders API)
-- =========================
CREATE TABLE IF NOT EXISTS payments (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    report_id               UUID REFERENCES reports(id) ON DELETE SET NULL,
    razorpay_order_id       VARCHAR(255) UNIQUE NOT NULL,
    razorpay_payment_id     VARCHAR(255) UNIQUE, -- NULL until paid; UNIQUE = DB-level duplicate-payment guard
    razorpay_signature      VARCHAR(500),
    amount                  NUMERIC(16,2) NOT NULL, -- in currency major unit (rupees, not paise)
    currency                VARCHAR(10) NOT NULL DEFAULT 'inr',
    type                    VARCHAR(30) NOT NULL, -- 'per_report' | 'enterprise_subscription'
    status                  VARCHAR(20) NOT NULL DEFAULT 'created', -- created | succeeded | failed | refunded
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_report_id ON payments(report_id);

-- =========================
-- updated_at trigger helper
-- =========================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_reports_updated_at ON reports;
CREATE TRIGGER trg_reports_updated_at BEFORE UPDATE ON reports
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================
-- MIGRATION: clean up columns from earlier Stripe / Razorpay Payment Links
-- attempts. Idempotent — safe to re-run. This is what actually fixes an
-- already-existing dev database (the CREATE TABLE IF NOT EXISTS statements
-- above only apply to brand-new tables, not existing ones).
-- =========================
ALTER TABLE users DROP COLUMN IF EXISTS stripe_customer_id;

ALTER TABLE payments DROP COLUMN IF EXISTS stripe_checkout_session_id;
ALTER TABLE payments DROP COLUMN IF EXISTS stripe_payment_intent_id;
ALTER TABLE payments DROP COLUMN IF EXISTS razorpay_payment_link_id;

ALTER TABLE payments ADD COLUMN IF NOT EXISTS razorpay_order_id VARCHAR(255);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS razorpay_payment_id VARCHAR(255);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS razorpay_signature VARCHAR(500);

-- Backfill NOT NULL + uniqueness only after the column is guaranteed to exist.
-- Wrapped in a DO block so it doesn't error out if constraints already exist.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'payments_razorpay_order_id_key'
    ) THEN
        ALTER TABLE payments ADD CONSTRAINT payments_razorpay_order_id_key UNIQUE (razorpay_order_id);
    END IF;
EXCEPTION WHEN duplicate_table THEN
    NULL; -- constraint already exists under a different name, ignore
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'payments_razorpay_payment_id_key'
    ) THEN
        ALTER TABLE payments ADD CONSTRAINT payments_razorpay_payment_id_key UNIQUE (razorpay_payment_id);
    END IF;
EXCEPTION WHEN duplicate_table THEN
    NULL;
END $$;

-- ============================================================
-- BRANDING TABLE - Broker branding settings
-- ============================================================

CREATE TABLE IF NOT EXISTS broker_branding (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    firm_name VARCHAR(255),
    logo_url VARCHAR(1000),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    website VARCHAR(255),
    primary_color VARCHAR(7) DEFAULT '#1a3a5c',
    secondary_color VARCHAR(7) DEFAULT '#2e7d32',
    accent_color VARCHAR(7) DEFAULT '#4F46E5',
    template_layout VARCHAR(50) DEFAULT 'professional',
    disclaimer_text TEXT,
    show_watermark BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_broker_branding_updated_at ON broker_branding;
CREATE TRIGGER trg_broker_branding_updated_at BEFORE UPDATE ON broker_branding
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


    -- ============================================================
-- VALUATION TABLES
-- ============================================================

-- 1. Industry Valuation Multiples (with UNIQUE constraint)
CREATE TABLE IF NOT EXISTS industry_multiples (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    industry VARCHAR(255) NOT NULL UNIQUE,  -- ✅ Added UNIQUE constraint
    sde_multiple_min NUMERIC(5,2),
    sde_multiple_mid NUMERIC(5,2),
    sde_multiple_max NUMERIC(5,2),
    ebitda_multiple_min NUMERIC(5,2),
    ebitda_multiple_mid NUMERIC(5,2),
    ebitda_multiple_max NUMERIC(5,2),
    revenue_multiple_min NUMERIC(5,2),
    revenue_multiple_mid NUMERIC(5,2),
    revenue_multiple_max NUMERIC(5,2),
    source VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_industry_multiples_industry ON industry_multiples(industry);

-- 2. Valuation History
CREATE TABLE IF NOT EXISTS valuations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    method VARCHAR(50) NOT NULL, -- 'sde', 'ebitda', 'revenue', 'dcf'
    value_min NUMERIC(16,2),
    value_mid NUMERIC(16,2),
    value_max NUMERIC(16,2),
    selected_value NUMERIC(16,2),
    multiple_used NUMERIC(5,2),
    adjustments JSONB,
    risk_factors JSONB,
    comparable_transactions JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_valuations_report_id ON valuations(report_id);
CREATE INDEX IF NOT EXISTS idx_valuations_user_id ON valuations(user_id);

-- 3. Insert Industry Multiples Data (with ON CONFLICT handling)
INSERT INTO industry_multiples (
    industry, 
    sde_multiple_min, sde_multiple_mid, sde_multiple_max, 
    ebitda_multiple_min, ebitda_multiple_mid, ebitda_multiple_max
) VALUES
('Retail / Hardware', 2.0, 3.0, 4.0, 3.0, 4.5, 6.0),
('Retail / General', 1.8, 2.8, 4.5, 2.5, 4.0, 6.5),
('Manufacturing', 2.5, 3.5, 5.0, 3.5, 5.0, 7.0),
('Technology', 3.0, 5.0, 8.0, 5.0, 7.0, 10.0),
('Healthcare', 2.5, 4.0, 6.0, 4.0, 5.5, 8.0),
('Services / Professional', 2.0, 3.0, 5.0, 3.0, 4.5, 7.0),
('Hospitality', 1.8, 2.5, 3.5, 2.5, 3.5, 5.0),
('Construction', 2.0, 3.0, 4.5, 3.0, 4.0, 6.0),
('Food & Beverage', 1.8, 2.8, 4.0, 2.5, 4.0, 5.5),
('E-commerce', 2.5, 4.0, 6.0, 4.0, 6.0, 8.0)
ON CONFLICT (industry) DO UPDATE SET 
    sde_multiple_min = EXCLUDED.sde_multiple_min,
    sde_multiple_mid = EXCLUDED.sde_multiple_mid,
    sde_multiple_max = EXCLUDED.sde_multiple_max,
    ebitda_multiple_min = EXCLUDED.ebitda_multiple_min,
    ebitda_multiple_mid = EXCLUDED.ebitda_multiple_mid,
    ebitda_multiple_max = EXCLUDED.ebitda_multiple_max,
    updated_at = now();

-- Add updated_at trigger for industry_multiples
DROP TRIGGER IF EXISTS trg_industry_multiples_updated_at ON industry_multiples;
CREATE TRIGGER trg_industry_multiples_updated_at BEFORE UPDATE ON industry_multiples
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

    -- ============================================================
-- DUE DILIGENCE TABLES
-- ============================================================

-- 1. Due Diligence Templates
CREATE TABLE IF NOT EXISTS dd_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL, -- 'Financial', 'Legal', 'Operations', 'HR', 'Tax', 'IT', 'Compliance'
    description TEXT,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Due Diligence Checklist Items
CREATE TABLE IF NOT EXISTS dd_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID REFERENCES dd_templates(id) ON DELETE CASCADE,
    category VARCHAR(100) NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    priority VARCHAR(20) DEFAULT 'medium', -- 'high', 'medium', 'low'
    is_required BOOLEAN DEFAULT true,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Due Diligence Progress (Per Report)
CREATE TABLE IF NOT EXISTS dd_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES dd_items(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'blocked'
    notes TEXT,
    priority VARCHAR(20) DEFAULT 'medium',
    assigned_to UUID REFERENCES users(id),
    due_date DATE,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(report_id, item_id)
);

-- 4. Due Diligence Documents
CREATE TABLE IF NOT EXISTS dd_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    progress_id UUID NOT NULL REFERENCES dd_progress(id) ON DELETE CASCADE,
    filename VARCHAR(500) NOT NULL,
    file_path VARCHAR(1000) NOT NULL,
    file_size INTEGER,
    mime_type VARCHAR(100),
    uploaded_by UUID REFERENCES users(id),
    version INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Default DD Templates
INSERT INTO dd_templates (name, category, description, is_default) VALUES
('Financial Due Diligence', 'Financial', 'Standard financial due diligence checklist', true),
('Legal Due Diligence', 'Legal', 'Standard legal due diligence checklist', true),
('Operations Due Diligence', 'Operations', 'Standard operations due diligence checklist', true);

-- 6. Default DD Items for Financial Category
INSERT INTO dd_items (template_id, category, title, description, priority, order_index) 
SELECT id, 'Financial', 'Financial Statements (3 years)', 'Audited or reviewed financial statements for the last 3 years', 'high', 1
FROM dd_templates WHERE name = 'Financial Due Diligence' LIMIT 1;

INSERT INTO dd_items (template_id, category, title, description, priority, order_index) 
SELECT id, 'Financial', 'Tax Returns (3 years)', 'Business and personal tax returns for the last 3 years', 'high', 2
FROM dd_templates WHERE name = 'Financial Due Diligence' LIMIT 1;

INSERT INTO dd_items (template_id, category, title, description, priority, order_index) 
SELECT id, 'Financial', 'Accounts Receivable Aging', 'Detailed AR aging report', 'medium', 3
FROM dd_templates WHERE name = 'Financial Due Diligence' LIMIT 1;

INSERT INTO dd_items (template_id, category, title, description, priority, order_index) 
SELECT id, 'Financial', 'Accounts Payable Aging', 'Detailed AP aging report', 'medium', 4
FROM dd_templates WHERE name = 'Financial Due Diligence' LIMIT 1;

INSERT INTO dd_items (template_id, category, title, description, priority, order_index) 
SELECT id, 'Financial', 'Debt Schedule', 'List of all outstanding debts and loans', 'high', 5
FROM dd_templates WHERE name = 'Financial Due Diligence' LIMIT 1;

INSERT INTO dd_items (template_id, category, title, description, priority, order_index) 
SELECT id, 'Financial', 'Bank Statements (12 months)', 'Bank statements for all accounts', 'medium', 6
FROM dd_templates WHERE name = 'Financial Due Diligence' LIMIT 1;

-- Legal Category Items
INSERT INTO dd_items (template_id, category, title, description, priority, order_index) 
SELECT id, 'Legal', 'Articles of Incorporation', 'Certificate of Incorporation and amendments', 'high', 1
FROM dd_templates WHERE name = 'Legal Due Diligence' LIMIT 1;

INSERT INTO dd_items (template_id, category, title, description, priority, order_index) 
SELECT id, 'Legal', 'Bylaws / Operating Agreement', 'Current bylaws or operating agreement', 'high', 2
FROM dd_templates WHERE name = 'Legal Due Diligence' LIMIT 1;

INSERT INTO dd_items (template_id, category, title, description, priority, order_index) 
SELECT id, 'Legal', 'Material Contracts', 'All material contracts and agreements', 'high', 3
FROM dd_templates WHERE name = 'Legal Due Diligence' LIMIT 1;

INSERT INTO dd_items (template_id, category, title, description, priority, order_index) 
SELECT id, 'Legal', 'Litigation History', 'List of past and pending litigation', 'high', 4
FROM dd_templates WHERE name = 'Legal Due Diligence' LIMIT 1;

-- Operations Category Items
INSERT INTO dd_items (template_id, category, title, description, priority, order_index) 
SELECT id, 'Operations', 'Organizational Chart', 'Current organizational structure', 'medium', 1
FROM dd_templates WHERE name = 'Operations Due Diligence' LIMIT 1;

INSERT INTO dd_items (template_id, category, title, description, priority, order_index) 
SELECT id, 'Operations', 'Employee List', 'List of all employees with roles and compensation', 'high', 2
FROM dd_templates WHERE name = 'Operations Due Diligence' LIMIT 1;

INSERT INTO dd_items (template_id, category, title, description, priority, order_index) 
SELECT id, 'Operations', 'Key Customer List', 'Top 10 customers by revenue', 'high', 3
FROM dd_templates WHERE name = 'Operations Due Diligence' LIMIT 1;

INSERT INTO dd_items (template_id, category, title, description, priority, order_index) 
SELECT id, 'Operations', 'Key Supplier List', 'Top 10 suppliers by spend', 'medium', 4
FROM dd_templates WHERE name = 'Operations Due Diligence' LIMIT 1;

-- ============================================================
-- SHAREABLE LINKS TABLES
-- ============================================================

-- 1. Share Links
CREATE TABLE IF NOT EXISTS share_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(64) UNIQUE NOT NULL,
    password_hash VARCHAR(255), -- Optional password protection
    expires_at TIMESTAMPTZ,
    max_views INTEGER,
    allow_download BOOLEAN DEFAULT false,
    allow_print BOOLEAN DEFAULT true,
    views INTEGER DEFAULT 0,
    downloads INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_viewed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_share_links_token ON share_links(token);
CREATE INDEX IF NOT EXISTS idx_share_links_report_id ON share_links(report_id);
CREATE INDEX IF NOT EXISTS idx_share_links_user_id ON share_links(user_id);

-- 2. Share Analytics
CREATE TABLE IF NOT EXISTS share_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    share_link_id UUID NOT NULL REFERENCES share_links(id) ON DELETE CASCADE,
    ip_address VARCHAR(45),
    user_agent TEXT,
    location VARCHAR(255),
    viewed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_share_analytics_share_link_id ON share_analytics(share_link_id);


ALTER TABLE reports ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id);

CREATE INDEX IF NOT EXISTS idx_reports_deleted_at ON reports(deleted_at);