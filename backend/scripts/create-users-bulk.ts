/**
 * Bulk User Creation from CSV
 * 
 * Usage:
 *   npx ts-node scripts/create-users-bulk.ts --csv users.csv
 * 
 * CSV Format:
 *   username,password,role
 *   pathologist1,SecurePass123,pathologist
 *   pathologist2,SecurePass456,pathologist
 *   admin_backup,AdminPass789,admin
 * 
 * Features:
 * - Reads CSV file with user data
 * - Hashes passwords with bcrypt (10 salt rounds)
 * - Upserts users (insert or update if exists)
 * - Validates role (must be 'pathologist' or 'admin')
 * - Skips invalid rows with warnings
 * - Generates summary table of created users
 */

import bcrypt from 'bcrypt';
import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

/**
 * User data from CSV
 */
interface UserData {
  username: string;
  password: string;
  role: 'pathologist' | 'admin';
}

/**
 * Parse CSV file into user data
 * Validates format and skips invalid rows
 */
function parseCSV(filePath: string): UserData[] {
  const users: UserData[] = [];
  const errors: string[] = [];
  
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim() !== '');
    
    // Check header
    if (lines.length === 0) {
      console.error('❌ Error: CSV file is empty');
      process.exit(1);
    }
    
    const header = lines[0].trim().toLowerCase();
    if (header !== 'username,password,role') {
      console.error('❌ Error: Invalid CSV header. Expected: username,password,role');
      console.error(`   Found: ${header}`);
      process.exit(1);
    }
    
    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line === '') continue; // Skip empty lines
      
      const parts = line.split(',').map(p => p.trim());
      
      if (parts.length !== 3) {
        errors.push(`Line ${i + 1}: Invalid format (expected 3 columns, got ${parts.length})`);
        continue;
      }
      
      const [username, password, role] = parts;
      
      // Validate username
      if (!username || username.length === 0) {
        errors.push(`Line ${i + 1}: Username is required`);
        continue;
      }
      
      if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        errors.push(`Line ${i + 1}: Username "${username}" contains invalid characters (use only letters, numbers, underscore)`);
        continue;
      }
      
      // Validate password
      if (!password || password.length === 0) {
        errors.push(`Line ${i + 1}: Password is required for user "${username}"`);
        continue;
      }
      
      if (password.length < 6) {
        errors.push(`Line ${i + 1}: Password for user "${username}" is too short (minimum 6 characters)`);
        continue;
      }
      
      // Validate role
      if (role !== 'pathologist' && role !== 'admin') {
        errors.push(`Line ${i + 1}: Invalid role "${role}" for user "${username}" (must be 'pathologist' or 'admin')`);
        continue;
      }
      
      // Valid user data
      users.push({ username, password, role });
    }
    
    // Report errors
    if (errors.length > 0) {
      console.log('\n⚠️  Warnings - Skipped invalid rows:');
      errors.forEach(error => console.log(`   ${error}`));
      console.log('');
    }
    
    return users;
    
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      console.error(`❌ Error: File not found: ${filePath}`);
    } else {
      console.error('❌ Error reading CSV file:', (error as Error).message);
    }
    process.exit(1);
  }
}

/**
 * Create or update user in database
 * Uses upsert to handle existing users
 */
async function createUser(user: UserData): Promise<boolean> {
  try {
    // Hash password
    const passwordHash = await bcrypt.hash(user.password, 10);
    
    // Upsert user (insert or update if exists)
    await pool.query(`
      INSERT INTO users (username, password_hash, role)
      VALUES ($1, $2, $3)
      ON CONFLICT (username) 
      DO UPDATE SET password_hash = $2, role = $3
    `, [user.username, passwordHash, user.role]);
    
    return true;
    
  } catch (error) {
    console.error(`   ❌ Failed to create user ${user.username}:`, (error as Error).message);
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Bulk User Creation from CSV');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // Parse command line arguments
  const args = process.argv.slice(2);
  const csvArgIndex = args.indexOf('--csv');
  
  if (csvArgIndex === -1 || !args[csvArgIndex + 1]) {
    console.error('❌ Error: Missing --csv argument\n');
    console.log('Usage:');
    console.log('  npx ts-node scripts/create-users-bulk.ts --csv users.csv\n');
    console.log('CSV Format:');
    console.log('  username,password,role');
    console.log('  pathologist1,SecurePass123,pathologist');
    console.log('  pathologist2,SecurePass456,pathologist');
    console.log('  admin_backup,AdminPass789,admin\n');
    process.exit(1);
  }
  
  const csvPath = args[csvArgIndex + 1];
  const absolutePath = path.resolve(csvPath);
  
  console.log(`📄 Reading CSV file: ${csvPath}\n`);
  
  // Parse CSV
  const users = parseCSV(absolutePath);
  
  if (users.length === 0) {
    console.error('❌ Error: No valid users found in CSV file');
    process.exit(1);
  }
  
  console.log(`📊 Found ${users.length} valid user(s) to create\n`);
  
  // Create users
  console.log('🔨 Creating users...\n');
  
  let successCount = 0;
  let failCount = 0;
  
  for (const user of users) {
    const success = await createUser(user);
    if (success) {
      console.log(`   ✅ Created/updated user: ${user.username} (${user.role})`);
      successCount++;
    } else {
      failCount++;
    }
  }
  
  // Summary
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Summary');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log(`✅ Successfully created: ${successCount} user(s)`);
  if (failCount > 0) {
    console.log(`❌ Failed: ${failCount} user(s)`);
  }
  
  // Print credential table
  if (successCount > 0) {
    console.log('\n📝 Created Users:\n');
    console.log('┌─────────────────────┬──────────────────────┬─────────────┐');
    console.log('│ Username            │ Password             │ Role        │');
    console.log('├─────────────────────┼──────────────────────┼─────────────┤');
    
    users.forEach(user => {
      const username = user.username.padEnd(19);
      const password = user.password.padEnd(20);
      const role = user.role.padEnd(11);
      console.log(`│ ${username} │ ${password} │ ${role} │`);
    });
    
    console.log('└─────────────────────┴──────────────────────┴─────────────┘');
    
    console.log('\n⚠️  Security Reminder:');
    console.log('   - Passwords are hashed in the database');
    console.log('   - Delete the CSV file after import (contains plain-text passwords)');
    console.log('   - Share credentials securely with users\n');
  }
  
  // Close database connection
  await pool.end();
  
  // Exit with appropriate code
  process.exit(failCount > 0 ? 1 : 0);
}

// Run main function
main().catch(error => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
