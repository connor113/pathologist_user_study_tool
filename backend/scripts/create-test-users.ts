/**
 * Create test users for development
 * Run with: npx ts-node scripts/create-test-users.ts
 */

import bcrypt from 'bcrypt';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function createTestUsers() {
  console.log('Creating test users...');
  
  const users = [
    {
      username: 'admin',
      password: 'admin123',
      role: 'admin'
    },
    {
      username: 'pathologist1',
      password: 'patho123',
      role: 'pathologist'
    },
    {
      username: 'pathologist2',
      password: 'patho123',
      role: 'pathologist'
    }
  ];
  
  for (const user of users) {
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
      
      console.log(`✅ Created/updated user: ${user.username} (${user.role})`);
    } catch (error) {
      console.error(`❌ Failed to create user ${user.username}:`, error);
    }
  }
  
  console.log('\n📝 Test User Credentials:');
  console.log('┌─────────────────┬──────────────┬─────────────┐');
  console.log('│ Username        │ Password     │ Role        │');
  console.log('├─────────────────┼──────────────┼─────────────┤');
  console.log('│ admin           │ admin123     │ admin       │');
  console.log('│ pathologist1    │ patho123     │ pathologist │');
  console.log('│ pathologist2    │ patho123     │ pathologist │');
  console.log('└─────────────────┴──────────────┴─────────────┘');
  
  await pool.end();
}

createTestUsers();

