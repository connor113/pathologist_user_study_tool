/**
 * Seed 50 additional easy slides into the production Railway database.
 * 
 * This fetches manifests from CloudFront and inserts them (ON CONFLICT DO NOTHING).
 * Safe to run multiple times.
 * 
 * Usage (from backend/ directory):
 *   DATABASE_URL="postgresql://..." npx tsx ../scripts/seed_additional_50.ts
 * 
 * Or set DATABASE_URL in environment first.
 */

const CF_URL = "https://d28izxa5ffe64k.cloudfront.net";

const ADDITIONAL_50: Array<{ id: string; groundTruth: string }> = [
  { id: "CRC_0005", groundTruth: "non-neoplastic" },
  { id: "CRC_0100", groundTruth: "low-grade" },
  { id: "CRC_0133", groundTruth: "non-neoplastic" },
  { id: "CRC_0258", groundTruth: "non-neoplastic" },
  { id: "CRC_0492", groundTruth: "non-neoplastic" },
  { id: "CRC_0510", groundTruth: "non-neoplastic" },
  { id: "CRC_0564", groundTruth: "non-neoplastic" },
  { id: "CRC_0716", groundTruth: "high-grade" },
  { id: "CRC_0720", groundTruth: "high-grade" },
  { id: "CRC_0766", groundTruth: "low-grade" },
  { id: "CRC_0891", groundTruth: "high-grade" },
  { id: "CRC_1083", groundTruth: "non-neoplastic" },
  { id: "CRC_1265", groundTruth: "high-grade" },
  { id: "CRC_1270", groundTruth: "non-neoplastic" },
  { id: "CRC_1308", groundTruth: "low-grade" },
  { id: "CRC_1353", groundTruth: "low-grade" },
  { id: "CRC_1568", groundTruth: "low-grade" },
  { id: "CRC_1800", groundTruth: "high-grade" },
  { id: "CRC_1979", groundTruth: "high-grade" },
  { id: "CRC_1983", groundTruth: "high-grade" },
  { id: "CRC_2068", groundTruth: "non-neoplastic" },
  { id: "CRC_2091", groundTruth: "low-grade" },
  { id: "CRC_2130", groundTruth: "high-grade" },
  { id: "CRC_2218", groundTruth: "high-grade" },
  { id: "CRC_2274", groundTruth: "low-grade" },
  { id: "CRC_2293", groundTruth: "high-grade" },
  { id: "CRC_2398", groundTruth: "high-grade" },
  { id: "CRC_2518", groundTruth: "non-neoplastic" },
  { id: "CRC_2530", groundTruth: "low-grade" },
  { id: "CRC_2538", groundTruth: "low-grade" },
  { id: "CRC_2629", groundTruth: "high-grade" },
  { id: "CRC_2646", groundTruth: "low-grade" },
  { id: "CRC_2721", groundTruth: "high-grade" },
  { id: "CRC_2870", groundTruth: "high-grade" },
  { id: "CRC_2935", groundTruth: "non-neoplastic" },
  { id: "CRC_2963", groundTruth: "non-neoplastic" },
  { id: "CRC_3039", groundTruth: "high-grade" },
  { id: "CRC_3266", groundTruth: "low-grade" },
  { id: "CRC_3289", groundTruth: "non-neoplastic" },
  { id: "CRC_3322", groundTruth: "non-neoplastic" },
  { id: "CRC_3478", groundTruth: "low-grade" },
  { id: "CRC_3607", groundTruth: "non-neoplastic" },
  { id: "CRC_3609", groundTruth: "non-neoplastic" },
  { id: "CRC_3682", groundTruth: "low-grade" },
  { id: "CRC_3815", groundTruth: "low-grade" },
  { id: "CRC_4000", groundTruth: "high-grade" },
  { id: "CRC_4048", groundTruth: "low-grade" },
  { id: "CRC_4062", groundTruth: "low-grade" },
  { id: "CRC_4186", groundTruth: "low-grade" },
  { id: "CRC_4269", groundTruth: "high-grade" },
];

import pg from "pg";
const { Pool } = pg;

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("ERROR: DATABASE_URL not set");
    console.error("Usage: DATABASE_URL='postgresql://...' npx tsx ../scripts/seed_additional_50.ts");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

  // Check current count
  const countRes = await pool.query("SELECT COUNT(*) as count FROM slides");
  console.log(`Current slides in DB: ${countRes.rows[0].count}`);

  let seeded = 0;
  let skipped = 0;
  let failed = 0;

  for (const { id, groundTruth } of ADDITIONAL_50) {
    try {
      // Fetch manifest from CloudFront
      const res = await fetch(`${CF_URL}/slides/${id}/manifest.json`);
      if (!res.ok) {
        console.error(`  ${id} — manifest fetch failed (HTTP ${res.status})`);
        failed++;
        continue;
      }
      const manifest = await res.json();

      // Insert (skip if already exists)
      const insertRes = await pool.query(
        `INSERT INTO slides (slide_id, s3_key_prefix, manifest_json, ground_truth) 
         VALUES ($1, $2, $3::jsonb, $4) 
         ON CONFLICT (slide_id) DO NOTHING
         RETURNING slide_id`,
        [id, `slides/${id}`, JSON.stringify(manifest), groundTruth]
      );

      if (insertRes.rowCount && insertRes.rowCount > 0) {
        seeded++;
        console.log(`  ${id} — seeded (${groundTruth})`);
      } else {
        skipped++;
        console.log(`  ${id} — already exists, skipped`);
      }
    } catch (err: any) {
      console.error(`  ${id} — ERROR: ${err.message}`);
      failed++;
    }
  }

  // Final count
  const finalRes = await pool.query("SELECT COUNT(*) as count FROM slides");
  console.log(`\nDone! Seeded: ${seeded}, Skipped: ${skipped}, Failed: ${failed}`);
  console.log(`Total slides in DB: ${finalRes.rows[0].count}`);

  await pool.end();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
