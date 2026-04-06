# ============================================================================
# TILE + UPLOAD 50 NEW EASY SLIDES
# Run on Uni PC (where the SVS files + AWS CLI live)
# 
# Usage: Right-click → Run with PowerShell, or:
#   cd C:\Users\2005348\Documents\GitHub\pathologist_user_study_tool
#   powershell -ExecutionPolicy Bypass -File scripts\tile_and_upload_50.ps1
# ============================================================================

$ErrorActionPreference = "Stop"

# --- CONFIGURATION ---
$DATA_ROOT    = "D:\Data\IMP-CRS-2024"
$REPO_ROOT    = $PSScriptRoot | Split-Path    # pathologist_user_study_tool root
$CRC_REPO     = Join-Path (Split-Path $REPO_ROOT) "crc-research-engine"
$SLIDE_IDS    = Join-Path $CRC_REPO "training\analysis\user_study_selection\additional_easy_50_ids.txt"
$TILES_DIR    = Join-Path $REPO_ROOT "tiles"
$S3_BUCKET    = "pathology-study-tiles"
$S3_REGION    = "eu-west-2"
$CF_URL       = "https://d28izxa5ffe64k.cloudfront.net"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  TILE + UPLOAD 50 NEW EASY SLIDES" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# --- VALIDATION ---
if (-Not (Test-Path $SLIDE_IDS)) {
    Write-Host "ERROR: Slide IDs file not found: $SLIDE_IDS" -ForegroundColor Red
    Write-Host "Make sure crc-research-engine repo is up to date (git pull)" -ForegroundColor Yellow
    exit 1
}

if (-Not (Test-Path $DATA_ROOT)) {
    Write-Host "ERROR: Data root not found: $DATA_ROOT" -ForegroundColor Red
    exit 1
}

$ids = Get-Content $SLIDE_IDS | Where-Object { $_.Trim() -ne "" }
Write-Host "Found $($ids.Count) slide IDs to process" -ForegroundColor Green
Write-Host ""

# ============================================================================
# STEP 1: TILE THE 50 SLIDES
# ============================================================================
Write-Host "STEP 1: Tiling slides..." -ForegroundColor Yellow
Write-Host "  This takes ~1-2 min per slide (~50-100 min total)" -ForegroundColor Gray
Write-Host "  Safe to interrupt — use --resume flag to continue" -ForegroundColor Gray
Write-Host ""

Set-Location $REPO_ROOT

# Use the existing tile_200_slides.py with the 50-slide list
python scripts/tile_200_slides.py `
    --slide_ids $SLIDE_IDS `
    --data_root $DATA_ROOT `
    --output_dir $TILES_DIR `
    --tile_size 512 `
    --resume

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Tiling failed!" -ForegroundColor Red
    Write-Host "You can re-run this script — --resume will skip completed slides" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "Tiling complete!" -ForegroundColor Green
Write-Host ""

# ============================================================================
# STEP 2: UPLOAD TO S3
# ============================================================================
Write-Host "STEP 2: Uploading tiles to S3..." -ForegroundColor Yellow
Write-Host ""

$uploaded = 0
$failed = 0

foreach ($id in $ids) {
    $slideDir = Join-Path $TILES_DIR $id
    if (-Not (Test-Path $slideDir)) {
        Write-Host "  SKIP $id — no tiles found" -ForegroundColor Yellow
        $failed++
        continue
    }

    Write-Host "  Uploading $id..." -NoNewline
    
    aws s3 sync $slideDir "s3://$S3_BUCKET/slides/$id/" `
        --region $S3_REGION `
        --quiet `
        --size-only
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host " OK" -ForegroundColor Green
        $uploaded++
    } else {
        Write-Host " FAILED" -ForegroundColor Red
        $failed++
    }
}

Write-Host ""
Write-Host "Upload complete: $uploaded OK, $failed failed" -ForegroundColor $(if ($failed -eq 0) { "Green" } else { "Yellow" })
Write-Host ""

# ============================================================================
# STEP 3: VERIFY A FEW TILES VIA CLOUDFRONT
# ============================================================================
Write-Host "STEP 3: Verifying CloudFront access..." -ForegroundColor Yellow

$testIds = $ids | Select-Object -First 3
foreach ($id in $testIds) {
    $testUrl = "$CF_URL/slides/$id/manifest.json"
    try {
        $response = Invoke-WebRequest -Uri $testUrl -UseBasicParsing -TimeoutSec 10
        if ($response.StatusCode -eq 200) {
            Write-Host "  $id — accessible" -ForegroundColor Green
        } else {
            Write-Host "  $id — HTTP $($response.StatusCode)" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "  $id — NOT accessible yet (CloudFront may need a few minutes)" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  ALL DONE!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps (Vector will handle):"
Write-Host "  1. Tell Vector 'tiles are uploaded'"
Write-Host "  2. Vector will seed the 50 new slides into the production DB"
Write-Host "  3. Vector will create pathologist accounts"
Write-Host ""
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
