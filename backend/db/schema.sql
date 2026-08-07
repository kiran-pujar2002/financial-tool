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

-- ============================================================
-- AI DEAL ASSISTANT TABLES
-- ============================================================

-- 1. Chat Sessions
CREATE TABLE IF NOT EXISTS chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) DEFAULT 'New Chat',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_report_id ON chat_sessions(report_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);

-- 2. Chat Messages
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL, -- 'user' or 'assistant'
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);

-- 3. Report Context (for RAG)
CREATE TABLE IF NOT EXISTS report_context (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    chunk_text TEXT NOT NULL,
    chunk_type VARCHAR(50) NOT NULL, -- 'summary', 'transaction', 'addback', 'metric'
    metadata JSONB,
    embedding vector(1536), -- For pgvector or store as JSON
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_report_context_report_id ON report_context(report_id);

-- ============================================================
-- AI DEAL ASSISTANT TABLES (WITH VECTOR SUPPORT)
-- ============================================================

-- 1. Enable vector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Report Context with Embeddings
CREATE TABLE IF NOT EXISTS report_context (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    chunk_text TEXT NOT NULL,
    chunk_type VARCHAR(50) NOT NULL,
    metadata JSONB,
    embedding vector(1536), -- 👈 1536 for OpenAI embeddings
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_report_context_report_id ON report_context(report_id);

-- 3. Create an Index for Fast Similarity Search
-- Recommended for performance: uses cosine distance
CREATE INDEX ON report_context 
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

    -- ============================================================
-- FINANCIAL MODELING TABLES
-- ============================================================

-- 1. Financial Models
CREATE TABLE IF NOT EXISTS financial_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL DEFAULT 'My Projection',
    description TEXT,
    base_year INTEGER NOT NULL,
    projection_years INTEGER DEFAULT 5,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_financial_models_report_id ON financial_models(report_id);
CREATE INDEX IF NOT EXISTS idx_financial_models_user_id ON financial_models(user_id);

-- 2. Model Scenarios
CREATE TABLE IF NOT EXISTS model_scenarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id UUID NOT NULL REFERENCES financial_models(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL, -- 'Base', 'Best', 'Worst', 'Custom'
    description TEXT,
    assumptions JSONB,
    revenue_growth_rate NUMERIC(5,2),
    ebitda_margin NUMERIC(5,2),
    capex_percentage NUMERIC(5,2),
    working_capital_percentage NUMERIC(5,2),
    tax_rate NUMERIC(5,2) DEFAULT 25.0,
    discount_rate NUMERIC(5,2) DEFAULT 12.0,
    terminal_growth_rate NUMERIC(5,2) DEFAULT 3.0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_model_scenarios_model_id ON model_scenarios(model_id);

-- 3. Model Projections
CREATE TABLE IF NOT EXISTS model_projections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scenario_id UUID NOT NULL REFERENCES model_scenarios(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    revenue NUMERIC(16,2),
    ebitda NUMERIC(16,2),
    sde NUMERIC(16,2),
    net_income NUMERIC(16,2),
    free_cash_flow NUMERIC(16,2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(scenario_id, year)
);

CREATE INDEX IF NOT EXISTS idx_model_projections_scenario_id ON model_projections(scenario_id);


-- ============================================================
-- AUTOMATED NARRATIVE GENERATION TABLES
-- ============================================================

-- 1. Narrative Templates
CREATE TABLE IF NOT EXISTS narrative_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    section VARCHAR(50) NOT NULL, -- 'executive_summary', 'business_overview', 'financial_analysis', etc.
    tone VARCHAR(30) DEFAULT 'professional', -- 'professional', 'concise', 'detailed', 'investor_friendly'
    template_text TEXT NOT NULL, -- Template with {{placeholders}}
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_narrative_templates_user_id ON narrative_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_narrative_templates_section ON narrative_templates(section);

-- 2. Generated Narratives
CREATE TABLE IF NOT EXISTS generated_narratives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    section VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    tone VARCHAR(30) DEFAULT 'professional',
    version INTEGER DEFAULT 1,
    is_published BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_generated_narratives_report_id ON generated_narratives(report_id);
CREATE INDEX IF NOT EXISTS idx_generated_narratives_user_id ON generated_narratives(user_id);

-- 3. Default Templates
INSERT INTO narrative_templates (name, description, section, tone, template_text, is_default) VALUES
('Professional Executive Summary', 'Standard professional tone for executive summaries', 'executive_summary', 'professional', 
'{{business_name}} generated {{revenue}} in revenue for the period, with EBITDA of {{ebitda}} and Seller''s Discretionary Earnings (SDE) of {{sde}}. {{addbacks_summary}} The business operates in the {{industry}} industry and has demonstrated {{growth_summary}}.', true),

('Concise Executive Summary', 'Short and punchy executive summary', 'executive_summary', 'concise',
'{{business_name}}: Revenue {{revenue}}, EBITDA {{ebitda}}, SDE {{sde}}. {{addbacks_count}} add-backs identified.', true),

('Detailed Business Overview', 'Comprehensive business overview for CIM', 'business_overview', 'detailed',
'{{business_name}} is a {{industry}} business with a strong market position. The company has demonstrated consistent performance with revenue of {{revenue}} and EBITDA of {{ebitda}}. {{strengths_summary}}', true),

('Investor-Friendly Overview', 'Overview tailored for potential investors', 'business_overview', 'investor_friendly',
'{{business_name}} presents a compelling investment opportunity in the {{industry}} sector. With {{revenue}} in revenue and {{sde}} in SDE, the business offers {{growth_opportunity}}.', true);

-- 4. Update trigger for updated_at
DROP TRIGGER IF EXISTS trg_narrative_templates_updated_at ON narrative_templates;
CREATE TRIGGER trg_narrative_templates_updated_at BEFORE UPDATE ON narrative_templates
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_generated_narratives_updated_at ON generated_narratives;
CREATE TRIGGER trg_generated_narratives_updated_at BEFORE UPDATE ON generated_narratives
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


    -- ============================================================
-- COMPETITIVE INTELLIGENCE & BENCHMARKING TABLES
-- ============================================================

-- 1. Industry Benchmarks
CREATE TABLE IF NOT EXISTS industry_benchmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    industry VARCHAR(255) NOT NULL UNIQUE,
    sub_industry VARCHAR(255),
    sde_multiple_min NUMERIC(5,2),
    sde_multiple_mid NUMERIC(5,2),
    sde_multiple_max NUMERIC(5,2),
    ebitda_multiple_min NUMERIC(5,2),
    ebitda_multiple_mid NUMERIC(5,2),
    ebitda_multiple_max NUMERIC(5,2),
    revenue_multiple_min NUMERIC(5,2),
    revenue_multiple_mid NUMERIC(5,2),
    revenue_multiple_max NUMERIC(5,2),
    gross_margin_avg NUMERIC(5,2),
    ebitda_margin_avg NUMERIC(5,2),
    sde_margin_avg NUMERIC(5,2),
    revenue_growth_avg NUMERIC(5,2),
    source VARCHAR(500),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_industry_benchmarks_industry ON industry_benchmarks(industry);

-- 2. Default Industry Benchmarks Data
INSERT INTO industry_benchmarks (
    industry, sde_multiple_min, sde_multiple_mid, sde_multiple_max,
    ebitda_multiple_min, ebitda_multiple_mid, ebitda_multiple_max,
    revenue_multiple_min, revenue_multiple_mid, revenue_multiple_max,
    gross_margin_avg, ebitda_margin_avg, sde_margin_avg, revenue_growth_avg
) VALUES
('Retail / Hardware', 2.0, 3.0, 4.5, 3.0, 4.5, 6.0, 0.5, 1.0, 1.5, 35.0, 15.0, 20.0, 8.0),
('Retail / General', 1.8, 2.8, 4.0, 2.5, 4.0, 5.5, 0.4, 0.8, 1.2, 30.0, 12.0, 18.0, 7.0),
('Manufacturing', 2.5, 3.5, 5.0, 3.5, 5.0, 7.0, 0.8, 1.2, 2.0, 40.0, 18.0, 25.0, 10.0),
('Technology', 3.0, 5.0, 8.0, 5.0, 7.0, 10.0, 2.0, 4.0, 6.0, 60.0, 25.0, 35.0, 15.0),
('Healthcare', 2.5, 4.0, 6.0, 4.0, 5.5, 8.0, 1.5, 2.5, 4.0, 45.0, 20.0, 28.0, 12.0),
('Services / Professional', 2.0, 3.0, 5.0, 3.0, 4.5, 7.0, 0.6, 1.0, 1.8, 50.0, 22.0, 30.0, 10.0),
('Hospitality', 1.8, 2.5, 3.5, 2.5, 3.5, 5.0, 0.3, 0.6, 1.0, 25.0, 10.0, 15.0, 6.0),
('Construction', 2.0, 3.0, 4.5, 3.0, 4.0, 6.0, 0.5, 0.8, 1.2, 28.0, 14.0, 20.0, 8.0),
('Food & Beverage', 1.8, 2.8, 4.0, 2.5, 4.0, 5.5, 0.4, 0.8, 1.5, 35.0, 15.0, 22.0, 9.0),
('E-commerce', 2.5, 4.0, 6.0, 4.0, 6.0, 8.0, 1.0, 2.0, 3.5, 45.0, 20.0, 30.0, 20.0)
ON CONFLICT (industry) DO UPDATE SET
    sde_multiple_min = EXCLUDED.sde_multiple_min,
    sde_multiple_mid = EXCLUDED.sde_multiple_mid,
    sde_multiple_max = EXCLUDED.sde_multiple_max,
    ebitda_multiple_min = EXCLUDED.ebitda_multiple_min,
    ebitda_multiple_mid = EXCLUDED.ebitda_multiple_mid,
    ebitda_multiple_max = EXCLUDED.ebitda_multiple_max,
    revenue_multiple_min = EXCLUDED.revenue_multiple_min,
    revenue_multiple_mid = EXCLUDED.revenue_multiple_mid,
    revenue_multiple_max = EXCLUDED.revenue_multiple_max,
    gross_margin_avg = EXCLUDED.gross_margin_avg,
    ebitda_margin_avg = EXCLUDED.ebitda_margin_avg,
    sde_margin_avg = EXCLUDED.sde_margin_avg,
    revenue_growth_avg = EXCLUDED.revenue_growth_avg,
    updated_at = now();

-- 3. Peer Comparison Cache
CREATE TABLE IF NOT EXISTS peer_comparisons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    comparison_data JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_peer_comparisons_report_id ON peer_comparisons(report_id);
CREATE INDEX IF NOT EXISTS idx_peer_comparisons_user_id ON peer_comparisons(user_id);

-- ============================================================
-- MARKETPLACE & NETWORK TABLES
-- ============================================================

-- 1. Marketplace Listings
CREATE TABLE IF NOT EXISTS marketplace_listings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    report_id UUID REFERENCES reports(id) ON DELETE SET NULL,
    business_name VARCHAR(255) NOT NULL,
    industry VARCHAR(100),
    location VARCHAR(255),
    revenue NUMERIC(16,2),
    ebitda NUMERIC(16,2),
    sde NUMERIC(16,2),
    asking_price NUMERIC(16,2),
    description TEXT,
    status VARCHAR(20) DEFAULT 'active', -- active, pending, sold, archived
    is_featured BOOLEAN DEFAULT false,
    views INTEGER DEFAULT 0,
    interests INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketplace_listings_user_id ON marketplace_listings(user_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_status ON marketplace_listings(status);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_industry ON marketplace_listings(industry);

-- 2. Deal Interests (Buyers expressing interest)
CREATE TABLE IF NOT EXISTS marketplace_interests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id UUID NOT NULL REFERENCES marketplace_listings(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message TEXT,
    status VARCHAR(20) DEFAULT 'pending', -- pending, accepted, rejected, withdrawn
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(listing_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_marketplace_interests_listing_id ON marketplace_interests(listing_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_interests_user_id ON marketplace_interests(user_id);

-- 3. Deal Rooms (Private spaces for negotiations)
CREATE TABLE IF NOT EXISTS marketplace_deal_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id UUID NOT NULL REFERENCES marketplace_listings(id) ON DELETE CASCADE,
    buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    broker_id UUID REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'active', -- active, closed, archived
    nda_signed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketplace_deal_rooms_listing_id ON marketplace_deal_rooms(listing_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_deal_rooms_buyer_id ON marketplace_deal_rooms(buyer_id);

-- 4. Deal Room Messages
CREATE TABLE IF NOT EXISTS marketplace_deal_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_room_id UUID NOT NULL REFERENCES marketplace_deal_rooms(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketplace_deal_messages_deal_room_id ON marketplace_deal_messages(deal_room_id);

-- 5. User Roles (Auto-assigned based on activity)
ALTER TABLE users ADD COLUMN IF NOT EXISTS roles TEXT[] DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_status VARCHAR(20) DEFAULT 'unverified'; -- unverified, pending, verified