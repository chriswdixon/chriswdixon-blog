# Deployment Steps for chriswdixon-blog

## Repository Info
- **GitHub Repo:** `chriswdixon/chriswdixon-blog`
- **GitHub Pages URL:** `https://chriswdixon.github.io/chriswdixon-blog/`
- **Local Directory:** `/Users/chrisdixon/Documents/GitHub/blog-platform`

## Step 1: Push to GitHub

```bash
cd /Users/chrisdixon/Documents/GitHub/blog-platform
git push -u origin main
```

**Note:** You'll be prompted for GitHub authentication. Use:
- Personal Access Token (recommended), OR
- GitHub CLI (`gh auth login`), OR
- SSH key if configured

## Step 2: Enable GitHub Pages

1. Go to: https://github.com/chriswdixon/chriswdixon-blog/settings/pages
2. Under "Source":
   - Branch: `main`
   - Folder: `/ (root)`
3. Click "Save"
4. Wait 2-3 minutes for build

Your site will be live at: **https://chriswdixon.github.io/chriswdixon-blog/**

## Step 3: Set Up Neon.tech Database

1. Go to: https://neon.tech
2. Create account → Create Project
3. Open SQL Editor
4. Copy entire `migrations/schema.sql` file
5. Paste and run in SQL Editor
6. Go to "Connection Details" and copy connection string

Save this connection string for Step 4!

## Step 4: Deploy to Netlify

1. Go to: https://app.netlify.com
2. "Add new site" → "Import from Git"
3. Select `chriswdixon/chriswdixon-blog`
4. Deploy settings:
   - Build command: `echo 'No build needed'`
   - Publish directory: `.`
5. Click "Deploy site"

**After deployment, you'll get a URL like:**
`https://chriswdixon-blog.netlify.app`

### Set Environment Variables in Netlify:

1. Netlify Dashboard → Site settings → Environment variables
2. Add:
   - **Variable:** `DATABASE_URL`
     **Value:** (paste Neon connection string from Step 3)
   - **Variable:** `JWT_SECRET`
     **Value:** (run `node scripts/generate-jwt-secret.js` and copy output)

3. Click "Save"
4. Wait for automatic redeploy (~1 minute)

## Step 5: Update API URL

1. Edit `js/config.js`
2. Change line to your Netlify URL:
   ```javascript
   window.API_URL = 'https://chriswdixon-blog.netlify.app';
   ```
   (Replace with your actual Netlify URL from Step 4)

3. Commit and push:
   ```bash
   git add js/config.js
   git commit -m "Configure API URL for Netlify"
   git push
   ```

## Step 6: Create Admin User

1. Visit: `https://chriswdixon.github.io/chriswdixon-blog/admin/login.html`
2. Click "Register"
3. Enter:
   - Email: your email
   - Password: strong password (min 8 chars)
   - Name: your name (optional)
4. First user = Admin automatically!

## Verification Checklist

- [ ] Code pushed to GitHub
- [ ] GitHub Pages enabled and working
- [ ] Neon database created and schema run
- [ ] Netlify site deployed
- [ ] Environment variables set in Netlify
- [ ] API URL updated in `js/config.js`
- [ ] Admin user created
- [ ] First blog post created

## Quick URLs Reference

- **GitHub Repo:** https://github.com/chriswdixon/chriswdixon-blog
- **GitHub Pages:** https://chriswdixon.github.io/chriswdixon-blog/
- **Admin Panel:** https://chriswdixon.github.io/chriswdixon-blog/admin/login.html
- **Netlify Site:** (after Step 4, check your Netlify dashboard)
- **API Endpoint:** (Netlify URL)/.netlify/functions/api/api/blog/posts

## Troubleshooting

**Can't push to GitHub?**
- Check authentication: `gh auth login` or generate Personal Access Token
- Verify remote: `git remote -v` should show your repo

**GitHub Pages not working?**
- Check repository Settings → Pages
- Verify branch is `main` and folder is `/ (root)`
- Wait 3-5 minutes for first build

**API not working?**
- Verify `DATABASE_URL` and `JWT_SECRET` are set in Netlify
- Check Netlify Functions logs
- Make sure `js/config.js` has correct Netlify URL (not GitHub Pages URL)

---

Ready to push? Run:
```bash
git push -u origin main
```

