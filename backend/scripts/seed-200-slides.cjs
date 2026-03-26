
const { Pool } = require('pg');
const https = require('https');

const CLOUDFRONT_URL = 'https://d28izxa5ffe64k.cloudfront.net';
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) { console.error('DATABASE_URL required'); process.exit(1); }

const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

const slides = [["CRC_0532", "low-grade"], ["CRC_0580", "low-grade"], ["CRC_0828", "low-grade"], ["CRC_1515", "low-grade"], ["CRC_1529", "low-grade"], ["CRC_2485", "low-grade"], ["CRC_2490", "low-grade"], ["CRC_2714", "low-grade"], ["CRC_2773", "low-grade"], ["CRC_3058", "low-grade"], ["CRC_3211", "low-grade"], ["CRC_3395", "low-grade"], ["CRC_3659", "low-grade"], ["CRC_3947", "low-grade"], ["CRC_4312", "low-grade"], ["CRC_4050", "high-grade"], ["CRC_0114", "high-grade"], ["CRC_3364", "high-grade"], ["CRC_1233", "high-grade"], ["CRC_0919", "high-grade"], ["CRC_3857", "high-grade"], ["CRC_0872", "high-grade"], ["CRC_1119", "high-grade"], ["CRC_0374", "high-grade"], ["CRC_3699", "high-grade"], ["CRC_2611", "low-grade"], ["CRC_2125", "low-grade"], ["CRC_2310", "low-grade"], ["CRC_1505", "low-grade"], ["CRC_3562", "low-grade"], ["CRC_0554", "low-grade"], ["CRC_2460", "low-grade"], ["CRC_0183", "low-grade"], ["CRC_3680", "low-grade"], ["CRC_0632", "low-grade"], ["CRC_0787", "non-neoplastic"], ["CRC_0675", "non-neoplastic"], ["CRC_3127", "non-neoplastic"], ["CRC_2291", "non-neoplastic"], ["CRC_3767", "non-neoplastic"], ["CRC_0489", "non-neoplastic"], ["CRC_2446", "non-neoplastic"], ["CRC_2768", "non-neoplastic"], ["CRC_1615", "non-neoplastic"], ["CRC_3245", "non-neoplastic"], ["CRC_2088", "high-grade"], ["CRC_4013", "low-grade"], ["CRC_0572", "high-grade"], ["CRC_0925", "high-grade"], ["CRC_0860", "low-grade"], ["CRC_2979", "low-grade"], ["CRC_0448", "high-grade"], ["CRC_2525", "high-grade"], ["CRC_3712", "high-grade"], ["CRC_1095", "high-grade"], ["CRC_2715", "non-neoplastic"], ["CRC_4223", "non-neoplastic"], ["CRC_2126", "high-grade"], ["CRC_2368", "high-grade"], ["CRC_1752", "low-grade"], ["CRC_2277", "low-grade"], ["CRC_2684", "low-grade"], ["CRC_2907", "high-grade"], ["CRC_2861", "non-neoplastic"], ["CRC_3423", "high-grade"], ["CRC_1754", "high-grade"], ["CRC_3610", "high-grade"], ["CRC_3017", "high-grade"], ["CRC_3979", "high-grade"], ["CRC_2014", "high-grade"], ["CRC_4303", "high-grade"], ["CRC_2722", "high-grade"], ["CRC_2634", "high-grade"], ["CRC_2637", "low-grade"], ["CRC_3543", "low-grade"], ["CRC_3623", "low-grade"], ["CRC_2632", "low-grade"], ["CRC_1524", "low-grade"], ["CRC_2024", "low-grade"], ["CRC_1824", "low-grade"], ["CRC_3771", "low-grade"], ["CRC_2354", "non-neoplastic"], ["CRC_1042", "non-neoplastic"], ["CRC_3396", "non-neoplastic"], ["CRC_0391", "non-neoplastic"], ["CRC_3010", "non-neoplastic"], ["CRC_1531", "non-neoplastic"], ["CRC_2945", "non-neoplastic"], ["CRC_4427", "non-neoplastic"], ["CRC_2950", "low-grade"], ["CRC_3286", "non-neoplastic"], ["CRC_3168", "low-grade"], ["CRC_0155", "non-neoplastic"], ["CRC_2181", "non-neoplastic"], ["CRC_3748", "low-grade"], ["CRC_0457", "non-neoplastic"], ["CRC_3931", "low-grade"], ["CRC_3973", "low-grade"], ["CRC_3075", "non-neoplastic"], ["CRC_0427", "low-grade"], ["CRC_1837", "high-grade"], ["CRC_1742", "high-grade"], ["CRC_3818", "low-grade"], ["CRC_1659", "low-grade"], ["CRC_1917", "low-grade"], ["CRC_2807", "high-grade"], ["CRC_0740", "non-neoplastic"], ["CRC_2231", "high-grade"], ["CRC_4268", "high-grade"], ["CRC_0132", "high-grade"], ["CRC_1468", "low-grade"], ["CRC_1043", "non-neoplastic"], ["CRC_2450", "non-neoplastic"], ["CRC_2331", "low-grade"], ["CRC_3670", "high-grade"], ["CRC_0844", "low-grade"], ["CRC_1186", "high-grade"], ["CRC_1416", "high-grade"], ["CRC_1444", "non-neoplastic"], ["CRC_3918", "low-grade"], ["CRC_0018", "high-grade"], ["CRC_0652", "high-grade"], ["CRC_1076", "high-grade"], ["CRC_2160", "high-grade"], ["CRC_2678", "non-neoplastic"], ["CRC_4011", "high-grade"], ["CRC_4349", "low-grade"], ["CRC_2563", "high-grade"], ["CRC_3601", "high-grade"], ["CRC_2238", "high-grade"], ["CRC_4046", "high-grade"], ["CRC_2003", "high-grade"], ["CRC_3351", "high-grade"], ["CRC_3642", "low-grade"], ["CRC_3768", "low-grade"], ["CRC_3122", "low-grade"], ["CRC_2474", "low-grade"], ["CRC_3570", "low-grade"], ["CRC_1513", "low-grade"], ["CRC_1553", "non-neoplastic"], ["CRC_1130", "non-neoplastic"], ["CRC_2300", "non-neoplastic"], ["CRC_1906", "non-neoplastic"], ["CRC_0702", "non-neoplastic"], ["CRC_3445", "non-neoplastic"], ["CRC_4239", "high-grade"], ["CRC_0547", "high-grade"], ["CRC_2105", "high-grade"], ["CRC_3470", "high-grade"], ["CRC_2728", "high-grade"], ["CRC_1330", "high-grade"], ["CRC_0350", "high-grade"], ["CRC_3534", "high-grade"], ["CRC_0767", "high-grade"], ["CRC_1192", "high-grade"], ["CRC_3044", "high-grade"], ["CRC_1555", "high-grade"], ["CRC_2617", "high-grade"], ["CRC_4043", "high-grade"], ["CRC_2244", "high-grade"], ["CRC_0123", "high-grade"], ["CRC_1085", "high-grade"], ["CRC_3789", "high-grade"], ["CRC_2750", "low-grade"], ["CRC_0314", "low-grade"], ["CRC_2944", "low-grade"], ["CRC_2442", "low-grade"], ["CRC_2157", "low-grade"], ["CRC_0731", "low-grade"], ["CRC_2183", "low-grade"], ["CRC_1849", "low-grade"], ["CRC_4357", "low-grade"], ["CRC_2301", "low-grade"], ["CRC_3386", "low-grade"], ["CRC_3200", "low-grade"], ["CRC_3588", "low-grade"], ["CRC_0937", "low-grade"], ["CRC_1180", "low-grade"], ["CRC_0069", "low-grade"], ["CRC_2472", "low-grade"], ["CRC_2084", "low-grade"], ["CRC_4318", "non-neoplastic"], ["CRC_0771", "non-neoplastic"], ["CRC_1699", "non-neoplastic"], ["CRC_4263", "non-neoplastic"], ["CRC_0135", "non-neoplastic"], ["CRC_0690", "non-neoplastic"], ["CRC_4245", "non-neoplastic"], ["CRC_4081", "non-neoplastic"], ["CRC_0671", "non-neoplastic"], ["CRC_2854", "non-neoplastic"], ["CRC_0824", "non-neoplastic"], ["CRC_1951", "non-neoplastic"], ["CRC_1003", "non-neoplastic"], ["CRC_0707", "non-neoplastic"], ["CRC_0885", "non-neoplastic"], ["CRC_3071", "non-neoplastic"], ["CRC_0308", "non-neoplastic"], ["CRC_0695", "non-neoplastic"], ["CRC_3014", "low-grade"]];

function fetchManifest(slideId) {
  return new Promise((resolve, reject) => {
    const url = `${CLOUDFRONT_URL}/slides/${slideId}/manifest.json`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } 
        catch (e) { reject(new Error(`Bad manifest for ${slideId}: ${data.substring(0, 100)}`)); }
      });
    }).on('error', reject);
  });
}

async function main() {
  // First, delete old 8-slide data
  const existing = await pool.query('SELECT COUNT(*) as count FROM slides');
  console.log(`Current slides in DB: ${existing.rows[0].count}`);
  
  let inserted = 0, skipped = 0, failed = 0;
  
  for (const [slideId, groundTruth] of slides) {
    try {
      const exists = await pool.query('SELECT id FROM slides WHERE slide_id = $1', [slideId]);
      if (exists.rows.length > 0) { skipped++; continue; }
      
      const manifest = await fetchManifest(slideId);
      const s3Key = `slides/${slideId}`;
      
      await pool.query(
        `INSERT INTO slides (slide_id, s3_key_prefix, manifest_json, ground_truth) VALUES ($1, $2, $3, $4)`,
        [slideId, s3Key, JSON.stringify(manifest), groundTruth]
      );
      inserted++;
      if (inserted % 20 === 0) console.log(`  Inserted ${inserted}...`);
    } catch (e) {
      console.error(`  FAIL ${slideId}: ${e.message}`);
      failed++;
    }
  }
  
  console.log(`Done: ${inserted} inserted, ${skipped} skipped, ${failed} failed`);
  const total = await pool.query('SELECT COUNT(*) as count FROM slides');
  console.log(`Total slides in DB: ${total.rows[0].count}`);
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
