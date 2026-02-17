/**
 * Test database setup script
 * Run with: npx tsx test/setup-db.ts
 *
 * Creates the pathology_study_test database and runs all migrations.
 * Requires a running PostgreSQL instance at localhost:5432.
 */

import { Pool } from 'pg';

const DB_NAME = 'pathology_study_test';

async function setupTestDatabase() {
  // Connect to default postgres database to create test DB
  const adminPool = new Pool({
    connectionString: 'postgresql://postgres:postgres@localhost:5432/postgres',
  });

  try {
    // Drop and recreate test database
    console.log(`Dropping database ${DB_NAME} if it exists...`);
    await adminPool.query(`DROP DATABASE IF EXISTS ${DB_NAME}`);

    console.log(`Creating database ${DB_NAME}...`);
    await adminPool.query(`CREATE DATABASE ${DB_NAME}`);

    console.log(`Database ${DB_NAME} created.`);
  } finally {
    await adminPool.end();
  }

  // Connect to test database and run migrations
  const testPool = new Pool({
    connectionString: `postgresql://postgres:postgres@localhost:5432/${DB_NAME}`,
  });

  try {
    console.log('Running migrations...');

    // Migration 001: Core tables
    await testPool.query(`
      CREATE TABLE users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL CHECK (role IN ('pathologist', 'admin')),
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE slides (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        slide_id VARCHAR(255) UNIQUE NOT NULL,
        s3_key_prefix VARCHAR(500) NOT NULL,
        manifest_json JSONB NOT NULL,
        uploaded_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        slide_id UUID NOT NULL REFERENCES slides(id) ON DELETE CASCADE,
        started_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMPTZ,
        label VARCHAR(50),
        UNIQUE(user_id, slide_id)
      );

      CREATE TABLE events (
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

      CREATE INDEX idx_sessions_user_id ON sessions(user_id);
      CREATE INDEX idx_sessions_slide_id ON sessions(slide_id);
      CREATE INDEX idx_events_session_id ON events(session_id);
      CREATE INDEX idx_events_timestamp ON events(ts_iso8601);
      CREATE INDEX idx_events_dzi_level ON events(dzi_level);
    `);
    console.log('  001_initial.sql ✓');

    // Migration 002: dzi_level already included in 001

    // Migration 003: notes already included in 001

    // Migration 004: viewing_attempt
    await testPool.query(`
      ALTER TABLE sessions ADD COLUMN IF NOT EXISTS current_attempt INTEGER DEFAULT 1;
      ALTER TABLE events ADD COLUMN IF NOT EXISTS viewing_attempt INTEGER DEFAULT 1;
      CREATE INDEX IF NOT EXISTS idx_events_viewing_attempt ON events(session_id, viewing_attempt);
    `);
    console.log('  004_add_viewing_attempt.sql ✓');

    // Migration 005: last_started_at
    await testPool.query(`
      ALTER TABLE sessions ADD COLUMN IF NOT EXISTS last_started_at TIMESTAMP DEFAULT NULL;
      CREATE INDEX IF NOT EXISTS idx_sessions_last_started ON sessions(last_started_at);
    `);
    console.log('  005_fix_viewing_attempt_race_condition.sql ✓');

    // Migration 006: Updated labels + ground_truth
    await testPool.query(`
      ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_label_check;
      ALTER TABLE sessions ADD CONSTRAINT sessions_label_check
        CHECK (label IN ('non-neoplastic', 'low-grade', 'high-grade'));
      ALTER TABLE slides ADD COLUMN IF NOT EXISTS ground_truth VARCHAR(50)
        CHECK (ground_truth IN ('non-neoplastic', 'low-grade', 'high-grade'));
    `);
    console.log('  006_update_diagnosis_labels.sql ✓');

    console.log('\nTest database setup complete!');
  } finally {
    await testPool.end();
  }
}

setupTestDatabase().catch((err) => {
  console.error('Failed to set up test database:', err);
  process.exit(1);
});
