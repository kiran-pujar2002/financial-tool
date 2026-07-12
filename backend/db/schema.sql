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