# Setup Guide - Blog Platform

Follow these steps to get your blog platform up and running.

## Step 1: Update API URL Configuration

1. Open `js/config.js`
2. Find the line that says:
   ```javascript
   window.API_URL = window.API_URL || '';
   ```
3. Set it to your Netlify Functions URL:
   ```javascript
   window.API_URL = 'https://your-site.netlify.app';
   ```
   
   **Note:** You'll get this URL after deploying to Netlify (Step 3). For now, you can leave it empty and update it later.

## Step 2: Set Up Neon.tech Database

### 2.1 Create Neon Account and Project

1. Go to https://neon.tech
2. Sign up for a free account (or log in)
3. Click "Create Project"
4. Choose a name and region
5. Click "Create Project"

### 2.2 Run Database Schema

1. In your Neon project dashboard, click on "SQL Editor" in the left sidebar
2. Open `migrations/schema.sql` from this project
3. Copy the entire contents of the file
4. Paste into the Neon SQL Editor
5. Click "Run" or press `Ctrl+Enter` (or `Cmd+Enter` on Mac)
6. Verify tables were created by checking the "Tables" section in the sidebar

### 2.3 Get Connection String

1. In Neon dashboard, go to "Connection Details"
2. Copy the connection string (it looks like: `postgresql://user:password@host/database?sslmode=require`)
3. **Save this for Step 3** - you'll need it as `DATABASE_URL`

**Alternative:** If you need to modify the connection string format, Neon provides different connection strings for different use cases.

## Step 3: Deploy to Netlify

### 3.1 Push Code to GitHub

1. Create a new repository on GitHub (if you haven't already)
2. Add the remote and push:
   ```bash
   cd blog-platform
   git add .
   git commit -m "Initial commit - Blog platform"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO-NAME.git
   git push -u origin main
   ```

### 3.2 Connect to Netlify

1. Go to https://app.netlify.com
2. Sign in with your GitHub account
3. Click "Add new site" > "Import an existing project"
4. Select your GitHub repository
5. Netlify will auto-detect settings:
   - **Build command:** `echo 'No build needed'`
   - **Publish directory:** `.` (root)
6. Click "Deploy site"

### 3.3 Configure Environment Variables

1. In Netlify dashboard, go to **Site settings** > **Environment variables**
2. Click "Add a variable" and add:

   **DATABASE_URL**
   - Value: Your Neon.tech connection string from Step 2.3
   - Example: `postgresql://user:password@host.neon.tech/dbname?sslmode=require`

   **JWT_SECRET**
   - Value: Generate a random secret string (use a password generator or run: `openssl rand -base64 32`)
   - Example: `your-super-secret-jwt-key-change-this-to-random-string`

3. Click "Save"

### 3.4 Get Your Netlify URL

1. After deployment, your site will be available at:
   - `https://YOUR-SITE-NAME.netlify.app`
2. **Update `js/config.js`** with this URL:
   ```javascript
   window.API_URL = 'https://YOUR-SITE-NAME.netlify.app';
   ```
3. Commit and push the change:
   ```bash
   git add js/config.js
   git commit -m "Update API URL"
   git push
   ```

### 3.5 Verify Netlify Functions

1. Visit `https://YOUR-SITE-NAME.netlify.app/.netlify/functions/api/api/blog/posts`
2. You should see an empty array `[]` (no posts yet)
3. If you see an error, check Netlify Functions logs:
   - Go to **Functions** tab in Netlify dashboard
   - Check the logs for errors

## Step 4: Deploy to GitHub Pages

### 4.1 Enable GitHub Pages

1. Go to your GitHub repository
2. Click **Settings** > **Pages**
3. Under "Source", select:
   - Branch: `main` (or your default branch)
   - Folder: `/ (root)`
4. Click "Save"
5. Wait a few minutes for GitHub Pages to build

### 4.2 Get Your GitHub Pages URL

Your site will be available at:
- `https://YOUR-USERNAME.github.io/YOUR-REPO-NAME`

### 4.3 Update API URL (Again)

1. Open `js/config.js`
2. Make sure `window.API_URL` points to your **Netlify Functions URL** (not GitHub Pages)
   ```javascript
   window.API_URL = 'https://YOUR-SITE-NAME.netlify.app';
   ```
3. Commit and push:
   ```bash
   git add js/config.js
   git commit -m "Configure API URL for GitHub Pages"
   git push
   ```

### 4.4 Configure CORS (If Needed)

If you encounter CORS errors:

1. Open `netlify/functions/api.js`
2. Find the CORS configuration (around line 95)
3. Add your GitHub Pages domain:
   ```javascript
   origin: [
     /\.github\.io$/,
     /\.githubpages\.com$/,
     'https://YOUR-USERNAME.github.io',  // Add your specific domain
     // ... other origins
   ]
   ```
4. Commit and push - Netlify will redeploy automatically

## Step 5: Create Admin User

### 5.1 Register Admin Account

1. Visit your GitHub Pages site: `https://YOUR-USERNAME.github.io/YOUR-REPO-NAME/admin/login.html`
2. Click "Register" link
3. Enter:
   - Email: Your email address
   - Password: A strong password (min 8 characters)
   - Name: Your name (optional)
4. Click "Register"

**Note:** The first user registered becomes an admin automatically.

### 5.2 Verify Admin Access

1. After registration, you'll be redirected to the admin dashboard
2. You should see:
   - Dashboard stats
   - Navigation menu
   - "New Post" option

### 5.3 Create Your First Post

1. Click "New Post" in the admin sidebar
2. Fill in the form:
   - **Title:** Your post title
   - **Content:** Write in Markdown format
   - **Category:** (Create one first in Categories section if needed)
   - **Status:** Select "Published"
   - **Featured:** Check if you want it featured
3. Click "Save Post"
4. Visit your blog homepage to see your post!

## Troubleshooting

### CORS Errors

**Problem:** Browser shows CORS error when loading posts.

**Solution:**
1. Make sure `window.API_URL` in `js/config.js` points to your Netlify Functions URL
2. Check that your GitHub Pages domain is in the CORS allowlist in `netlify/functions/api.js`
3. Verify the API URL includes the protocol (`https://`)

### Database Connection Errors

**Problem:** API returns 500 errors or "Internal server error".

**Solution:**
1. Check Netlify Functions logs:
   - Go to Netlify dashboard > Functions tab
   - Check logs for database connection errors
2. Verify `DATABASE_URL` environment variable in Netlify:
   - Go to Site settings > Environment variables
   - Make sure the connection string is correct
   - Check for extra spaces or quotes
3. Test your Neon database connection:
   - Try connecting via Neon SQL Editor
   - Verify the connection string format

### Authentication Not Working

**Problem:** Can't log in or register.

**Solution:**
1. Check that `JWT_SECRET` is set in Netlify environment variables
2. Clear browser localStorage:
   - Open browser console (F12)
   - Run: `localStorage.clear()`
   - Try again
3. Check Netlify Functions logs for authentication errors

### Posts Not Showing

**Problem:** Blog homepage is empty.

**Solution:**
1. Check that posts are marked as "Published" (not "Draft")
2. Verify the API is returning posts:
   - Visit: `https://YOUR-NETLIFY-URL/.netlify/functions/api/api/blog/posts`
   - Should return a JSON array
3. Check browser console for JavaScript errors
4. Verify `window.API_URL` is set correctly

### GitHub Pages Not Updating

**Problem:** Changes aren't showing on GitHub Pages.

**Solution:**
1. Make sure you've pushed changes to the `main` branch
2. Wait 2-3 minutes for GitHub Pages to rebuild
3. Hard refresh your browser (Ctrl+F5 or Cmd+Shift+R)
4. Check GitHub repository Settings > Pages for build status

## Quick Reference

### Important URLs

- **GitHub Pages (Frontend):** `https://YOUR-USERNAME.github.io/YOUR-REPO-NAME`
- **Netlify Functions (Backend):** `https://YOUR-SITE-NAME.netlify.app`
- **Admin Panel:** `https://YOUR-USERNAME.github.io/YOUR-REPO-NAME/admin/login.html`
- **Neon Dashboard:** https://console.neon.tech

### Environment Variables (Netlify)

- `DATABASE_URL`: Neon.tech PostgreSQL connection string
- `JWT_SECRET`: Random secret string for JWT tokens

### Key Files to Update

- `js/config.js` - API URL configuration
- `netlify/functions/api.js` - CORS configuration (if needed)

## Next Steps

After setup:

1. **Customize your blog:**
   - Update `index.html` title and branding
   - Modify CSS files for your design
   - Add your own logo

2. **Create content:**
   - Write your first blog post
   - Create categories
   - Add tags

3. **Configure features:**
   - Set up newsletter integration (if needed)
   - Customize comment moderation
   - Add analytics tracking

4. **Optimize:**
   - Add meta tags for SEO
   - Configure social media sharing
   - Set up a custom domain (optional)

## Need Help?

- Check the main `README.md` for API documentation
- Review Netlify Functions logs for backend errors
- Check browser console (F12) for frontend errors
- Verify all environment variables are set correctly


