/**
 * Seed slides into the database from S3/CloudFront manifests
 * Run: node scripts/seed-slides.js
 * Requires DATABASE_URL and CLOUDFRONT_URL env vars
 */

const { Pool } = require('pg');

const CLOUDFRONT_URL = process.env.CLOUDFRONT_URL || 'https://d28izxa5ffe64k.cloudfront.net';
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL required');
  process.exit(1);
}

const slides = [
  'CRC_0170', 'CRC_0423', 'CRC_0645', 'CRC_0908', 'CRC_1459',
  'CRC_1472', 'CRC_2000', 'CRC_2103', 'CRC_2144', 'CRC_2198',
  'CRC_2341', 'CRC_2593', 'CRC_2696', 'CRC_2739', 'CRC_2749',
  'CRC_3060', 'CRC_3109', 'CRC_3138', 'CRC_3148', 'CRC_4240'
];

async function main() {
  const pool = new Pool({ 
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  let seeded = 0;
  let skipped = 0;

  for (const slideId of slides) {
    try {
      // Check if already exists
      const existing = await pool.query('SELECT id FROM slides WHERE slide_id = $1', [slideId]);
      if (existing.rows.length > 0) {
        console.log(`[SKIP] ${slideId} already exists`);
        skipped++;
        continue;
      }

      // Fetch manifest from CloudFront
      const url = `${CLOUDFRONT_URL}/slides/${slideId}/manifest.json`;
      const res = await fetch(url);
      if (!res.ok) {
        console.error(`[ERROR] Failed to fetch manifest for ${slideId}: ${res.status}`);
        continue;
      }
      const manifest = await res.json();

      // Insert into database
      await pool.query(
        `INSERT INTO slides (slide_id, s3_key_prefix, manifest_json) 
         VALUES ($1, $2, $3)`,
        [slideId, `slides/${slideId}`, JSON.stringify(manifest)]
      );

      console.log(`[OK] ${slideId} (${manifest.level0_width}x${manifest.level0_height})`);
      seeded++;
    } catch (err) {
      console.error(`[ERROR] ${slideId}:`, err.message);
    }
  }

  console.log(`\nDone: ${seeded} seeded, ${skipped} skipped`);
  await pool.end();
}

main();
