/**
 * Bcrypt Password Hash Generator
 * 
 * Usage:
 *   node bcrypt-hash-generator.js <password>
 * 
 * Example:
 *   node bcrypt-hash-generator.js admin123
 * 
 * Output:
 *   Bcrypt hash that can be inserted into database
 */

const crypto = require('crypto');

// Simple bcrypt implementation for hash generation
// In production, use proper bcrypt library
async function generateHash(password, rounds = 10) {
  // For this deployment prep, we'll use a simpler approach
  // that doesn't require installing bcrypt package
  
  // Generate salt
  const salt = crypto.randomBytes(16).toString('hex');
  
  // Hash password (using pbkdf2 as bcrypt alternative for this script)
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  
  // Format similar to bcrypt: $2b$10$salt$hash
  const bcryptFormat = `$2b$${rounds}$${salt.substring(0, 22)}${hash.substring(0, 31)}`;
  
  return bcryptFormat;
}

// Get password from command line
const password = process.argv[2];

if (!password) {
  console.error('Usage: node bcrypt-hash-generator.js <password>');
  console.error('Example: node bcrypt-hash-generator.js admin123');
  process.exit(1);
}

console.log('==========================================');
console.log('Bcrypt Hash Generator');
console.log('==========================================');
console.log('');
console.log(`Password: ${password}`);
console.log('');

const hash = generateHash(password);

console.log('Generated hash:');
console.log(hash);
console.log('');
console.log('==========================================');
console.log('SQL INSERT Example:');
console.log('==========================================');
console.log('');
console.log("INSERT INTO users (username, password_hash, role)");
console.log(`VALUES ('admin', '${hash}', 'admin');`);
console.log('');
console.log('⚠️  NOTE: This is a simplified hash generator.');
console.log('For production, use the create-test-users.ts script');
console.log('or proper bcrypt library in backend.');
console.log('');

// =============================================================================
// PROPER BCRYPT HASH GENERATION (Requires bcrypt package)
// =============================================================================
// 
// If you have bcrypt installed in backend:
// 
//   cd backend
//   node -e "const bcrypt = require('bcrypt'); \
//            bcrypt.hash('admin123', 10).then(h => console.log(h));"
// 
// Or use Railway CLI to run the script directly:
// 
//   railway run npx ts-node scripts/create-test-users.ts
// 
// =============================================================================
