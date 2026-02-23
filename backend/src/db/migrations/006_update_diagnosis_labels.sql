-- Migration 006: Update diagnosis labels to match IMP-CRS-2024 dataset classes
-- Old labels: normal, benign, malignant
-- New labels: non-neoplastic, low-grade, high-grade

BEGIN;

-- 1. Drop old CHECK constraint FIRST (must happen before updating labels)
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_label_check;

-- 2. Migrate existing session labels
UPDATE sessions SET label = 'non-neoplastic' WHERE label = 'normal';
UPDATE sessions SET label = 'low-grade' WHERE label = 'benign';
UPDATE sessions SET label = 'high-grade' WHERE label = 'malignant';

-- 3. Migrate existing event labels
UPDATE events SET label = 'non-neoplastic' WHERE label = 'normal';
UPDATE events SET label = 'low-grade' WHERE label = 'benign';
UPDATE events SET label = 'high-grade' WHERE label = 'malignant';

-- 4. Re-add CHECK constraint with new labels
ALTER TABLE sessions ADD CONSTRAINT sessions_label_check
  CHECK (label IN ('non-neoplastic', 'low-grade', 'high-grade'));

-- 5. Add ground_truth column to slides table
ALTER TABLE slides ADD COLUMN IF NOT EXISTS ground_truth VARCHAR(50)
  CHECK (ground_truth IN ('non-neoplastic', 'low-grade', 'high-grade'));

COMMIT;
