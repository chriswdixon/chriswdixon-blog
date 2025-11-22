#!/usr/bin/env node

/**
 * Create admin user script
 * Usage: node scripts/create-admin-user.js
 * 
 * Creates an admin user in the database
 * Requires DATABASE_URL environment variable
 */

const { Pool } = require('pg');
const bcrypt = require('bcrypt');
require('dotenv').config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is required');
  console.error('Set it with: export DATABASE_URL="your-connection-string"');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('sslmode=require') ? { rejectUnauthorized: false } : false
});

async function createAdminUser() {
  const email = 'chriswdixon@gmail.com';
  const password = 'Jc%cnaHa8Xnhe8w!u%64452!Ha$&iV&2W27o$tpc7jpSHEmMp7';
  const name = 'Chris Dixon';
  const role = 'admin';

  try {
    console.log('Connecting to database...');
    
    // Check if user already exists
    const existing = await pool.query('SELECT id, email, role FROM users WHERE email = $1', [email]);
    
    if (existing.rows.length > 0) {
      const user = existing.rows[0];
      console.log(`\nUser already exists:`);
      console.log(`  Email: ${user.email}`);
      console.log(`  Role: ${user.role}`);
      console.log(`  ID: ${user.id}`);
      console.log(`\nTo update the password, delete this user first or use SQL directly.`);
      process.exit(0);
    }

    // Hash password
    console.log('Hashing password...');
    const passwordHash = await bcrypt.hash(password, 10);

    // Create admin user
    console.log('Creating admin user...');
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, name, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, name, role, created_at`,
      [email, passwordHash, name, role]
    );

    const user = result.rows[0];
    
    console.log('\n✅ Admin user created successfully!');
    console.log('\nUser details:');
    console.log(`  Email: ${user.email}`);
    console.log(`  Name: ${user.name}`);
    console.log(`  Role: ${user.role}`);
    console.log(`  ID: ${user.id}`);
    console.log(`  Created: ${user.created_at}`);
    console.log('\nYou can now log in at: /admin/login.html');
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error creating admin user:');
    console.error(error.message);
    console.error('\nFull error:', error);
    await pool.end();
    process.exit(1);
  }
}

createAdminUser();

