-- Direct SQL to create admin user
-- This requires you to generate the bcrypt hash first
-- 
-- Option 1: Use the Node.js script (recommended):
--   DATABASE_URL="your-connection-string" node scripts/create-admin-user.js
--
-- Option 2: Generate hash online and paste here
--   Visit: https://bcrypt-generator.com/
--   Use 10 rounds
--   Password: Jc%cnaHa8Xnhe8w!u%64452!Ha$&iV&2W27o$tpc7jpSHEmMp7

-- Check if user exists
SELECT id, email, role FROM users WHERE email = 'chriswdixon@gmail.com';

-- If user doesn't exist, create it (replace HASH with actual bcrypt hash):
-- INSERT INTO users (email, password_hash, name, role)
-- VALUES (
--   'chriswdixon@gmail.com',
--   '$2b$10$HASH_HERE',  -- Replace with bcrypt hash from script
--   'Chris Dixon',
--   'admin'
-- )
-- RETURNING id, email, name, role, created_at;

-- To update existing user's password:
-- UPDATE users 
-- SET password_hash = '$2b$10$NEW_HASH_HERE',  -- Replace with new hash
--     role = 'admin'
-- WHERE email = 'chriswdixon@gmail.com';

