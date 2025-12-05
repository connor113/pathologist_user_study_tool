-- Migration 003: add notes column to events

ALTER TABLE events
ADD COLUMN IF NOT EXISTS notes TEXT;

SELECT 'Added notes column to events table' AS status;

