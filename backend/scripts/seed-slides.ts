/**
 * Seed slides into database from a tiles directory and labels CSV.
 *
 * Usage:
 *   npx tsx scripts/seed-slides.ts --tiles-dir /path/to/tiles --labels-csv /path/to/selected_20_labels.csv
 *
 * Defaults (if no flags given):
 *   --tiles-dir  D:/Data/IMP-CRS-2024/tiles
 *   --labels-csv D:/Data/IMP-CRS-2024/selected_20_labels.csv
 *
 * Each subdirectory in tiles-dir that contains a manifest.json is treated as a slide.
 * The labels CSV must have columns: slide_id, label_name (non-neoplastic | low-grade | high-grade).
 */

import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// ---------------------------------------------------------------------------
// CLI argument parsing (minimal, no external deps)
// ---------------------------------------------------------------------------
function getArg(flag: string, fallback: string): string {
  const idx = process.argv.indexOf(flag);
  if (idx !== -1 && idx + 1 < process.argv.length) {
    return process.argv[idx + 1];
  }
  return fallback;
}

// ---------------------------------------------------------------------------
// Label CSV loader
// ---------------------------------------------------------------------------
interface LabelRow {
  slide_id: string;
  label_name: string; // non-neoplastic | low-grade | high-grade
}

function loadLabels(csvPath: string): Map<string, string> {
  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.trim().split('\n');
  const header = lines[0].split(',').map(h => h.trim());

  const idIdx = header.indexOf('slide_id');
  const nameIdx = header.indexOf('label_name');

  if (idIdx === -1 || nameIdx === -1) {
    throw new Error(
      `Labels CSV must have columns 'slide_id' and 'label_name'. Found: ${header.join(', ')}`
    );
  }

  const map = new Map<string, string>();
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim());
    if (cols.length > Math.max(idIdx, nameIdx)) {
      map.set(cols[idIdx], cols[nameIdx]);
    }
  }
  return map;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function seedSlides() {
  const tilesDir = getArg('--tiles-dir', 'D:/Data/IMP-CRS-2024/tiles');
  const labelsCsv = getArg('--labels-csv', 'D:/Data/IMP-CRS-2024/selected_20_labels.csv');

  console.log(`Tiles directory: ${tilesDir}`);
  console.log(`Labels CSV:      ${labelsCsv}`);
  console.log();

  // Load ground-truth labels
  const labels = loadLabels(labelsCsv);
  console.log(`Loaded ${labels.size} labels from CSV`);

  // Discover slides: each subdirectory with a manifest.json
  const entries = fs.readdirSync(tilesDir, { withFileTypes: true });
  const slideDirs = entries
    .filter(e => e.isDirectory())
    .filter(e => fs.existsSync(path.join(tilesDir, e.name, 'manifest.json')))
    .sort((a, b) => a.name.localeCompare(b.name));

  console.log(`Found ${slideDirs.length} slides with manifests\n`);

  if (slideDirs.length === 0) {
    console.error('No slides found. Check --tiles-dir path.');
    await pool.end();
    process.exit(1);
  }

  let seeded = 0;
  let skipped = 0;

  for (const dir of slideDirs) {
    const slideId = dir.name;
    const manifestPath = path.join(tilesDir, slideId, 'manifest.json');
    const groundTruth = labels.get(slideId) ?? null;

    try {
      const manifestContent = fs.readFileSync(manifestPath, 'utf-8');
      const manifestJson = JSON.parse(manifestContent);

      // s3_key_prefix follows the S3 bucket layout: slides/{slide_id}
      const s3KeyPrefix = `slides/${slideId}`;

      await pool.query(`
        INSERT INTO slides (slide_id, s3_key_prefix, manifest_json, ground_truth)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (slide_id)
        DO UPDATE SET s3_key_prefix = $2, manifest_json = $3, ground_truth = $4, uploaded_at = CURRENT_TIMESTAMP
      `, [slideId, s3KeyPrefix, manifestJson, groundTruth]);

      const gtDisplay = groundTruth ?? '(none)';
      console.log(`  ✅ ${slideId}  ground_truth=${gtDisplay}`);
      seeded++;
    } catch (error) {
      console.error(`  ❌ ${slideId}:`, error);
      skipped++;
    }
  }

  console.log(`\nSeeded ${seeded} slides (${skipped} failed)\n`);

  // Display summary table
  const result = await pool.query(
    'SELECT slide_id, s3_key_prefix, ground_truth FROM slides ORDER BY slide_id ASC'
  );

  console.log('┌──────────────┬─────────────────────────┬─────────────────┐');
  console.log('│ Slide ID     │ S3 Key Prefix           │ Ground Truth    │');
  console.log('├──────────────┼─────────────────────────┼─────────────────┤');
  result.rows.forEach(row => {
    const sid = row.slide_id.padEnd(12);
    const s3 = row.s3_key_prefix.padEnd(23);
    const gt = (row.ground_truth ?? '').padEnd(15);
    console.log(`│ ${sid} │ ${s3} │ ${gt} │`);
  });
  console.log('└──────────────┴─────────────────────────┴─────────────────┘');

  await pool.end();
}

seedSlides();
