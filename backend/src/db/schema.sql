-- Database Schema for Pathologist User Study
-- V2 Multi-User Application
-- 
-- NOTE: Cell indices (i, j) have been removed. We now track exact click 
-- coordinates (click_x0, click_y0) which allows extraction of any size 
-- patches centered on the click point.

-- Users table: Pathologists and admins
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('pathologist', 'admin')),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Slides table: WSI metadata and S3 storage info
CREATE TABLE slides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slide_id VARCHAR(255) UNIQUE NOT NULL,
  s3_key_prefix VARCHAR(500) NOT NULL,
  manifest_json JSONB NOT NULL,
  uploaded_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  ground_truth VARCHAR(50) CHECK (ground_truth IN ('non-neoplastic', 'low-grade', 'high-grade'))
);

-- Sessions table: User-slide review sessions
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slide_id UUID NOT NULL REFERENCES slides(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMPTZ,
  label VARCHAR(50) CHECK (label IN ('non-neoplastic', 'low-grade', 'high-grade')),
  UNIQUE(user_id, slide_id)  -- One session per user per slide
);

-- Events table: Interaction logs
-- All coordinates are in level-0 (full resolution) pixel space
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  ts_iso8601 TIMESTAMPTZ NOT NULL,
  event VARCHAR(50) NOT NULL,
  
  -- Zoom state
  zoom_level NUMERIC,           -- Magnification (2.5, 5, 10, 20, 40)
  dzi_level INTEGER,            -- DZI pyramid level index
  
  -- Click position (only for cell_click events)
  click_x0 NUMERIC,             -- Exact click X in level-0 coords
  click_y0 NUMERIC,             -- Exact click Y in level-0 coords
  
  -- Viewport state (captured at time of event)
  center_x0 NUMERIC,            -- Viewport center X
  center_y0 NUMERIC,            -- Viewport center Y
  vbx0 NUMERIC,                 -- Viewport bottom-left X
  vby0 NUMERIC,                 -- Viewport bottom-left Y
  vtx0 NUMERIC,                 -- Viewport top-right X
  vty0 NUMERIC,                 -- Viewport top-right Y
  
  -- Display info
  container_w INTEGER,          -- Browser container width
  container_h INTEGER,          -- Browser container height
  dpr NUMERIC,                  -- Device pixel ratio
  
  -- Metadata
  app_version VARCHAR(50),
  label VARCHAR(50),            -- Diagnosis label (for label_select, slide_next)
  notes TEXT                    -- Pathologist notes (for slide_next)
);

-- Indexes for common queries
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_slide_id ON sessions(slide_id);
CREATE INDEX idx_events_session_id ON events(session_id);
CREATE INDEX idx_events_timestamp ON events(ts_iso8601);
CREATE INDEX idx_events_dzi_level ON events(dzi_level);

