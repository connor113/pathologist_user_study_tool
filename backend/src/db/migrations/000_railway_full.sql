-- Full schema for Railway deployment (single file, no psql commands)
-- Combines migrations 001-006

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('pathologist', 'admin')),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Slides table
CREATE TABLE IF NOT EXISTS slides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slide_id VARCHAR(255) UNIQUE NOT NULL,
  s3_key_prefix VARCHAR(500) NOT NULL,
  manifest_json JSONB NOT NULL,
  ground_truth VARCHAR(50) CHECK (ground_truth IN ('non-neoplastic', 'low-grade', 'high-grade')),
  uploaded_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slide_id UUID NOT NULL REFERENCES slides(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMPTZ,
  label VARCHAR(50) CHECK (label IN ('non-neoplastic', 'low-grade', 'high-grade')),
  current_attempt INTEGER DEFAULT 1,
  last_started_at TIMESTAMPTZ DEFAULT NULL,
  UNIQUE(user_id, slide_id)
);

-- Events table
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  ts_iso8601 TIMESTAMPTZ NOT NULL,
  event VARCHAR(50) NOT NULL,
  zoom_level NUMERIC,
  dzi_level INTEGER,
  click_x0 NUMERIC,
  click_y0 NUMERIC,
  center_x0 NUMERIC,
  center_y0 NUMERIC,
  vbx0 NUMERIC,
  vby0 NUMERIC,
  vtx0 NUMERIC,
  vty0 NUMERIC,
  container_w INTEGER,
  container_h INTEGER,
  dpr NUMERIC,
  app_version VARCHAR(50),
  label VARCHAR(50),
  notes TEXT,
  viewing_attempt INTEGER DEFAULT 1
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_slide_id ON sessions(slide_id);
CREATE INDEX IF NOT EXISTS idx_sessions_last_started ON sessions(last_started_at);
CREATE INDEX IF NOT EXISTS idx_events_session_id ON events(session_id);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(ts_iso8601);
CREATE INDEX IF NOT EXISTS idx_events_dzi_level ON events(dzi_level);
CREATE INDEX IF NOT EXISTS idx_events_viewing_attempt ON events(session_id, viewing_attempt);
