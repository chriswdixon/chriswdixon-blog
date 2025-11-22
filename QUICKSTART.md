# Quick Start Guide

Get your blog up and running in 15 minutes!

## Prerequisites Checklist

- [ ] GitHub account
- [ ] Netlify account (sign up with GitHub)
- [ ] Neon.tech account (sign up with email)

## 5-Minute Setup

### 1. Push to GitHub (2 min)

```bash
cd blog-platform
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git
git push -u origin main
```

### 2. Create Neon Database (2 min)

1. Go to https://neon.tech → Create Project
2. Open SQL Editor
3. Copy/paste entire `migrations/schema.sql` file
4. Run it
5. Copy connection string from "Connection Details"

### 3. Deploy to Netlify (3 min)

1. Go to https://app.netlify.com
2. "Add new site" → "Import from Git" → Select your repo
3. Deploy (default settings work)
4. Go to Site settings → Environment variables → Add:
   - `DATABASE_URL` = (paste Neon connection string)
   - `JWT_SECRET` = (run `node scripts/generate-jwt-secret.js` or use any random string)
5. Wait for redeploy (~1 min)

**Copy your Netlify URL:** `https://YOUR-SITE.netlify.app`

### 4. Update API Config (1 min)

1. Edit `js/config.js`
2. Set: `window.API_URL = 'https://YOUR-SITE.netlify.app';`
3. Commit & push:
   ```bash
   git add js/config.js
   git commit -m "Configure API URL"
   git push
   ```

### 5. Enable GitHub Pages (2 min)

1. GitHub repo → Settings → Pages
2. Source: `main` branch, `/ (root)` folder
3. Save

**Your blog URL:** `https://YOUR-USERNAME.github.io/YOUR-REPO`

### 6. Create Admin (1 min)

1. Visit: `https://YOUR-USERNAME.github.io/YOUR-REPO/admin/login.html`
2. Click "Register"
3. First user = Admin automatically!

## Test It Works

✅ Visit blog homepage - should load  
✅ Visit `YOUR-NETLIFY-URL/.netlify/functions/api/api/blog/posts` - should show `[]`  
✅ Login to admin - should work  
✅ Create a post - should appear on homepage  

## Troubleshooting

**API not working?**
- Check Netlify Functions logs
- Verify `DATABASE_URL` env var is set correctly
- Make sure `API_URL` in `js/config.js` matches Netlify URL

**CORS errors?**
- Make sure `js/config.js` has correct Netlify URL (not GitHub Pages URL)

**Database errors?**
- Verify schema.sql was run in Neon
- Check connection string format in Netlify env vars

## Next Steps

1. Create your first post
2. Customize branding in HTML/CSS
3. Add categories and tags
4. Share your blog!

---

For detailed instructions, see [SETUP.md](./SETUP.md)


