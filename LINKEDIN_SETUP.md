# LinkedIn Cross-Posting Setup Guide

This guide explains how to set up LinkedIn cross-posting for your blog.

## Prerequisites

1. A LinkedIn Developer Account
2. A LinkedIn App created in the LinkedIn Developer Portal
3. Netlify environment variables configured

## Step 1: Create a LinkedIn App

1. Go to [LinkedIn Developers](https://www.linkedin.com/developers/apps)
2. Click "Create app"
3. Fill in the required information:
   - App name: Your blog name
   - Company: Your company/name
   - Privacy policy URL: Your blog's privacy policy URL
   - App logo: Upload a logo
4. Submit the form

## Step 2: Configure LinkedIn App Permissions

1. In your LinkedIn app, go to the "Auth" tab
2. Add the following redirect URL:
   - `https://your-netlify-site.netlify.app/api/linkedin/callback`
   - Or your custom domain: `https://yourdomain.com/api/linkedin/callback`
3. Under "Products", request access to:
   - **Sign In with LinkedIn using OpenID Connect** (for authentication)
   - **Share on LinkedIn** (for posting)
4. Request access to these products (LinkedIn may need to approve)

## Step 3: Get Your LinkedIn Credentials

1. In your LinkedIn app, go to the "Auth" tab
2. Copy the following:
   - **Client ID** (Application ID)
   - **Client Secret** (Secret Key)

## Step 4: Configure Netlify Environment Variables

1. Go to your Netlify site dashboard
2. Navigate to Site settings → Environment variables
3. Add the following environment variables:

```
LINKEDIN_CLIENT_ID=your_client_id_here
LINKEDIN_CLIENT_SECRET=your_client_secret_here
LINKEDIN_REDIRECT_URI=https://your-netlify-site.netlify.app/api/linkedin/callback
SITE_URL=https://your-netlify-site.netlify.app
```

**Important:** Replace `your-netlify-site.netlify.app` with your actual Netlify site URL or custom domain.

## Step 5: Authenticate LinkedIn

1. Go to your blog's admin panel
2. Navigate to the Posts page
3. If LinkedIn is not connected, you'll see a "Connect LinkedIn" button
4. Click the button to authenticate
5. You'll be redirected to LinkedIn to authorize the app
6. After authorization, you'll be redirected back to your admin panel

## Step 6: Cross-Post to LinkedIn

1. In the Posts page, find a published post
2. Click the "🔗 LinkedIn" button next to the post
3. Confirm the post
4. The post will be shared to your LinkedIn profile

## Troubleshooting

### "LinkedIn not authenticated" error
- Make sure you've completed the OAuth flow
- Check that your LinkedIn app has the required permissions
- Verify that the redirect URI matches exactly in both LinkedIn app and Netlify environment variables

### "LinkedIn token expired" error
- Re-authenticate by clicking "Connect LinkedIn" again
- LinkedIn access tokens typically expire after 60 days

### "Failed to post to LinkedIn" error
- Check that your LinkedIn app has "Share on LinkedIn" product access
- Verify that the post content meets LinkedIn's requirements
- Check the Netlify function logs for detailed error messages

### API Errors
- Make sure your LinkedIn app is approved for the required products
- Some LinkedIn products require manual approval which can take time
- Check LinkedIn's API status page for any service issues

## Notes

- LinkedIn posts are created as public posts by default
- The post will include the blog post title and a link to read more
- LinkedIn may have rate limits on posting frequency
- Access tokens are stored securely in your database
- The integration uses LinkedIn API v2

## Security

- Never commit your LinkedIn Client ID or Client Secret to version control
- Always use environment variables for sensitive credentials
- Regularly rotate your LinkedIn app credentials if compromised
