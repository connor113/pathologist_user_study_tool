/**
 * Test data factories
 * Create slides and events with sensible defaults
 */

import { pool } from './db.js';

let slideCounter = 0;

/**
 * Insert a test slide into the database and return its DB row
 */
export async function createTestSlide(overrides: {
  slide_id?: string;
  s3_key_prefix?: string;
  ground_truth?: string;
  manifest_json?: object;
} = {}): Promise<{ id: string; slide_id: string }> {
  slideCounter++;
  const slideId = overrides.slide_id ?? `test_slide_${slideCounter}`;
  const s3Prefix = overrides.s3_key_prefix ?? `tiles/${slideId}`;
  const manifest = overrides.manifest_json ?? {
    slide_id: slideId,
    level0_width: 98304,
    level0_height: 49152,
    mpp0: 0.25,
    patch_px: 256,
    tile_size: 256,
    overlap: 0,
    anchor: [0, 0],
    alignment_ok: true,
    created_at: '2025-01-01T00:00:00Z',
    dzi_level_count: 18,
    magnification_levels: {
      '40x': 17,
      '20x': 16,
      '10x': 15,
      '5x': 14,
      '2.5x': 13,
    },
  };

  const cols = ['slide_id', 's3_key_prefix', 'manifest_json'];
  const vals: any[] = [slideId, s3Prefix, JSON.stringify(manifest)];
  let paramIndex = vals.length;

  if (overrides.ground_truth) {
    cols.push('ground_truth');
    vals.push(overrides.ground_truth);
    paramIndex++;
  }

  const placeholders = vals.map((_, i) => `$${i + 1}`).join(', ');
  const result = await pool.query(
    `INSERT INTO slides (${cols.join(', ')}) VALUES (${placeholders}) RETURNING id, slide_id`,
    vals
  );

  return result.rows[0];
}

/**
 * Build an event payload for batch upload (does NOT insert into DB)
 */
export function makeEvent(overrides: Record<string, any> = {}): Record<string, any> {
  return {
    ts_iso8601: new Date().toISOString(),
    event: 'cell_click',
    zoom_level: 10,
    dzi_level: 15,
    click_x0: 50000,
    click_y0: 25000,
    center_x0: 50000,
    center_y0: 25000,
    vbx0: 45000,
    vby0: 20000,
    vtx0: 55000,
    vty0: 30000,
    container_w: 1920,
    container_h: 1080,
    dpr: 1,
    app_version: '0.1.0-test',
    viewing_attempt: 1,
    ...overrides,
  };
}
