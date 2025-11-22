// ============================================
// BLOG PLATFORM - CONFIGURATION
// ============================================

// API Configuration
// Set your Netlify Functions URL here
// Examples:
// - Development: 'http://localhost:8888'
// - Production: 'https://your-site.netlify.app'
// - Custom domain: 'https://api.yourdomain.com'

window.API_URL = 'https://chriswdixonblog.netlify.app';

// If API_URL is not set, try to auto-detect from current location
if (!window.API_URL) {
    // For GitHub Pages, you'll need to set this to your Netlify Functions URL
    // You can set it in each HTML file or update this file
    const hostname = window.location.hostname;
    
    // Check if we're on GitHub Pages
    if (hostname.includes('github.io') || hostname.includes('githubpages.com')) {
        // You MUST update this with your actual Netlify Functions URL
        // Example: window.API_URL = 'https://your-blog-api.netlify.app';
        console.warn('API_URL not configured. Please set window.API_URL in config.js');
    }
    // Check if we're on Netlify
    else if (hostname.includes('netlify.app')) {
        window.API_URL = `https://${hostname}`;
    }
    // Local development
    else if (hostname === 'localhost' || hostname === '127.0.0.1') {
        window.API_URL = 'http://localhost:8888';
    }
}

// Export configuration
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { API_URL: window.API_URL };
}


