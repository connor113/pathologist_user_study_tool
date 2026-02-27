# PowerShell script for uploading DZI tiles to S3 on Windows
# Run this script on uni PC where tiles are stored

# =============================================================================
# CONFIGURATION - EDIT THESE VALUES
# =============================================================================

$S3_BUCKET = "pathology-study-tiles-YOUR-NAME"
$TILES_DIR = "D:\Data\pathology_tiles"
$S3_PREFIX = "slides"
$AWS_REGION = "us-east-1"

# =============================================================================
# VALIDATION
# =============================================================================

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "DZI Tiles S3 Upload Script (PowerShell)" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Configuration:"
Write-Host "  Bucket: s3://$S3_BUCKET"
Write-Host "  Source: $TILES_DIR"
Write-Host "  Destination: s3://$S3_BUCKET/$S3_PREFIX/"
Write-Host "  Region: $AWS_REGION"
Write-Host ""

# Check if AWS CLI is installed
try {
    $awsVersion = aws --version
    Write-Host "✅ AWS CLI installed: $awsVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Error: AWS CLI is not installed" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install AWS CLI:"
    Write-Host "  https://awscli.amazonaws.com/AWSCLIV2.msi"
    Write-Host ""
    exit 1
}

# Check if AWS credentials are configured
try {
    $identity = aws sts get-caller-identity --query 'Account' --output text 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Not configured"
    }
    Write-Host "✅ AWS credentials configured" -ForegroundColor Green
    Write-Host "   Account: $identity"
} catch {
    Write-Host "❌ Error: AWS credentials not configured" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please configure AWS credentials:"
    Write-Host "  aws configure"
    Write-Host ""
    exit 1
}
Write-Host ""

# Check if tiles directory exists
if (-Not (Test-Path -Path $TILES_DIR)) {
    Write-Host "❌ Error: Tiles directory not found: $TILES_DIR" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please update `$TILES_DIR in this script to point to your tiles location"
    Write-Host ""
    exit 1
}

Write-Host "✅ Tiles directory found" -ForegroundColor Green
Write-Host ""

# Count tile directories
$tileDirs = Get-ChildItem -Path $TILES_DIR -Directory -Filter "*_files"
Write-Host "📁 Found $($tileDirs.Count) slide directories (ending in _files)"
Write-Host ""

# Confirm before upload
$confirm = Read-Host "Continue with upload? (y/n)"
if ($confirm -ne "y") {
    Write-Host "Upload cancelled"
    exit 0
}

# =============================================================================
# UPLOAD
# =============================================================================

Write-Host ""
Write-Host "🚀 Starting upload..." -ForegroundColor Yellow
Write-Host ""

# Use aws s3 sync for efficient upload
# Note: PowerShell doesn't support line continuation with \, so we use backtick `
aws s3 sync $TILES_DIR s3://$S3_BUCKET/$S3_PREFIX/ `
  --region $AWS_REGION `
  --exclude "*.dzi" `
  --exclude "manifest.json" `
  --include "*_files/*" `
  --storage-class STANDARD

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "==========================================" -ForegroundColor Green
    Write-Host "✅ Upload Complete!" -ForegroundColor Green
    Write-Host "==========================================" -ForegroundColor Green
    Write-Host ""
    
    # Verify upload
    Write-Host "Verifying upload..."
    $objectCount = (aws s3 ls s3://$S3_BUCKET/$S3_PREFIX/ --recursive | Measure-Object).Count
    Write-Host "📊 Total objects in S3: $objectCount"
    Write-Host ""
    
    # Calculate size
    $totalSize = (Get-ChildItem -Path $TILES_DIR -Recurse | Measure-Object -Property Length -Sum).Sum
    $totalGB = [math]::Round($totalSize / 1GB, 2)
    Write-Host "💰 Estimated storage cost: ~`$0.023/GB/month"
    Write-Host "   Total size: $totalGB GB"
    Write-Host ""
    
    Write-Host "Next steps:"
    Write-Host "1. Verify tiles are accessible via S3 console"
    Write-Host "2. Test CloudFront URL: https://YOUR-CLOUDFRONT-URL/slides/SLIDE_ID/files/14/0_0.jpeg"
    Write-Host "3. Seed slide metadata into database (see seed-slides-manual.sql)"
    Write-Host ""
} else {
    Write-Host "❌ Upload failed with error code: $LASTEXITCODE" -ForegroundColor Red
    exit $LASTEXITCODE
}

# =============================================================================
# USAGE NOTES
# =============================================================================
# 
# Directory structure expected:
#   D:\Data\pathology_tiles\
#     ├── slide_001_files\
#     │   ├── 0\
#     │   │   └── 0_0.jpeg
#     │   ├── 1\
#     │   │   └── 0_0.jpeg
#     │   └── ...
#     ├── slide_002_files\
#     └── ...
# 
# Uploaded to S3 as:
#   s3://YOUR-BUCKET/slides/
#     ├── slide_001_files/
#     │   ├── 0/
#     │   │   └── 0_0.jpeg
#     │   └── ...
#     └── ...
# 
# CloudFront URL format:
#   https://YOUR-CLOUDFRONT-URL/slides/slide_001_files/14/0_0.jpeg
# 
# =============================================================================
