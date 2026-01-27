-- Migration 005: Fix viewing_attempt race condition
-- Add last_started_at timestamp to track when sessions are actually started
-- This fixes the bug where viewing_attempt wasn't incremented if events weren't uploaded yet

-- Add last_started_at to sessions table
ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS last_started_at TIMESTAMP DEFAULT NULL;

-- Set last_started_at for existing sessions to created_at
-- (Best effort: assume sessions were started when created)
UPDATE sessions
SET last_started_at = created_at
WHERE last_started_at IS NULL;

-- Add index for efficient queries
CREATE INDEX IF NOT EXISTS idx_sessions_last_started ON sessions(last_started_at);

SELECT 'Fixed viewing_attempt race condition by adding last_started_at timestamp' AS status;
