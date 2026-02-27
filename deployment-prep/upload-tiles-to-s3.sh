#!/bin/bash
# Upload DZI tiles to S3
# Run this script on uni PC where tiles are stored

set -e  # Exit on error

# =============================================================================
# CONFIGURATION - EDIT THESE VALUES
# =============================================================================

# S3 bucket name (from deployment checklist)
S3_BUCKET="pathology-study-tiles-YOUR-NAME"

# Local tiles directory (adjust to your path)
# Windows path example: /d/Data/pathology_tiles/
# Linux path example: /path/to/tiles/
TILES_DIR="/d/Data/pathology_tiles"

# S3 destination prefix (where tiles will be stored)
S3_PREFIX="slides"

# AWS region (must match bucket region)
AWS_REGION="us-east-1"

# =============================================================================
# VALIDATION
# =============================================================================

echo "=========================================="
echo "DZI Tiles S3 Upload Script"
echo "=========================================="
echo ""
echo "Configuration:"
echo "  Bucket: s3://$S3_BUCKET"
echo "  Source: $TILES_DIR"
echo "  Destination: s3://$S3_BUCKET/$S3_PREFIX/"
echo "  Region: $AWS_REGION"
echo ""

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
  echo "❌ Error: AWS CLI is not installed"
  echo ""
  echo "Please install AWS CLI first:"
  echo "  bash aws-cli-install.sh"
  echo ""
  exit 1
fi

# Check if AWS credentials are configured
if ! aws sts get-caller-identity &> /dev/null; then
  echo "❌ Error: AWS credentials not configured"
  echo ""
  echo "Please configure AWS credentials:"
  echo "  aws configure"
  echo ""
  exit 1
fi

echo "✅ AWS CLI configured"
echo "   Account: $(aws sts get-caller-identity --query 'Account' --output text)"
echo ""

# Check if tiles directory exists
if [ ! -d "$TILES_DIR" ]; then
  echo "❌ Error: Tiles directory not found: $TILES_DIR"
  echo ""
  echo "Please update TILES_DIR in this script to point to your tiles location"
  echo ""
  exit 1
fi

echo "✅ Tiles directory found"
echo ""

# Count tile directories
TILE_DIRS=$(find "$TILES_DIR" -maxdepth 1 -type d -name "*_files" | wc -l)
echo "📁 Found $TILE_DIRS slide directories (ending in _files)"
echo ""

# Confirm before upload
read -p "Continue with upload? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Upload cancelled"
  exit 0
fi

# =============================================================================
# UPLOAD
# =============================================================================

echo ""
echo "🚀 Starting upload..."
echo ""

# Use aws s3 sync for efficient upload
# - Skips already-uploaded files (checksum comparison)
# - Uploads only changed/new files
# - Preserves directory structure
# - Shows progress for each file

aws s3 sync "$TILES_DIR" "s3://$S3_BUCKET/$S3_PREFIX/" \
  --region "$AWS_REGION" \
  --exclude "*.dzi" \
  --exclude "manifest.json" \
  --include "*_files/*" \
  --storage-class STANDARD \
  --no-progress

echo ""
echo "=========================================="
echo "✅ Upload Complete!"
echo "=========================================="
echo ""

# Verify upload
echo "Verifying upload..."
TOTAL_OBJECTS=$(aws s3 ls "s3://$S3_BUCKET/$S3_PREFIX/" --recursive | wc -l)
echo "📊 Total objects in S3: $TOTAL_OBJECTS"
echo ""

# Calculate costs (rough estimate)
TOTAL_GB=$(du -sh "$TILES_DIR" | cut -f1)
echo "💰 Estimated storage cost: ~\$0.023/GB/month"
echo "   Total size: $TOTAL_GB"
echo ""

echo "Next steps:"
echo "1. Verify tiles are accessible via S3 console"
echo "2. Test CloudFront URL: https://YOUR-CLOUDFRONT-URL/slides/SLIDE_ID/files/14/0_0.jpeg"
echo "3. Seed slide metadata into database (see seed-slides-manual.sql)"
echo ""

# =============================================================================
# USAGE NOTES
# =============================================================================
# 
# Directory structure expected:
#   $TILES_DIR/
#     ├── slide_001_files/
#     │   ├── 0/
#     │   │   └── 0_0.jpeg
#     │   ├── 1/
#     │   │   └── 0_0.jpeg
#     │   └── ...
#     ├── slide_002_files/
#     └── ...
# 
# Uploaded to S3 as:
#   s3://$S3_BUCKET/slides/
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
