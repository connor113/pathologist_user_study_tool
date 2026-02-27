-- Migration 001 (Railway): Initial schema
-- Cleaned for cloud PostgreSQL (no \c commands, no database creation)

-- Users table: Pathologists and admins
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('pathologist', 'admin')),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Slides table: WSI metadata and S3 storage info
CREATE TABLE IF NOT EXISTS slides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slide_id VARCHAR(255) UNIQUE NOT NULL,
  s3_key_prefix VARCHAR(500) NOT NULL,
  manifest_json JSONB NOT NULL,
  uploaded_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Sessions table: User-slide review sessions
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slide_id UUID NOT NULL REFERENCES slides(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMPTZ,
  label VARCHAR(50) CHECK (label IN ('normal', 'benign', 'malignant')),
  UNIQUE(user_id, slide_id)
);

-- Events table: Interaction logs
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
  notes TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_slide_id ON sessions(slide_id);
CREATE INDEX IF NOT EXISTS idx_events_session_id ON events(session_id);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(ts_iso8601);
CREATE INDEX IF NOT EXISTS idx_events_dzi_level ON events(dzi_level);
