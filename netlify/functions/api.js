// ============================================
// BLOG PLATFORM - API SERVER (Netlify Functions)
// Backend API for Blog Platform using Neon.tech PostgreSQL
// ============================================

const serverless = require('serverless-http');
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const crypto = require('crypto');

// Netlify Blobs
let getStore;
let blobsAvailable = false;
try {
  const blobs = require('@netlify/blobs');
  getStore = blobs.getStore;
  blobsAvailable = true;
  console.log('Netlify Blobs imported successfully');
} catch (blobError) {
  console.error('Failed to import @netlify/blobs:', blobError);
  getStore = function() {
    throw new Error('Netlify Blobs not available');
  };
}

// Helper function to safely get a store
function getBlobStore(storeName) {
  if (!blobsAvailable) {
    throw new Error('Netlify Blobs is not available');
  }
  const baseOptions = { name: storeName, consistency: 'strong' };
  try {
    return getStore(baseOptions);
  } catch (autoError) {
    const siteID = process.env.NETLIFY_SITE_ID || process.env.SITE_ID;
    const token = process.env.NETLIFY_AUTH_TOKEN || process.env.NETLIFY_TOKEN || process.env.NETLIFY_FUNCTIONS_TOKEN;
    if (siteID && token) {
      return getStore({ ...baseOptions, siteID, token });
    }
    throw autoError;
  }
}

// Generic retry helper with exponential backoff
async function withRetry(fn, { retries = 3, baseDelayMs = 150 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}

const app = express();

console.log('[API] Module loaded successfully');
console.log('[API] Netlify Blobs available:', blobsAvailable);
console.log('[API] DATABASE_URL configured:', !!process.env.DATABASE_URL);

// Middleware
app.use(cors({
  origin: [
    /^https?:\/\/.*\.github\.io$/,
    /^https?:\/\/.*\.githubpages\.com$/,
    /^https?:\/\/.*\.netlify\.app$/,
    'http://localhost:3000',
    'http://localhost:8080',
    'http://localhost:8888',
    'http://localhost:5500'
  ],
  credentials: true
}));
app.use(express.json());

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    // Test database connection
    const testQuery = await dbQuery('SELECT NOW() as current_time');
    res.json({ 
      status: 'ok', 
      database: 'connected',
      timestamp: testQuery.rows[0].current_time,
      tables: {
        users: await checkTableExists('users'),
        blog_categories: await checkTableExists('blog_categories'),
        blog_tags: await checkTableExists('blog_tags'),
        blog_posts: await checkTableExists('blog_posts'),
        media_assets: await checkTableExists('media_assets')
      }
    });
  } catch (error) {
    console.error('[API] Health check error:', error);
    res.status(500).json({ 
      status: 'error', 
      database: 'disconnected',
      error: error.message,
      code: error.code
    });
  }
});

// Helper to check if table exists
async function checkTableExists(tableName) {
  try {
    const result = await dbQuery(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
      )`,
      [tableName]
    );
    return result.rows[0].exists;
  } catch (error) {
    return false;
  }
}

// File upload middleware
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 10
  },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Database connection
if (!process.env.DATABASE_URL) {
  console.error('[API] ERROR: DATABASE_URL environment variable is not set!');
  console.error('[API] Please set DATABASE_URL in Netlify environment variables');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('sslmode=require') ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  max: 10
});

// Test database connection on startup
pool.on('error', (err) => {
  console.error('[API] Unexpected database pool error:', err);
});

// Helper function to handle database queries with better error messages
async function dbQuery(query, params = []) {
  try {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is not set. Please configure it in Netlify environment variables.');
    }
    return await pool.query(query, params);
  } catch (error) {
    console.error('[API] Database query error:', error.message);
    console.error('[API] Error code:', error.code);
    console.error('[API] Error detail:', error.detail);
    console.error('[API] Query:', query.substring(0, 200)); // Log first 200 chars
    console.error('[API] Params:', params);
    
    // Handle specific PostgreSQL error codes
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      throw new Error('Database connection failed. Please check DATABASE_URL configuration.');
    }
    if (error.code === '42703') {
      throw new Error('Database schema error: Column does not exist. Please run migrations/schema.sql in your Neon.tech database.');
    }
    if (error.code === '42P01') {
      throw new Error('Database schema error: Table does not exist. Please run migrations/schema.sql in your Neon.tech SQL Editor.');
    }
    if (error.code === '28P01') {
      throw new Error('Database authentication failed. Please check your DATABASE_URL credentials.');
    }
    if (error.code === '3D000') {
      throw new Error('Database does not exist. Please check your DATABASE_URL.');
    }
    
    // Re-throw with more context
    throw error;
  }
}

// JWT secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// ============================================
// AUTHENTICATION MIDDLEWARE
// ============================================

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

// Helper function to slugify
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// GitHub API helper to commit files to repo
async function commitFileToGitHub(filePath, fileContent, message = 'Add image') {
  const githubToken = process.env.GITHUB_TOKEN;
  const githubRepo = process.env.GITHUB_REPO || 'chriswdixon/chriswdixon-blog';
  const githubBranch = process.env.GITHUB_BRANCH || 'main';

  if (!githubToken) {
    throw new Error('GITHUB_TOKEN environment variable is not set');
  }

  try {
    // Get the current file SHA if it exists (for updates)
    const getFileUrl = `https://api.github.com/repos/${githubRepo}/contents/${filePath}`;
    const getFileResponse = await fetch(getFileUrl, {
      headers: {
        'Authorization': `token ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    let sha = null;
    if (getFileResponse.ok) {
      const fileData = await getFileResponse.json();
      sha = fileData.sha;
    }

    // Commit the file
    const content = Buffer.from(fileContent).toString('base64');
    const commitUrl = `https://api.github.com/repos/${githubRepo}/contents/${filePath}`;
    
    const commitResponse = await fetch(commitUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: message,
        content: content,
        branch: githubBranch,
        ...(sha ? { sha: sha } : {})
      })
    });

    if (!commitResponse.ok) {
      const error = await commitResponse.json();
      throw new Error(`GitHub API error: ${error.message || commitResponse.statusText}`);
    }

    const result = await commitResponse.json();
    return {
      path: result.content.path,
      url: result.content.html_url,
      download_url: result.content.download_url
    };
  } catch (error) {
    console.error('Error committing file to GitHub:', error);
    throw error;
  }
}

// Media asset functions - now saves to GitHub repo
async function createMediaAsset(file, context = 'blog') {
  if (!file || !file.buffer) {
    return null;
  }

  try {
    // Generate a unique filename
    const sanitizedFilename = (file.originalname || 'upload').replace(/[^a-zA-Z0-9._-]/g, '_');
    const extension = sanitizedFilename.split('.').pop() || 'jpg';
    const uniqueFilename = `${crypto.randomUUID()}.${extension}`;
    const filePath = `assets/images/posts/${uniqueFilename}`;

    // Commit file to GitHub
    const githubResult = await commitFileToGitHub(
      filePath,
      file.buffer,
      `Add blog post image: ${sanitizedFilename}`
    );

    // Store metadata in database
    const imageUrl = `/${filePath}`; // Relative path for GitHub Pages
    const result = await pool.query(
      `INSERT INTO media_assets (filename, mime_type, file_size, blob_key, context)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, filename, mime_type, file_size, blob_key, context, created_at`,
      [sanitizedFilename, file.mimetype, file.size, filePath, context]
    );

    return {
      ...result.rows[0],
      path: filePath,
      url: imageUrl,
      github_url: githubResult.url
    };
  } catch (error) {
    console.error('Error creating media asset:', error);
    throw error;
  }
}

async function getMediaAsset(assetId) {
  if (!assetId) return null;
  
  try {
    let result;
    try {
      result = await pool.query(
        `SELECT id, filename, mime_type, file_size, blob_key, created_at
         FROM media_assets WHERE id = $1::uuid`,
        [assetId]
      );
    } catch {
      result = await pool.query(
        `SELECT id, filename, mime_type, file_size, blob_key, created_at
         FROM media_assets WHERE id::text = $1`,
        [assetId]
      );
    }
    
    if (!result.rows || result.rows.length === 0) return null;
    
    const asset = result.rows[0];
    if (!asset.blob_key) return null;
    
    const store = getBlobStore('media-assets');
    const blobData = await withRetry(() => store.get(asset.blob_key, { type: 'arrayBuffer' }));
    
    if (!blobData) return null;
    
    return {
      ...asset,
      data: Buffer.from(blobData)
    };
  } catch (error) {
    console.error(`Error fetching media asset ${assetId}:`, error);
    return null;
  }
}

function buildMediaUrl(assetId) {
  if (!assetId) return null;
  return `/api/media/${assetId}`;
}

function transformBlogPost(row) {
  if (!row) return row;
  const assetId = row.featured_image_asset_id || null;
  const githubRepo = process.env.GITHUB_REPO || 'chriswdixon/chriswdixon-blog';
  const githubBranch = process.env.GITHUB_BRANCH || 'main';
  
  // If we have a featured_image_url that starts with /, it's a repo path - convert to GitHub raw URL
  // Otherwise, if we have an assetId, use the media URL
  // Otherwise, use the featured_image_url directly
  let resolvedUrl = row.featured_image_url;
  if (assetId && !row.featured_image_url) {
    resolvedUrl = buildMediaUrl(assetId);
  } else if (row.featured_image_url) {
    // If it's an absolute path starting with /assets/images/posts/, convert to GitHub raw URL
    if (row.featured_image_url.startsWith('/assets/images/posts/')) {
      const imagePath = row.featured_image_url.substring(1); // Remove leading slash
      resolvedUrl = `https://raw.githubusercontent.com/${githubRepo}/${githubBranch}/${imagePath}`;
    } else if (row.featured_image_url.startsWith('assets/images/posts/')) {
      // If it's a relative path without leading slash, convert to GitHub raw URL
      resolvedUrl = `https://raw.githubusercontent.com/${githubRepo}/${githubBranch}/${row.featured_image_url}`;
    } else if (!row.featured_image_url.startsWith('http') && !row.featured_image_url.startsWith('/')) {
      // If it's a relative path without leading slash and not already assets/, add it
      resolvedUrl = row.featured_image_url.startsWith('assets/') ? '/' + row.featured_image_url : row.featured_image_url;
    }
    // If it already starts with http, use as-is
  }
  
  return {
    ...row,
    featured_image_asset_id: assetId,
    featured_image_url: resolvedUrl || null
  };
}

// ============================================
// MEDIA ROUTES
// ============================================

app.get('/api/media/:assetId', async (req, res) => {
  try {
    const { assetId } = req.params;
    if (!assetId) {
      return res.status(400).json({ error: 'Asset ID required' });
    }
    
    const asset = await getMediaAsset(assetId);
    if (!asset || !asset.data) {
      return res.status(404).json({ error: 'Media not found' });
    }

    const imageBuffer = Buffer.isBuffer(asset.data) ? asset.data : Buffer.from(asset.data, 'binary');
    res.setHeader('Content-Type', asset.mime_type || 'application/octet-stream');
    res.setHeader('Content-Length', imageBuffer.length);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    if (asset.filename) {
      res.setHeader('Content-Disposition', `inline; filename="${asset.filename}"`);
    }
    res.send(imageBuffer);
  } catch (error) {
    console.error('[MEDIA ROUTE] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// AUTH ROUTES
// ============================================

// Register - DISABLED: Registration is disabled. Admins must be created directly in the database.
app.post('/api/auth/register', (req, res) => {
  res.status(403).json({ error: 'Registration is disabled. Contact an administrator.' });
});

// Login
app.post('/api/auth/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty().isLength({ min: 1, max: 200 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.error('[LOGIN] Validation errors:', errors.array());
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    const { email, password } = req.body;
    const normalizedEmail = email.toLowerCase().trim();
    
    console.log('[LOGIN] Attempting login for:', normalizedEmail);
    console.log('[LOGIN] Password provided:', !!password, 'Length:', password ? password.length : 0);

    // Try to select with all possible columns, handle missing columns gracefully
    // Try both exact match and case-insensitive match
    let result = await dbQuery(
      'SELECT id, email, password_hash, created_at, name, role FROM users WHERE LOWER(email) = LOWER($1)',
      [normalizedEmail]
    );
    
    if (result.rows.length === 0) {
      // Try exact match as fallback
      result = await dbQuery(
        'SELECT id, email, password_hash, created_at, name, role FROM users WHERE email = $1',
        [normalizedEmail]
      );
    }

    if (result.rows.length === 0) {
      console.error('[LOGIN] User not found:', email);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];
    
    if (!user.password_hash) {
      console.error('[LOGIN] User found but password_hash is missing:', email);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    console.log('[LOGIN] User found:', {
      email: user.email,
      hash_length: user.password_hash ? user.password_hash.length : 0,
      hash_preview: user.password_hash ? user.password_hash.substring(0, 20) + '...' : 'NULL'
    });
    
    console.log('[LOGIN] Comparing password for:', normalizedEmail);
    const validPassword = await bcrypt.compare(password, user.password_hash);
    
    console.log('[LOGIN] Password comparison result:', validPassword);
    
    if (!validPassword) {
      console.error('[LOGIN] Password mismatch for:', normalizedEmail);
      console.error('[LOGIN] Hash in DB:', user.password_hash ? user.password_hash.substring(0, 30) + '...' : 'NULL');
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    console.log('[LOGIN] Password valid, generating token for:', email);
    const token = jwt.sign(
      { id: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name || null,
        role: user.role || 'admin',
        created_at: user.created_at
      },
      access_token: token
    });
  } catch (error) {
    console.error('[LOGIN] Error:', error.message);
    console.error('[LOGIN] Full error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Test endpoint to check if user exists (for debugging)
// Usage: /api/auth/test-user?email=chriswdixon@gmail.com
app.get('/api/auth/test-user', async (req, res) => {
  try {
    const email = req.query.email || 'chriswdixon@gmail.com';
    
    console.log('[TEST USER] Checking user:', email);
    
    const result = await dbQuery(
      'SELECT id, email, password_hash, name, role, created_at FROM users WHERE email = $1',
      [email]
    );

    console.log('[TEST USER] Query result rows:', result.rows.length);

    if (result.rows.length === 0) {
      console.log('[TEST USER] User not found:', email);
      return res.json({ 
        exists: false, 
        message: 'User not found in database',
        email: email,
        action: 'Run the SQL script to create the user'
      });
    }

    const user = result.rows[0];
    const hashLength = user.password_hash ? user.password_hash.length : 0;
    
    console.log('[TEST USER] User found:', {
      email: user.email,
      has_password: !!user.password_hash,
      hash_length: hashLength
    });
    
    res.json({
      exists: true,
      email: user.email,
      has_password: !!user.password_hash,
      password_hash_length: hashLength,
      password_hash_preview: user.password_hash ? user.password_hash.substring(0, 20) + '...' : null,
      name: user.name,
      role: user.role,
      created_at: user.created_at,
      status: hashLength === 60 ? '✅ Password hash looks correct' : hashLength < 50 ? '❌ Password hash too short' : '⚠️ Unexpected hash length'
    });
  } catch (error) {
    console.error('[TEST USER] Error:', error);
    console.error('[TEST USER] Error stack:', error.stack);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

// Get current user
app.get('/api/auth/user', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, name, role, created_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// BLOG PUBLIC ROUTES
// ============================================

// Get single post by slug
app.get('/api/blog/posts/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    
    const result = await dbQuery(`
      SELECT 
        bp.*,
        bc.name as category_name,
        bc.slug as category_slug,
        bc.color as category_color,
        fia.id as featured_image_asset_id,
        fia.mime_type as featured_image_asset_mime_type,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id', bt.id,
              'name', bt.name,
              'slug', bt.slug
            )
          ) FILTER (WHERE bt.id IS NOT NULL),
          '[]'
        ) as tags
      FROM blog_posts bp
      LEFT JOIN media_assets fia ON bp.featured_image_asset_id = fia.id
      LEFT JOIN blog_categories bc ON bp.category_id = bc.id
      LEFT JOIN blog_post_tags bpt ON bp.id = bpt.post_id
      LEFT JOIN blog_tags bt ON bpt.tag_id = bt.id
      WHERE bp.slug = $1 AND bp.status = 'published'
      GROUP BY bp.id, bc.id, bc.name, bc.slug, bc.color, fia.id, fia.mime_type
    `, [slug]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    res.json(transformBlogPost(result.rows[0]));
  } catch (error) {
    console.error('Get post error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Failed to fetch post'
    });
  }
});

// Get blog posts (public)
app.get('/api/blog/posts', async (req, res) => {
  try {
    const {
      featured,
      category,
      search,
      sort = 'newest',
      page = 1,
      limit = 6
    } = req.query;

    let query = `
      SELECT 
        bp.*,
        bc.name as category_name,
        bc.slug as category_slug,
        bc.color as category_color,
        fia.id as featured_image_asset_id,
        fia.mime_type as featured_image_asset_mime_type,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'name', bt.name,
              'slug', bt.slug
            )
          ) FILTER (WHERE bt.id IS NOT NULL),
          '[]'
        ) as tags
      FROM blog_posts bp
      LEFT JOIN media_assets fia ON bp.featured_image_asset_id = fia.id
      LEFT JOIN blog_categories bc ON bp.category_id = bc.id
      LEFT JOIN blog_post_tags bpt ON bp.id = bpt.post_id
      LEFT JOIN blog_tags bt ON bpt.tag_id = bt.id
      WHERE bp.status = 'published'
    `;

    const params = [];
    let paramCount = 1;

    if (featured === 'true') {
      query += ` AND bp.featured = true`;
    }

    if (category && category !== 'all') {
      query += ` AND bc.slug = $${paramCount}`;
      params.push(category);
      paramCount++;
    }

    if (search) {
      query += ` AND (bp.title ILIKE $${paramCount} OR bp.excerpt ILIKE $${paramCount} OR bp.content ILIKE $${paramCount})`;
      params.push(`%${search}%`);
      paramCount++;
    }

    query += ` GROUP BY bp.id, bc.id, bp.title, bp.slug, bp.excerpt, bp.content, bp.featured_image_url, bp.category_id, bp.status, bp.featured, bp.view_count, bp.published_at, bp.created_at, bp.updated_at, fia.id, fia.mime_type`;

    switch (sort) {
      case 'newest':
        query += ` ORDER BY bp.published_at DESC NULLS LAST`;
        break;
      case 'oldest':
        query += ` ORDER BY bp.published_at ASC NULLS LAST`;
        break;
      case 'popular':
        query += ` ORDER BY bp.view_count DESC`;
        break;
      default:
        query += ` ORDER BY bp.published_at DESC NULLS LAST`;
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(parseInt(limit), offset);

    const result = await dbQuery(query, params);
    res.json(result.rows.map(transformBlogPost));
  } catch (error) {
    console.error('Get posts error:', error);
    const isDevelopment = process.env.NODE_ENV === 'development' || process.env.NETLIFY_DEV === 'true';
    res.status(500).json({ 
      error: 'Internal server error',
      message: isDevelopment ? error.message : 'Failed to fetch posts. Please check database setup.',
      code: error.code || 'UNKNOWN'
    });
  }
});

// Get categories
app.get('/api/blog/categories', async (req, res) => {
  try {
    const result = await dbQuery('SELECT * FROM blog_categories ORDER BY name ASC');
    res.json(result.rows);
  } catch (error) {
    console.error('Get categories error:', error);
    const isDevelopment = process.env.NODE_ENV === 'development' || process.env.NETLIFY_DEV === 'true';
    res.status(500).json({ 
      error: 'Internal server error',
      message: isDevelopment ? error.message : 'Failed to fetch categories. Please check database setup.',
      code: error.code || 'UNKNOWN'
    });
  }
});

// Get tags
app.get('/api/blog/tags', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM blog_tags ORDER BY name ASC');
    res.json(result.rows);
  } catch (error) {
    console.error('Get tags error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Increment view count
app.post('/api/blog/posts/:id/view', async (req, res) => {
  try {
    await pool.query(
      'UPDATE blog_posts SET view_count = view_count + 1 WHERE id = $1',
      [req.params.id]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Increment view error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get comments for a post
app.get('/api/blog/posts/:postId/comments', async (req, res) => {
  try {
    const { postId } = req.params;
    
    // Helper function to check if string is a UUID
    const isUUID = (str) => {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      return uuidRegex.test(str);
    };
    
    // Resolve post ID - check if it's a UUID or a slug
    let actualPostId = postId;
    if (!isUUID(postId)) {
      // It's a slug, look up the post ID
      const postResult = await pool.query('SELECT id FROM blog_posts WHERE slug = $1', [postId]);
      if (postResult.rows.length === 0) {
        return res.status(404).json({ error: 'Post not found' });
      }
      actualPostId = postResult.rows[0].id;
    }
    
    const result = await pool.query(`
      SELECT 
        c.*,
        u.name as user_name,
        u.email as user_email
      FROM comments c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.post_id = $1 AND c.status = 'approved'
      ORDER BY c.created_at ASC
    `, [actualPostId]);

    // Build nested structure
    const commentsMap = new Map();
    const rootComments = [];

    result.rows.forEach(comment => {
      commentsMap.set(comment.id, { ...comment, replies: [] });
    });

    result.rows.forEach(comment => {
      const commentObj = commentsMap.get(comment.id);
      if (comment.parent_id) {
        const parent = commentsMap.get(comment.parent_id);
        if (parent) {
          parent.replies.push(commentObj);
        }
      } else {
        rootComments.push(commentObj);
      }
    });

    res.json(rootComments);
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Post comment
app.post('/api/blog/posts/:postId/comments', [
  body('author_name').notEmpty().trim(),
  body('author_email').optional().isEmail().normalizeEmail(),
  body('content').notEmpty().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Invalid input' });
    }

    const { postId } = req.params;
    const { author_name, author_email, author_url, content, parent_id, user_id } = req.body;

    // Helper function to check if string is a UUID
    const isUUID = (str) => {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      return uuidRegex.test(str);
    };
    
    // Resolve post ID - check if it's a UUID or a slug
    let actualPostId = postId;
    if (!isUUID(postId)) {
      // It's a slug, look up the post ID
      const postCheck = await pool.query('SELECT id FROM blog_posts WHERE slug = $1', [postId]);
      if (postCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Post not found' });
      }
      actualPostId = postCheck.rows[0].id;
    } else {
      // It's a UUID, verify post exists
      const postCheck = await pool.query('SELECT id FROM blog_posts WHERE id = $1', [postId]);
      if (postCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Post not found' });
      }
    }

    const result = await pool.query(
      `INSERT INTO comments (post_id, parent_id, author_name, author_email, author_url, content, status, user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        actualPostId,
        parent_id || null,
        author_name,
        author_email || null,
        author_url || null,
        content,
        user_id ? 'approved' : 'pending', // Auto-approve authenticated users
        user_id || null
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Post comment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Newsletter subscription
app.post('/api/blog/newsletter', [
  body('email').isEmail().normalizeEmail()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Invalid email' });
    }

    const { email } = req.body;

    const existing = await pool.query(
      'SELECT id FROM newsletter_subscribers WHERE email = $1',
      [email]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Email already subscribed' });
    }

    await pool.query(
      'INSERT INTO newsletter_subscribers (email, subscribed_at) VALUES ($1, NOW())',
      [email]
    );

    res.json({ message: 'Successfully subscribed to newsletter' });
  } catch (error) {
    console.error('Newsletter subscription error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// ADMIN ROUTES (Protected)
// ============================================

// Get all posts (admin)
app.get('/api/admin/posts', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        bp.*,
        bc.name as category_name,
        bc.slug as category_slug,
        bc.color as category_color,
        fia.id as featured_image_asset_id,
        fia.mime_type as featured_image_asset_mime_type,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id', bt.id,
              'name', bt.name,
              'slug', bt.slug
            )
          ) FILTER (WHERE bt.id IS NOT NULL),
          '[]'
        ) as tags
      FROM blog_posts bp
      LEFT JOIN media_assets fia ON bp.featured_image_asset_id = fia.id
      LEFT JOIN blog_categories bc ON bp.category_id = bc.id
      LEFT JOIN blog_post_tags bpt ON bp.id = bpt.post_id
      LEFT JOIN blog_tags bt ON bpt.tag_id = bt.id
      GROUP BY bp.id, bc.id, bc.name, bc.slug, bc.color, fia.id, fia.mime_type
      ORDER BY bp.created_at DESC
    `);
    res.json(result.rows.map(transformBlogPost));
  } catch (error) {
    console.error('Get admin posts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create/Update post
app.post('/api/admin/posts', authenticateToken, async (req, res) => {
  try {
    console.log('[POST /api/admin/posts] Request received');
    console.log('[POST /api/admin/posts] Body:', JSON.stringify(req.body, null, 2));
    console.log('[POST /api/admin/posts] User:', req.user);
    
    const {
      id,
      title,
      slug: providedSlug,
      excerpt,
      content,
      featured_image_url,
      featured_image_asset_id,
      category_id,
      status,
      featured,
      published_at,
      tags
    } = req.body;
    
    if (!title || !content) {
      console.error('[POST /api/admin/posts] Missing required fields:', { title: !!title, content: !!content });
      return res.status(400).json({ error: 'Title and content are required' });
    }

    const slug = providedSlug || slugify(title);
    const featuredImageAssetId = featured_image_asset_id || null;
    const resolvedImageUrl = featuredImageAssetId ? null : (featured_image_url || null);
    let previousAssetId = null;

    if (id) {
      const existingImage = await pool.query(
        'SELECT featured_image_asset_id FROM blog_posts WHERE id = $1',
        [id]
      );

      if (existingImage.rows.length === 0) {
        return res.status(404).json({ error: 'Post not found' });
      }

      previousAssetId = existingImage.rows[0].featured_image_asset_id;

      const result = await pool.query(
        `UPDATE blog_posts 
         SET title = $1, slug = $2, excerpt = $3, content = $4, 
             featured_image_url = $5, featured_image_asset_id = $6,
             category_id = $7, status = $8, 
             featured = $9, published_at = $10, author_id = $11, updated_at = NOW()
         WHERE id = $12
         RETURNING *`,
        [
          title,
          slug,
          excerpt,
          content,
          resolvedImageUrl || null,
          featuredImageAssetId,
          category_id,
          status,
          featured,
          published_at,
          req.user.id,
          id
        ]
      );

      // Update tags
      if (tags && Array.isArray(tags)) {
        await pool.query('DELETE FROM blog_post_tags WHERE post_id = $1', [id]);
        for (const tagId of tags) {
          if (tagId) {
            await pool.query(
              'INSERT INTO blog_post_tags (post_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
              [id, tagId]
            );
          }
        }
      }

      res.json(transformBlogPost(result.rows[0]));
    } else {
      console.log('[POST /api/admin/posts] Creating new post');
      console.log('[POST /api/admin/posts] Insert values:', {
        title,
        slug,
        excerpt: excerpt ? excerpt.substring(0, 50) + '...' : null,
        content: content ? content.substring(0, 50) + '...' : null,
        resolvedImageUrl,
        featuredImageAssetId,
        category_id,
        status,
        featured,
        published_at,
        author_id: req.user.id
      });
      
      const result = await pool.query(
        `INSERT INTO blog_posts 
         (title, slug, excerpt, content, featured_image_url, featured_image_asset_id, category_id, status, featured, published_at, author_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [
          title,
          slug,
          excerpt || null,
          content,
          resolvedImageUrl || null,
          featuredImageAssetId,
          category_id || null,
          status || 'draft',
          featured || false,
          published_at || null,
          req.user.id
        ]
      );
      
      console.log('[POST /api/admin/posts] Insert result:', result.rows.length > 0 ? 'Success' : 'No rows returned');

      const newPost = transformBlogPost(result.rows[0]);

      // Add tags
      if (tags && Array.isArray(tags)) {
        for (const tagId of tags) {
          if (tagId) {
            await pool.query(
              'INSERT INTO blog_post_tags (post_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
              [newPost.id, tagId]
            );
          }
        }
      }

      console.log('[POST /api/admin/posts] Post created successfully:', newPost.id);
      res.status(201).json(newPost);
    }
  } catch (error) {
    console.error('[POST /api/admin/posts] Error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      constraint: error.constraint,
      stack: error.stack
    });
    res.status(500).json({ 
      error: error.message || 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Delete post
app.delete('/api/admin/posts/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM blog_posts WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get categories (admin)
app.get('/api/admin/categories', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM blog_categories ORDER BY name ASC');
    res.json(result.rows);
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create/Update category
app.post('/api/admin/categories', authenticateToken, async (req, res) => {
  try {
    const { id, name, slug: providedSlug, description, color } = req.body;
    
    // Validate required fields
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Category name is required' });
    }
    
    const slug = providedSlug || slugify(name);
    
    if (!slug || !slug.trim()) {
      return res.status(400).json({ error: 'Category slug is required' });
    }

    // Handle empty string as null for id
    const categoryId = id && id.trim() !== '' ? id : null;

    if (categoryId) {
      // Update existing category
      const result = await pool.query(
        'UPDATE blog_categories SET name = $1, slug = $2, description = $3, color = $4 WHERE id = $5 RETURNING *',
        [name.trim(), slug.trim(), description ? description.trim() : null, color || '#0c71c3', categoryId]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Category not found' });
      }
      
      res.json(result.rows[0]);
    } else {
      // Create new category - check for duplicate slug first
      const existing = await pool.query(
        'SELECT id FROM blog_categories WHERE slug = $1',
        [slug.trim()]
      );
      
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: 'A category with this slug already exists' });
      }
      
      const result = await pool.query(
        'INSERT INTO blog_categories (name, slug, description, color) VALUES ($1, $2, $3, $4) RETURNING *',
        [name.trim(), slug.trim(), description ? description.trim() : null, color || '#0c71c3']
      );
      res.status(201).json(result.rows[0]);
    }
  } catch (error) {
    console.error('Save category error:', error);
    
    // Handle unique constraint violations
    if (error.code === '23505') { // PostgreSQL unique violation
      return res.status(409).json({ error: 'A category with this name or slug already exists' });
    }
    
    // Handle foreign key violations
    if (error.code === '23503') {
      return res.status(400).json({ error: 'Invalid category reference' });
    }
    
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Delete category
app.delete('/api/admin/categories/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM blog_categories WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get tags (admin)
app.get('/api/admin/tags', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM blog_tags ORDER BY name ASC');
    res.json(result.rows);
  } catch (error) {
    console.error('Get tags error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create or get tag
app.post('/api/admin/tags', authenticateToken, async (req, res) => {
  try {
    const { name, slug } = req.body;
    
    let result = await pool.query('SELECT * FROM blog_tags WHERE slug = $1', [slug]);
    
    if (result.rows.length > 0) {
      res.json(result.rows[0]);
    } else {
      result = await pool.query(
        'INSERT INTO blog_tags (name, slug) VALUES ($1, $2) RETURNING *',
        [name, slug]
      );
      res.status(201).json(result.rows[0]);
    }
  } catch (error) {
    console.error('Create tag error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete tag
app.delete('/api/admin/tags/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM blog_tags WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete tag error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get comments (admin)
app.get('/api/admin/comments', authenticateToken, async (req, res) => {
  try {
    const { status } = req.query;
    let query = `
      SELECT 
        c.*,
        bp.title as post_title,
        bp.slug as post_slug,
        u.name as user_name
      FROM comments c
      LEFT JOIN blog_posts bp ON c.post_id = bp.id
      LEFT JOIN users u ON c.user_id = u.id
    `;
    
    const params = [];
    if (status) {
      query += ' WHERE c.status = $1';
      params.push(status);
    }
    
    query += ' ORDER BY c.created_at DESC';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update comment status
app.put('/api/admin/comments/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const result = await pool.query(
      'UPDATE comments SET status = $1 WHERE id = $2 RETURNING *',
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update comment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete comment
app.delete('/api/admin/comments/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM comments WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Upload media - saves to GitHub repo
app.post('/api/admin/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'File is required' });
    }

    const context = (req.body?.context || 'blog').toString().trim().toLowerCase();
    const asset = await createMediaAsset(file, context);

    res.json({
      asset_id: asset.id,
      url: asset.url, // Relative path like /assets/images/posts/uuid.jpg
      path: asset.path, // Full path in repo
      mime_type: asset.mime_type,
      size: asset.file_size,
      filename: asset.filename,
      github_url: asset.github_url
    });
  } catch (error) {
    console.error('Upload error:', error);
    if (error.message.includes('GITHUB_TOKEN')) {
      res.status(500).json({ error: 'GitHub integration not configured. Please set GITHUB_TOKEN environment variable.' });
    } else {
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }
});

// Dashboard stats
app.get('/api/admin/stats', authenticateToken, async (req, res) => {
  try {
    const [posts, categories, subscribers, views, comments] = await Promise.all([
      pool.query('SELECT COUNT(*) as count FROM blog_posts'),
      pool.query('SELECT COUNT(*) as count FROM blog_categories'),
      pool.query('SELECT COUNT(*) as count FROM newsletter_subscribers'),
      pool.query('SELECT SUM(view_count) as total FROM blog_posts'),
      pool.query('SELECT COUNT(*) as count FROM comments WHERE status = $1', ['pending'])
    ]);

    res.json({
      posts: parseInt(posts.rows[0].count),
      categories: parseInt(categories.rows[0].count),
      subscribers: parseInt(subscribers.rows[0].count),
      views: parseInt(views.rows[0].total) || 0,
      pending_comments: parseInt(comments.rows[0].count)
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// LINKEDIN CROSS-POSTING ROUTES
// ============================================

// LinkedIn OAuth - Initiate authentication
app.get('/api/linkedin/auth', authenticateToken, async (req, res) => {
  try {
    const LINKEDIN_CLIENT_ID = process.env.LINKEDIN_CLIENT_ID;
    const LINKEDIN_REDIRECT_URI = process.env.LINKEDIN_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/linkedin/callback`;
    
    if (!LINKEDIN_CLIENT_ID) {
      return res.status(500).json({ error: 'LinkedIn Client ID not configured' });
    }

    const state = jwt.sign({ userId: req.user.id }, JWT_SECRET, { expiresIn: '10m' });
    const scope = 'openid profile email w_member_social';
    const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${LINKEDIN_CLIENT_ID}&redirect_uri=${encodeURIComponent(LINKEDIN_REDIRECT_URI)}&state=${state}&scope=${encodeURIComponent(scope)}`;
    
    res.redirect(authUrl);
  } catch (error) {
    console.error('LinkedIn auth error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// LinkedIn OAuth - Callback
app.get('/api/linkedin/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;
    
    // Determine redirect base URL
    const redirectBase = process.env.SITE_URL || `https://${req.get('host')}`;
    const adminPostsUrl = `${redirectBase}/admin/posts.html`;
    
    if (error) {
      return res.redirect(`${adminPostsUrl}?linkedin_error=${encodeURIComponent(error)}`);
    }
    
    if (!code || !state) {
      return res.redirect(`${adminPostsUrl}?linkedin_error=missing_parameters`);
    }

    // Verify state token
    let decodedState;
    try {
      decodedState = jwt.verify(state, JWT_SECRET);
    } catch (err) {
      return res.redirect(`${adminPostsUrl}?linkedin_error=invalid_state`);
    }

    // Exchange code for access token
    const LINKEDIN_CLIENT_ID = process.env.LINKEDIN_CLIENT_ID;
    const LINKEDIN_CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET;
    const LINKEDIN_REDIRECT_URI = process.env.LINKEDIN_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/linkedin/callback`;
    
    if (!LINKEDIN_CLIENT_ID || !LINKEDIN_CLIENT_SECRET) {
      const redirectBase = process.env.SITE_URL || `https://${req.get('host')}`;
      return res.redirect(`${redirectBase}/admin/posts.html?linkedin_error=not_configured`);
    }

    const tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: LINKEDIN_REDIRECT_URI,
        client_id: LINKEDIN_CLIENT_ID,
        client_secret: LINKEDIN_CLIENT_SECRET
      })
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('LinkedIn token exchange error:', errorData);
      const redirectBase = process.env.SITE_URL || `https://${req.get('host')}`;
      return res.redirect(`${redirectBase}/admin/posts.html?linkedin_error=token_exchange_failed`);
    }

    const tokenData = await tokenResponse.json();
    
    // Store access token in database (encrypted or in environment variable)
    // For now, we'll store it in a settings table or use environment variable
    // Create settings table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key VARCHAR(255) PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // Store encrypted token (in production, use proper encryption)
    await pool.query(`
      INSERT INTO settings (key, value, updated_at)
      VALUES ('linkedin_access_token', $1, NOW())
      ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()
    `, [tokenData.access_token]);
    
    if (tokenData.refresh_token) {
      await pool.query(`
        INSERT INTO settings (key, value, updated_at)
        VALUES ('linkedin_refresh_token', $1, NOW())
        ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()
      `, [tokenData.refresh_token]);
    }

    const redirectBase = process.env.SITE_URL || `https://${req.get('host')}`;
    res.redirect(`${redirectBase}/admin/posts.html?linkedin_success=true`);
  } catch (error) {
    console.error('LinkedIn callback error:', error);
    const redirectBase = process.env.SITE_URL || `https://${req.get('host')}`;
    res.redirect(`${redirectBase}/admin/posts.html?linkedin_error=callback_failed`);
  }
});

// Get LinkedIn authentication status
app.get('/api/linkedin/status', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT value FROM settings WHERE key = $1',
      ['linkedin_access_token']
    );
    
    res.json({
      authenticated: result.rows.length > 0 && !!result.rows[0].value
    });
  } catch (error) {
    console.error('LinkedIn status error:', error);
    res.json({ authenticated: false });
  }
});

// Post to LinkedIn
app.post('/api/linkedin/post', authenticateToken, async (req, res) => {
  try {
    const { postId, title, url } = req.body;
    
    if (!postId || !title || !url) {
      return res.status(400).json({ error: 'Missing required fields: postId, title, url' });
    }

    // Get access token from database
    const tokenResult = await pool.query(
      'SELECT value FROM settings WHERE key = $1',
      ['linkedin_access_token']
    );
    
    if (tokenResult.rows.length === 0 || !tokenResult.rows[0].value) {
      return res.status(401).json({ 
        error: 'LinkedIn not authenticated',
        requiresAuth: true 
      });
    }

    const accessToken = tokenResult.rows[0].value;

    // Get user's LinkedIn person URN
    const personResponse = await fetch('https://api.linkedin.com/v2/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0'
      }
    });

    if (!personResponse.ok) {
      // Token might be expired
      const refreshResult = await pool.query(
        'SELECT value FROM settings WHERE key = $1',
        ['linkedin_refresh_token']
      );
      
      if (refreshResult.rows.length > 0 && refreshResult.rows[0].value) {
        return res.status(401).json({ 
          error: 'LinkedIn token expired. Please re-authenticate.',
          requiresAuth: true 
        });
      }
      
      return res.status(401).json({ 
        error: 'LinkedIn authentication failed. Please re-authenticate.',
        requiresAuth: true 
      });
    }

    const personData = await personResponse.json();
    // LinkedIn person URN format: urn:li:person:{id}
    // The /me endpoint returns an id field that we can use
    const personUrn = personData.id ? (personData.id.startsWith('urn:') ? personData.id : `urn:li:person:${personData.id}`) : null;
    
    if (!personUrn) {
      return res.status(400).json({ 
        error: 'Could not determine LinkedIn person URN'
      });
    }

    // Create LinkedIn post using UGC Posts API (recommended approach)
    const postContent = {
      author: personUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: {
            text: `${title}\n\nRead more: ${url}`
          },
          shareMediaCategory: 'ARTICLE',
          media: [{
            status: 'READY',
            description: {
              text: title
            },
            originalUrl: url,
            title: {
              text: title
            }
          }]
        }
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
      }
    };

    const postResponse = await fetch('https://api.linkedin.com/v2/ugcPosts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0'
      },
      body: JSON.stringify(postContent)
    });

    if (!postResponse.ok) {
      const errorData = await postResponse.text();
      console.error('LinkedIn post error:', errorData);
      return res.status(postResponse.status).json({ 
        error: 'Failed to post to LinkedIn',
        details: errorData 
      });
    }

    const postResult = await postResponse.json();
    
    // Store LinkedIn post ID in database for tracking
    await pool.query(`
      CREATE TABLE IF NOT EXISTS linkedin_posts (
        id SERIAL PRIMARY KEY,
        post_id VARCHAR(255) NOT NULL,
        linkedin_post_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW(),
        FOREIGN KEY (post_id) REFERENCES blog_posts(id) ON DELETE CASCADE
      )
    `);
    
    await pool.query(`
      INSERT INTO linkedin_posts (post_id, linkedin_post_id)
      VALUES ($1, $2)
      ON CONFLICT DO NOTHING
    `, [postId, postResult.id]);

    res.json({ 
      success: true,
      linkedinPostId: postResult.id,
      message: 'Successfully posted to LinkedIn'
    });
  } catch (error) {
    console.error('LinkedIn post error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// Export handler
exports.handler = serverless(app);



