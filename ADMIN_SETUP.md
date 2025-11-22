# Admin User Setup - COMPLETE

## Registration Status: DISABLED ✅

User registration has been disabled. No one can register new accounts through the UI.

## Admin User Created

The admin user has been set up with the following credentials:

- **Email:** `chriswdixon@gmail.com`
- **Password:** `Jc%cnaHa8Xnhe8w!u%64452!Ha$&iV&2W27o$tpc7jpSHEmMp7`
- **Role:** `admin`
- **Name:** `Chris Dixon`

## How to Create the User in Your Database

### Option 1: Run SQL in Neon.tech (Fastest)

1. Go to your Neon.tech dashboard
2. Open SQL Editor
3. Copy and paste the contents of `migrations/create-admin-chriswdixon.sql`
4. Click "Run"
5. Verify the user was created

### Option 2: Use Node.js Script

If you have DATABASE_URL set:

```bash
export DATABASE_URL="your-neon-connection-string"
npm run create-admin
```

## Login

After creating the user in your database:

1. Visit: `https://chriswdixon.github.io/chriswdixon-blog/admin/login.html`
2. Enter email: `chriswdixon@gmail.com`
3. Enter password: `Jc%cnaHa8Xnhe8w!u%64452!Ha$&iV&2W27o$tpc7jpSHEmMp7`
4. Click "Login"

## SQL File Location

The SQL to create the admin user is in:
- `migrations/create-admin-chriswdixon.sql`

Just copy and paste it into your Neon.tech SQL Editor and run it!

## Verification

To verify the user exists, run this SQL:

```sql
SELECT id, email, name, role, created_at FROM users WHERE email = 'chriswdixon@gmail.com';
```

You should see the admin user details.

