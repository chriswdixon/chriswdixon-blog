# GitHub Image Upload Setup

The blog platform now saves uploaded images directly to the GitHub repository instead of using external URLs or Netlify Blobs.

## Setup Instructions

### 1. Create a GitHub Personal Access Token

1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Give it a name like "Blog Image Upload"
4. Select the following scopes:
   - `repo` (Full control of private repositories)
5. Click "Generate token"
6. **Copy the token immediately** - you won't be able to see it again!

### 2. Configure Netlify Environment Variables

1. Go to your Netlify site dashboard
2. Navigate to Site settings → Environment variables
3. Add the following variables:

   - **Variable:** `GITHUB_TOKEN`
     **Value:** (paste your GitHub token)

   - **Variable:** `GITHUB_REPO` (optional)
     **Value:** `chriswdixon/chriswdixon-blog`
     (Defaults to this if not set)

   - **Variable:** `GITHUB_BRANCH` (optional)
     **Value:** `main`
     (Defaults to `main` if not set)

### 3. Image Storage

- Images are saved to: `assets/images/posts/`
- Each image gets a unique UUID filename
- Images are committed directly to the repository via GitHub API
- The relative path (e.g., `/assets/images/posts/uuid.jpg`) is stored in the database

### 4. Usage

1. When creating or editing a post in the admin panel
2. Click "Choose File" under "Featured Image"
3. Select an image file (JPEG, PNG, GIF, or WebP)
4. The image will automatically upload and be saved to the repository
5. The image path will be stored with the post

## Troubleshooting

### Error: "GitHub integration not configured"
- Make sure `GITHUB_TOKEN` is set in Netlify environment variables
- Verify the token has `repo` scope
- Redeploy your Netlify functions after adding the token

### Images not appearing
- Check that images are committed to the repository
- Verify the image path in the database starts with `/assets/images/posts/`
- Make sure GitHub Pages is serving the `assets` directory

### Upload fails
- Check Netlify function logs for detailed error messages
- Verify the GitHub token is valid and has the correct permissions
- Ensure the repository name in `GITHUB_REPO` is correct

