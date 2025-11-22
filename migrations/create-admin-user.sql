-- Create Admin User
-- Run this SQL in your Neon.tech SQL Editor
-- Replace the password_hash with the actual bcrypt hash
-- 
-- To generate the bcrypt hash, run:
-- node scripts/create-admin-user.js
-- (after setting DATABASE_URL)
--
-- Or use an online bcrypt generator with 10 rounds

-- This is a PLACEHOLDER - you need to generate the actual bcrypt hash
-- The password is: Jc%cnaHa8Xnhe8w!u%64452!Ha$&iV&2W27o$tpc7jpSHEmMp7
-- 
-- Use the Node.js script (create-admin-user.js) to properly hash it

INSERT INTO users (email, password_hash, name, role)
VALUES (
  'chriswdixon@gmail.com',
  '$2b$10$YOUR_BCRYPT_HASH_HERE', -- Replace with actual bcrypt hash
  'Chris Dixon',
  'admin'
)
ON CONFLICT (email) DO UPDATE
SET password_hash = EXCLUDED.password_hash,
    role = 'admin',
    name = EXCLUDED.name;

