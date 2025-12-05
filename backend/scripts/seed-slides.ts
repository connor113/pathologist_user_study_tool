/**
 * Seed slides into database
 * Run with: npx ts-node scripts/seed-slides.ts
 */

import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function seedSlides() {
  console.log('Seeding slides...');
  
  const slides = [
    {
      slide_id: 'test_slide',
      s3_key_prefix: 'local/test_slide',
      manifest_path: '../../tiles/test_slide_files/manifest.json'
    },
    {
      slide_id: 'CRC_test_005',
      s3_key_prefix: 'local/CRC_test_005',
      manifest_path: '../../tiles/CRC_test_005_files/manifest.json'
    }
  ];
  
  for (const slide of slides) {
    try {
      // Read manifest file
      const manifestPath = path.join(__dirname, slide.manifest_path);
      const manifestContent = fs.readFileSync(manifestPath, 'utf-8');
      const manifestJson = JSON.parse(manifestContent);
      
      // Upsert slide (insert or update if exists)
      await pool.query(`
        INSERT INTO slides (slide_id, s3_key_prefix, manifest_json)
        VALUES ($1, $2, $3)
        ON CONFLICT (slide_id) 
        DO UPDATE SET s3_key_prefix = $2, manifest_json = $3, uploaded_at = CURRENT_TIMESTAMP
      `, [slide.slide_id, slide.s3_key_prefix, manifestJson]);
      
      console.log(`✅ Created/updated slide: ${slide.slide_id}`);
    } catch (error) {
      console.error(`❌ Failed to seed slide ${slide.slide_id}:`, error);
    }
  }
  
  // Display current slides
  const result = await pool.query('SELECT slide_id, s3_key_prefix FROM slides ORDER BY uploaded_at ASC');
  
  console.log('\n📝 Slides in database:');
  console.log('┌─────────────────┬────────────────────┐');
  console.log('│ Slide ID        │ S3 Key Prefix      │');
  console.log('├─────────────────┼────────────────────┤');
  result.rows.forEach(row => {
    const slideIdPadded = row.slide_id.padEnd(15);
    const s3Padded = row.s3_key_prefix.padEnd(18);
    console.log(`│ ${slideIdPadded} │ ${s3Padded} │`);
  });
  console.log('└─────────────────┴────────────────────┘');
  
  await pool.end();
}

seedSlides();

