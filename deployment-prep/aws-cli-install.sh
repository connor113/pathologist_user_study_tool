#!/bin/bash
# AWS CLI Installation Script
# Run this on uni PC to install AWS CLI for tile upload

set -e  # Exit on error

echo "=========================================="
echo "AWS CLI Installation for Windows"
echo "=========================================="
echo ""

# Check if running on Windows (Git Bash, WSL, etc.)
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
  echo "✅ Windows detected"
  echo ""
  echo "Please install AWS CLI manually:"
  echo ""
  echo "1. Download AWS CLI installer:"
  echo "   https://awscli.amazonaws.com/AWSCLIV2.msi"
  echo ""
  echo "2. Run the MSI installer"
  echo ""
  echo "3. Verify installation:"
  echo "   aws --version"
  echo ""
  echo "4. Configure AWS credentials:"
  echo "   aws configure"
  echo ""
  exit 0
fi

# For Linux/Mac (if running via WSL on uni PC)
echo "Installing AWS CLI for Linux/WSL..."
echo ""

# Download AWS CLI v2
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"

# Unzip
unzip awscliv2.zip

# Install
sudo ./aws/install

# Clean up
rm -rf awscliv2.zip aws/

# Verify
echo ""
echo "✅ AWS CLI installed successfully!"
echo ""
aws --version

echo ""
echo "=========================================="
echo "Next Steps:"
echo "=========================================="
echo ""
echo "Configure AWS credentials:"
echo "  aws configure"
echo ""
echo "You will need:"
echo "  - AWS Access Key ID (from IAM user)"
echo "  - AWS Secret Access Key (from IAM user)"
echo "  - Default region: us-east-1 (or your bucket region)"
echo "  - Default output format: json"
echo ""
