-- Create Admin User: chriswdixon@gmail.com
-- Run this SQL in your Neon.tech SQL Editor
-- This will create the admin user with the correct password hash

INSERT INTO users (email, password_hash, name, role)
VALUES (
  'chriswdixon@gmail.com',
  '$2b$10$25qrUkGmTFs4IhO0ZJ9iNe2fFNRuOtt7ZE/FJ591LV4uTYBMS30Wi',
  'Chris Dixon',
  'admin'
)
ON CONFLICT (email) DO UPDATE
SET password_hash = EXCLUDED.password_hash,
    role = 'admin',
    name = EXCLUDED.name;

-- Verify user was created
SELECT id, email, name, role, created_at FROM users WHERE email = 'chriswdixon@gmail.com';

