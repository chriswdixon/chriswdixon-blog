# Setup Checklist

Use this checklist to track your setup progress.

## Pre-Setup

- [ ] Cloned or downloaded the blog platform repository
- [ ] Have a GitHub account
- [ ] Have a Netlify account (can sign up with GitHub)
- [ ] Have a Neon.tech account (free tier is fine)

## Step 1: API Configuration

- [ ] Opened `js/config.js`
- [ ] Know where I'll set the Netlify Functions URL (will update after Netlify deploy)

## Step 2: Neon.tech Database

- [ ] Created Neon.tech account at https://neon.tech
- [ ] Created a new project in Neon
- [ ] Opened SQL Editor in Neon dashboard
- [ ] Copied contents of `migrations/schema.sql`
- [ ] Pasted and executed SQL in Neon SQL Editor
- [ ] Verified tables were created (check Tables section)
- [ ] Copied connection string from Neon (Connection Details)
- [ ] Saved connection string for next step

## Step 3: Netlify Deployment

- [ ] Pushed code to GitHub repository
- [ ] Connected GitHub repository to Netlify
- [ ] Netlify deployed successfully
- [ ] Got Netlify site URL: `https://_____________ .netlify.app`
- [ ] Added environment variable `DATABASE_URL` with Neon connection string
- [ ] Generated JWT secret (run `node scripts/generate-jwt-secret.js` or use password generator)
- [ ] Added environment variable `JWT_SECRET` in Netlify
- [ ] Tested API endpoint: `https://_____________ .netlify.app/.netlify/functions/api/api/blog/posts` (should return `[]`)
- [ ] Updated `js/config.js` with Netlify URL
- [ ] Committed and pushed `js/config.js` changes

## Step 4: GitHub Pages

- [ ] Enabled GitHub Pages in repository Settings > Pages
- [ ] Selected branch: `main` and folder: `/ (root)`
- [ ] GitHub Pages built successfully
- [ ] Got GitHub Pages URL: `https://_____________ .github.io/_____________`
- [ ] Verified `js/config.js` still points to Netlify Functions URL (not GitHub Pages)
- [ ] Updated CORS in `netlify/functions/api.js` if needed
- [ ] Committed and pushed CORS changes (if made)

## Step 5: Admin User

- [ ] Visited `https://_____________ .github.io/_____________/admin/login.html`
- [ ] Registered first admin account
- [ ] Successfully logged in
- [ ] Can see admin dashboard
- [ ] Created first category (optional)
- [ ] Created first blog post
- [ ] Published post (set status to "Published")
- [ ] Viewed post on blog homepage

## Verification

- [ ] Blog homepage loads: `https://_____________ .github.io/_____________/`
- [ ] Can see blog posts on homepage
- [ ] Can click post to view detail page
- [ ] Can post a comment on a blog post
- [ ] Admin login works: `https://_____________ .github.io/_____________/admin/login.html`
- [ ] Admin dashboard shows stats
- [ ] Can create/edit/delete posts from admin panel

## Optional Enhancements

- [ ] Customized blog title/branding
- [ ] Added custom logo
- [ ] Customized colors in CSS
- [ ] Added meta tags for SEO
- [ ] Set up custom domain (optional)
- [ ] Configured email notifications (future enhancement)

## Notes

Write down your important URLs and credentials here:

**GitHub Pages URL:**
```
https://______________.github.io/______________/
```

**Netlify Site URL:**
```
https://______________.netlify.app
```

**Neon Connection String:**
```
postgresql://______________
```

**Admin Email:**
```
______________@______________
```

---

**Setup Date:** ______________

**Status:** [ ] In Progress  [ ] Complete  [ ] Need Help


