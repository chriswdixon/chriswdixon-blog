# Create Admin User

Registration is disabled. Admin users must be created directly in the database.

## Method 1: Using Node.js Script (Recommended)

1. Set your DATABASE_URL environment variable:
   ```bash
   export DATABASE_URL="postgresql://user:password@host/database?sslmode=require"
   ```
   (Get this from your Neon.tech dashboard - Connection Details)

2. Run the script:
   ```bash
   npm run create-admin
   ```

   Or directly:
   ```bash
   node scripts/create-admin-user.js
   ```

3. The script will create:
   - Email: `chriswdixon@gmail.com`
   - Password: `Jc%cnaHa8Xnhe8w!u%64452!Ha$&iV&2W27o$tpc7jpSHEmMp7`
   - Role: `admin`

## Method 2: Using SQL Directly

1. Generate a bcrypt hash for the password:
   - Visit: https://bcrypt-generator.com/
   - Use 10 rounds
   - Password: `Jc%cnaHa8Xnhe8w!u%64452!Ha$&iV&2W27o$tpc7jpSHEmMp7`
   - Copy the hash

2. Go to Neon.tech SQL Editor

3. Run this SQL (replace `HASH_HERE` with the bcrypt hash):
   ```sql
   INSERT INTO users (email, password_hash, name, role)
   VALUES (
     'chriswdixon@gmail.com',
     '$2b$10$HASH_HERE',
     'Chris Dixon',
     'admin'
   )
   ON CONFLICT (email) DO UPDATE
   SET password_hash = EXCLUDED.password_hash,
       role = 'admin',
       name = EXCLUDED.name;
   ```

## Verify User Creation

Run this SQL to check:
```sql
SELECT id, email, name, role, created_at FROM users WHERE email = 'chriswdixon@gmail.com';
```

## Login

After creating the user:
1. Visit: `https://chriswdixon.github.io/chriswdixon-blog/admin/login.html`
2. Email: `chriswdixon@gmail.com`
3. Password: `Jc%cnaHa8Xnhe8w!u%64452!Ha$&iV&2W27o$tpc7jpSHEmMp7`

## Update Password

To change the password later:

1. Use Node.js script (modify the password in `scripts/create-admin-user.js`)

2. Or use SQL:
   - Generate new bcrypt hash
   - Update database:
     ```sql
     UPDATE users 
     SET password_hash = '$2b$10$NEW_HASH_HERE'
     WHERE email = 'chriswdixon@gmail.com';
     ```

