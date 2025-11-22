-- Create Admin User: chriswdixon@gmail.com
-- Run this SQL in your Neon.tech SQL Editor
-- This will create the admin user with the correct password hash
-- 
-- Login credentials:
-- Email: chriswdixon@gmail.com
-- Password: Jc%cnaHa8Xnhe8w!u%64452!Ha$&iV&2W27o$tpc7jpSHEmMp7

-- First, check if users table exists
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users';

-- If users table exists, run this to create/update the admin user:
INSERT INTO users (email, password_hash, name, role)
VALUES (
  'chriswdixon@gmail.com',
  '$2b$10$dII0R2lG3x/06/87r/aHNu4joUpTPs8B8pZEVLdqRUrjYOw3OXFra',
  'Chris Dixon',
  'admin'
)
ON CONFLICT (email) DO UPDATE
SET password_hash = EXCLUDED.password_hash,
    role = 'admin',
    name = EXCLUDED.name;

-- Verify user was created
SELECT id, email, name, role, created_at FROM users WHERE email = 'chriswdixon@gmail.com';

