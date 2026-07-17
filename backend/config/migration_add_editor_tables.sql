-- ============================================================
-- MIGRATION: Editor Tables for Interactive Report Editor
-- Run with: npm run migrate
-- ============================================================

-- 1. EDITOR DRAFTS - Auto-save user's work
CREATE TABLE IF NOT EXISTS editor_drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    draft_data JSONB NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    saved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    saved_by UUID REFERENCES users(id),
    UNIQUE(report_id, version)
);

CREATE INDEX IF NOT EXISTS idx_editor_drafts_report_id ON editor_drafts(report_id);
CREATE INDEX IF NOT EXISTS idx_editor_drafts_saved_at ON editor_drafts(saved_at);

-- 2. VERSION HISTORY - Full snapshot history
CREATE TABLE IF NOT EXISTS report_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    version_data JSONB NOT NULL,
    version_number INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES users(id),
    comment TEXT,
    UNIQUE(report_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_report_versions_report_id ON report_versions(report_id);
CREATE INDEX IF NOT EXISTS idx_report_versions_created_at ON report_versions(created_at);

-- 3. CUSTOM CATEGORIES - User-defined categories
CREATE TABLE IF NOT EXISTS custom_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(7) DEFAULT '#6B7280',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_custom_categories_user_id ON custom_categories(user_id);

-- ============================================================
-- Migrate existing transactions to include editor metadata
-- ============================================================

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS editor_notes TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS last_edited_at TIMESTAMPTZ;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS last_edited_by UUID REFERENCES users(id);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_manually_edited BOOLEAN DEFAULT false;