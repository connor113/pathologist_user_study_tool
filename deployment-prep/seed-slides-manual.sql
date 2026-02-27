-- Manual Slide Seeding SQL
-- Use this if you can't run the TypeScript seed script
-- Run this in Railway PostgreSQL query editor or via psql

-- =============================================================================
-- INSTRUCTIONS
-- =============================================================================
-- 1. For each slide, you need the manifest.json content
-- 2. Replace placeholders with actual values:
--    - SLIDE_ID: e.g., 'slide_001' or 'CRC_test_005'
--    - S3_KEY_PREFIX: e.g., 'slides/slide_001' (matches S3 path)
--    - MANIFEST_JSON: Full manifest JSON from manifest.json file
-- 3. Run each INSERT statement

-- =============================================================================
-- TEMPLATE
-- =============================================================================

-- Example: Insert slide with manifest
INSERT INTO slides (slide_id, s3_key_prefix, manifest_json)
VALUES (
  'SLIDE_ID',  -- Replace with actual slide ID
  'slides/SLIDE_ID',  -- Replace with S3 prefix (without _files)
  '{
    "slide_id": "SLIDE_ID",
    "level0_width": 147184,
    "level0_height": 49960,
    "tile_size": 256,
    "format": "jpeg",
    "overlap": 0,
    "level_count": 15,
    "levels": [
      {"level": 0, "width": 147184, "height": 49960, "tiles_x": 575, "tiles_y": 195},
      {"level": 1, "width": 73592, "height": 24980, "tiles_x": 288, "tiles_y": 98},
      ...more levels...
    ]
  }'::jsonb  -- Replace with actual manifest JSON
)
ON CONFLICT (slide_id) DO UPDATE
SET s3_key_prefix = EXCLUDED.s3_key_prefix,
    manifest_json = EXCLUDED.manifest_json,
    uploaded_at = CURRENT_TIMESTAMP;

-- =============================================================================
-- HOW TO GET MANIFEST JSON
-- =============================================================================
-- Option 1: On uni PC where tiles are stored
--   1. Navigate to: D:\Data\pathology_tiles\slide_001_files\
--   2. Open: manifest.json
--   3. Copy entire JSON content
--   4. Paste into INSERT statement above (replacing {...} placeholder)
--
-- Option 2: From S3 (if you uploaded manifest files)
--   1. Go to S3 bucket → slides/slide_001_files/manifest.json
--   2. Download and copy content
--
-- Option 3: Generate from slide metadata (if you have Python script)
--   python generate_manifest.py slide_001.svs

-- =============================================================================
-- EXAMPLE: Actual slide insert (REPLACE WITH YOUR DATA)
-- =============================================================================

-- Example slide 1
INSERT INTO slides (slide_id, s3_key_prefix, manifest_json)
VALUES (
  'test_slide',
  'slides/test_slide',
  '{
    "slide_id": "test_slide",
    "level0_width": 147184,
    "level0_height": 49960,
    "tile_size": 256,
    "format": "jpeg",
    "overlap": 0,
    "level_count": 15,
    "levels": [
      {"level": 0, "width": 147184, "height": 49960, "tiles_x": 575, "tiles_y": 195},
      {"level": 1, "width": 73592, "height": 24980, "tiles_x": 288, "tiles_y": 98},
      {"level": 2, "width": 36796, "height": 12490, "tiles_x": 144, "tiles_y": 49},
      {"level": 3, "width": 18398, "height": 6245, "tiles_x": 72, "tiles_y": 25},
      {"level": 4, "width": 9199, "height": 3122, "tiles_x": 36, "tiles_y": 13},
      {"level": 5, "width": 4599, "height": 1561, "tiles_x": 18, "tiles_y": 7},
      {"level": 6, "width": 2299, "height": 780, "tiles_x": 9, "tiles_y": 4},
      {"level": 7, "width": 1149, "height": 390, "tiles_x": 5, "tiles_y": 2},
      {"level": 8, "width": 574, "height": 195, "tiles_x": 3, "tiles_y": 1},
      {"level": 9, "width": 287, "height": 97, "tiles_x": 2, "tiles_y": 1},
      {"level": 10, "width": 143, "height": 48, "tiles_x": 1, "tiles_y": 1},
      {"level": 11, "width": 71, "height": 24, "tiles_x": 1, "tiles_y": 1},
      {"level": 12, "width": 35, "height": 12, "tiles_x": 1, "tiles_y": 1},
      {"level": 13, "width": 17, "height": 6, "tiles_x": 1, "tiles_y": 1},
      {"level": 14, "width": 8, "height": 3, "tiles_x": 1, "tiles_y": 1}
    ]
  }'::jsonb
)
ON CONFLICT (slide_id) DO UPDATE
SET s3_key_prefix = EXCLUDED.s3_key_prefix,
    manifest_json = EXCLUDED.manifest_json,
    uploaded_at = CURRENT_TIMESTAMP;

-- =============================================================================
-- VERIFICATION
-- =============================================================================

-- Check inserted slides
SELECT 
  slide_id,
  s3_key_prefix,
  manifest_json->>'level_count' as level_count,
  manifest_json->>'level0_width' as width,
  manifest_json->>'level0_height' as height,
  uploaded_at
FROM slides
ORDER BY uploaded_at DESC;

-- Count slides
SELECT COUNT(*) as total_slides FROM slides;

-- =============================================================================
-- BULK INSERT (If you have all manifests)
-- =============================================================================

-- Insert multiple slides at once
-- Replace with your actual slide data
INSERT INTO slides (slide_id, s3_key_prefix, manifest_json) VALUES
  ('slide_001', 'slides/slide_001', '{"slide_id": "slide_001", ...}'::jsonb),
  ('slide_002', 'slides/slide_002', '{"slide_id": "slide_002", ...}'::jsonb),
  ('slide_003', 'slides/slide_003', '{"slide_id": "slide_003", ...}'::jsonb)
ON CONFLICT (slide_id) DO UPDATE
SET s3_key_prefix = EXCLUDED.s3_key_prefix,
    manifest_json = EXCLUDED.manifest_json,
    uploaded_at = CURRENT_TIMESTAMP;

-- =============================================================================
-- TROUBLESHOOTING
-- =============================================================================

-- If insert fails with "invalid JSON":
--   1. Validate JSON: https://jsonlint.com
--   2. Ensure single quotes around JSON: '{ ... }'
--   3. Ensure ::jsonb cast at end
--
-- If insert fails with "duplicate key":
--   - This is OK if using ON CONFLICT (it will update instead)
--   - Check with: SELECT * FROM slides WHERE slide_id = 'your_slide_id';
--
-- If slide not showing in frontend:
--   1. Check slide exists: SELECT * FROM slides;
--   2. Check manifest has correct structure
--   3. Check S3 tiles exist at s3_key_prefix path
--   4. Test CloudFront URL: https://CLOUDFRONT/slides/slide_001/files/14/0_0.jpeg

-- =============================================================================
-- NOTES
-- =============================================================================

-- S3 path mapping:
--   Database: s3_key_prefix = 'slides/slide_001'
--   S3 bucket: s3://YOUR-BUCKET/slides/slide_001/files/0/0_0.jpeg
--   CloudFront: https://CLOUDFRONT/slides/slide_001/files/0/0_0.jpeg
--
-- The backend constructs full tile URLs as:
--   ${CLOUDFRONT_URL}/${s3_key_prefix}/files/${level}/${x}_${y}.jpeg
