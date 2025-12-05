-- Migration 002: add dzi_level to events

ALTER TABLE events
ADD COLUMN IF NOT EXISTS dzi_level INTEGER;

CREATE INDEX IF NOT EXISTS idx_events_dzi_level ON events(dzi_level);

SELECT 'Added dzi_level column to events table' AS status;

