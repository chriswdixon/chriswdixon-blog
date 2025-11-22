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

// Middleware
app.use(cors({
  origin: [
    /\.github\.io$/,
    /\.githubpages\.com$/,
    /\.netlify\.app$/,
    'http://localhost:3000',
    'http://localhost:8080',
    'http://localhost:8888',
    'http://localhost:5500'
  ],
  credentials: true
}));
app.use(express.json());

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

// Media asset functions
async function createMediaAsset(file, context = 'generic') {
  if (!file || !file.buffer) {
    return null;
  }

  try {
    const sanitizedFilename = (file.originalname || 'upload').replace(/[^a-zA-Z0-9._-]/g, '_');
    const blobKey = `${context}-${crypto.randomUUID()}-${sanitizedFilename}`;

    const store = getBlobStore('media-assets');
    await withRetry(() => store.set(blobKey, file.buffer, {
      metadata: {
        filename: file.originalname || 'upload',
        mimeType: file.mimetype,
        context: context
      }
    }));

    const result = await pool.query(
      `INSERT INTO media_assets (filename, mime_type, file_size, blob_key, context)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, filename, mime_type, file_size, blob_key, context, created_at`,
      [file.originalname || 'upload', file.mimetype, file.size, blobKey, context]
    );

    return { ...result.rows[0], buffer: file.buffer };
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
  const resolvedUrl = assetId ? buildMediaUrl(assetId) : row.featured_image_url;
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
  body('password').notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    const { email, password } = req.body;

    const result = await pool.query(
      'SELECT id, email, password_hash, name, role, created_at FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);
    
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        created_at: user.created_at
      },
      access_token: token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
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
    
    const result = await pool.query(`
      SELECT 
        c.*,
        u.name as user_name,
        u.email as user_email
      FROM comments c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.post_id = $1 AND c.status = 'approved'
      ORDER BY c.created_at ASC
    `, [postId]);

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

    // Verify post exists
    const postCheck = await pool.query('SELECT id FROM blog_posts WHERE id = $1', [postId]);
    if (postCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const result = await pool.query(
      `INSERT INTO comments (post_id, parent_id, author_name, author_email, author_url, content, status, user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        postId,
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
      const result = await pool.query(
        `INSERT INTO blog_posts 
         (title, slug, excerpt, content, featured_image_url, featured_image_asset_id, category_id, status, featured, published_at, author_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
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
          req.user.id
        ]
      );

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

      res.status(201).json(newPost);
    }
  } catch (error) {
    console.error('Save post error:', error);
    res.status(500).json({ error: 'Internal server error' });
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
    const slug = providedSlug || slugify(name);

    if (id) {
      const result = await pool.query(
        'UPDATE blog_categories SET name = $1, slug = $2, description = $3, color = $4 WHERE id = $5 RETURNING *',
        [name, slug, description, color, id]
      );
      res.json(result.rows[0]);
    } else {
      const result = await pool.query(
        'INSERT INTO blog_categories (name, slug, description, color) VALUES ($1, $2, $3, $4) RETURNING *',
        [name, slug, description, color]
      );
      res.status(201).json(result.rows[0]);
    }
  } catch (error) {
    console.error('Save category error:', error);
    res.status(500).json({ error: 'Internal server error' });
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

// Upload media
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
      url: buildMediaUrl(asset.id),
      mime_type: asset.mime_type,
      size: asset.file_size,
      filename: asset.filename
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Internal server error' });
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

// Export handler
exports.handler = serverless(app);



