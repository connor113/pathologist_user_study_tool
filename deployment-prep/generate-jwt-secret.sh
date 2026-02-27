#!/bin/bash
# Generate secure JWT secret for production
# Run this and copy the output to Railway environment variables

echo "=========================================="
echo "JWT Secret Generator"
echo "=========================================="
echo ""
echo "Generating secure 256-bit (32 byte) secret..."
echo ""

# Generate random hex string (32 bytes = 64 hex characters)
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

echo "✅ JWT_SECRET generated:"
echo ""
echo "$JWT_SECRET"
echo ""
echo "=========================================="
echo "Next steps:"
echo "=========================================="
echo "1. Copy the secret above"
echo "2. Go to Railway → Project → Variables"
echo "3. Add variable: JWT_SECRET"
echo "4. Paste the secret value"
echo "5. Save and redeploy"
echo ""
echo "⚠️  SECURITY NOTES:"
echo "  - Never commit this to git"
echo "  - Store in password manager"
echo "  - Use different secrets for dev/prod"
echo "  - Rotate if compromised"
echo ""
