#!/usr/bin/env node

/**
 * Generate a secure JWT secret
 * Run: node scripts/generate-jwt-secret.js
 */

const crypto = require('crypto');

const secret = crypto.randomBytes(32).toString('base64');

console.log('\n=== JWT Secret Generated ===\n');
console.log(secret);
console.log('\n=== Copy this to Netlify Environment Variables ===\n');
console.log('Variable name: JWT_SECRET');
console.log(`Variable value: ${secret}\n`);


