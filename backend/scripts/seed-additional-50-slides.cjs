const { Pool } = require('pg');
const https = require('https');

const CLOUDFRONT_URL = 'https://d28izxa5ffe64k.cloudfront.net';
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL required');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const slides = [
  ['CRC_0005', 'non-neoplastic'],
  ['CRC_0100', 'low-grade'],
  ['CRC_0133', 'non-neoplastic'],
  ['CRC_0258', 'non-neoplastic'],
  ['CRC_0492', 'non-neoplastic'],
  ['CRC_0510', 'non-neoplastic'],
  ['CRC_0564', 'non-neoplastic'],
  ['CRC_0716', 'high-grade'],
  ['CRC_0720', 'high-grade'],
  ['CRC_0766', 'low-grade'],
  ['CRC_0891', 'high-grade'],
  ['CRC_1083', 'non-neoplastic'],
  ['CRC_1265', 'high-grade'],
  ['CRC_1270', 'non-neoplastic'],
  ['CRC_1308', 'low-grade'],
  ['CRC_1353', 'low-grade'],
  ['CRC_1568', 'low-grade'],
  ['CRC_1800', 'high-grade'],
  ['CRC_1979', 'high-grade'],
  ['CRC_1983', 'high-grade'],
  ['CRC_2068', 'non-neoplastic'],
  ['CRC_2091', 'low-grade'],
  ['CRC_2130', 'high-grade'],
  ['CRC_2218', 'high-grade'],
  ['CRC_2274', 'low-grade'],
  ['CRC_2293', 'high-grade'],
  ['CRC_2398', 'high-grade'],
  ['CRC_2518', 'non-neoplastic'],
  ['CRC_2530', 'low-grade'],
  ['CRC_2538', 'low-grade'],
  ['CRC_2629', 'high-grade'],
  ['CRC_2646', 'low-grade'],
  ['CRC_2721', 'high-grade'],
  ['CRC_2870', 'high-grade'],
  ['CRC_2935', 'non-neoplastic'],
  ['CRC_2963', 'non-neoplastic'],
  ['CRC_3039', 'high-grade'],
  ['CRC_3266', 'low-grade'],
  ['CRC_3289', 'non-neoplastic'],
  ['CRC_3322', 'non-neoplastic'],
  ['CRC_3478', 'low-grade'],
  ['CRC_3607', 'non-neoplastic'],
  ['CRC_3609', 'non-neoplastic'],
  ['CRC_3682', 'low-grade'],
  ['CRC_3815', 'low-grade'],
  ['CRC_4000', 'high-grade'],
  ['CRC_4048', 'low-grade'],
  ['CRC_4062', 'low-grade'],
  ['CRC_4186', 'low-grade'],
  ['CRC_4269', 'high-grade']
];

function fetchManifest(slideId) {
  return new Promise((resolve, reject) => {
    const url = `${CLOUDFRONT_URL}/slides/${slideId}/manifest.json`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Bad manifest for ${slideId}: ${data.substring(0, 100)}`));
        }
      });
    }).on('error', reject);
  });
}

async function queryWithRetry(sql, params = [], attempts = 5) {
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await pool.query(sql, params);
    } catch (err) {
      lastErr = err;
      const retryable = ['ECONNRESET', 'ETIMEDOUT', 'EPIPE'].includes(err.code);
      if (!retryable || i === attempts) throw err;
      const delay = 1000 * i;
      console.warn(`DB query failed (${err.code}), retrying in ${delay}ms... [${i}/${attempts}]`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

async function main() {
  const existing = await queryWithRetry('SELECT COUNT(*) as count FROM slides');
  console.log(`Current slides in DB: ${existing.rows[0].count}`);

  let inserted = 0, skipped = 0, failed = 0;

  for (const [slideId, groundTruth] of slides) {
    try {
      const exists = await queryWithRetry('SELECT id FROM slides WHERE slide_id = $1', [slideId]);
      if (exists.rows.length > 0) {
        skipped++;
        continue;
      }

      const manifest = await fetchManifest(slideId);
      const s3Key = `slides/${slideId}`;

      await queryWithRetry(
        `INSERT INTO slides (slide_id, s3_key_prefix, manifest_json, ground_truth) VALUES ($1, $2, $3, $4)`,
        [slideId, s3Key, JSON.stringify(manifest), groundTruth]
      );
      inserted++;
      if (inserted % 10 === 0) console.log(`  Inserted ${inserted}...`);
    } catch (e) {
      console.error(`  FAIL ${slideId}: ${e.message}`);
      failed++;
    }
  }

  console.log(`Done: ${inserted} inserted, ${skipped} skipped, ${failed} failed`);
  const total = await queryWithRetry('SELECT COUNT(*) as count FROM slides');
  console.log(`Total slides in DB: ${total.rows[0].count}`);
  await pool.end();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
