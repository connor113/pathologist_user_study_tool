-- Migration 004: Add viewing_attempt tracking
-- Allows differentiating between multiple login sessions for the same (user, slide) pair

-- Add current_attempt counter to sessions table
-- This tracks how many times the user has started viewing this slide
ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS current_attempt INTEGER DEFAULT 1;

-- Add viewing_attempt to events table
-- Each event is tagged with which viewing attempt it belongs to
ALTER TABLE events
ADD COLUMN IF NOT EXISTS viewing_attempt INTEGER DEFAULT 1;

-- Add index for efficient filtering by viewing_attempt
CREATE INDEX IF NOT EXISTS idx_events_viewing_attempt ON events(session_id, viewing_attempt);

SELECT 'Added viewing_attempt tracking to sessions and events tables' AS status;

