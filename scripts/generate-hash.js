#!/usr/bin/env node

/**
 * Generate bcrypt hash for password
 * Usage: node scripts/generate-hash.js [password]
 */

const bcrypt = require('bcrypt');

const password = process.argv[2] || 'Jc%cnaHa8Xnhe8w!u%64452!Ha$&iV&2W27o$tpc7jpSHEmMp7';

bcrypt.hash(password, 10).then(hash => {
  console.log('\n=== Bcrypt Hash Generated ===\n');
  console.log(hash);
  console.log('\n=== Use this in SQL ===\n');
  console.log(`INSERT INTO users (email, password_hash, name, role)`);
  console.log(`VALUES (`);
  console.log(`  'chriswdixon@gmail.com',`);
  console.log(`  '${hash}',`);
  console.log(`  'Chris Dixon',`);
  console.log(`  'admin'`);
  console.log(`);`);
  console.log('\n');
});

