# Blog Platform

A modern, feature-rich blog platform built for GitHub Pages with a Netlify Functions backend.

## Features

- 📝 Rich blog post editor with markdown support
- 🏷️ Categories and tags
- 🔍 Search functionality
- 📱 Fully responsive design
- 🌙 Dark mode support
- 👤 Admin panel for content management
- 🔐 JWT-based authentication
- 💬 Comments system with nested replies
- 📧 Newsletter subscription
- 📊 Analytics and view tracking

## Architecture

- **Frontend**: Static HTML/CSS/JavaScript (hosted on GitHub Pages)
- **Database**: Neon.tech (serverless PostgreSQL)
- **Backend API**: Netlify Functions (Express.js serverless functions)
- **Authentication**: JWT-based custom auth (bcrypt + JWT)
- **Storage**: Netlify Blobs for blog post images and media

## Getting Started

**Quick Start:** See [SETUP.md](./SETUP.md) for detailed step-by-step instructions.

### Prerequisites

- Node.js 18+ and npm
- A Neon.tech PostgreSQL database (free tier available)
- A Netlify account (free tier available)
- A GitHub account

### Quick Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd blog-platform
```

2. Install dependencies:
```bash
npm install
```

3. **Follow the detailed setup guide:** See [SETUP.md](./SETUP.md) for complete instructions covering:
   - Neon.tech database setup
   - Netlify Functions deployment
   - GitHub Pages deployment
   - Admin user creation

### Setup Checklist

Use [scripts/setup-checklist.md](./scripts/setup-checklist.md) to track your progress.

### Configuration

1. **Update API URL:**
   - Edit `js/config.js`
   - Set `window.API_URL` to your Netlify Functions URL

2. **Set Environment Variables in Netlify:**
   - `DATABASE_URL`: Neon.tech connection string
   - `JWT_SECRET`: Generate using `node scripts/generate-jwt-secret.js`

3. **Deploy:**
   - Backend: Connect GitHub repo to Netlify (auto-deploys Functions)
   - Frontend: Enable GitHub Pages in repository settings

## Project Structure

```
blog-platform/
├── index.html                 # Main blog listing page
├── post.html                  # Individual post page
├── admin/
│   ├── index.html            # Admin dashboard
│   ├── login.html            # Admin login page
│   └── editor.html           # Post editor
├── css/
│   ├── main.css              # Main stylesheet
│   ├── blog.css              # Blog-specific styles
│   └── admin.css             # Admin panel styles
├── js/
│   ├── main.js               # Core API client
│   ├── blog.js               # Blog functionality
│   ├── admin.js              # Admin panel logic
│   └── comments.js           # Comments system
├── netlify/
│   └── functions/
│       └── api.js            # Express.js API
├── migrations/
│   └── schema.sql            # Database schema
├── netlify.toml              # Netlify configuration
├── package.json              # Dependencies
└── README.md
```

## Configuration

### Environment Variables (Netlify)

Set these in Netlify dashboard:

- `DATABASE_URL`: Neon.tech PostgreSQL connection string
- `JWT_SECRET`: Secret key for JWT token signing (use a strong random string)

### Frontend Configuration

In your HTML files, configure the API URL:

```javascript
// Set your Netlify Functions URL
window.API_URL = 'https://your-site.netlify.app';
```

Or use environment variables (for static site generators).

## Database Setup

1. Go to your Neon.tech project dashboard
2. Open the SQL Editor
3. Copy and paste the entire contents of `migrations/schema.sql`
4. Execute the SQL to create all tables

## Deployment

### Frontend (GitHub Pages)

1. Push code to GitHub
2. Enable GitHub Pages in repository settings
3. Select branch and folder
4. Your site will be available at `https://username.github.io/repository-name`

### Backend (Netlify Functions)

1. Connect GitHub repository to Netlify
2. Netlify will auto-detect the `netlify/functions` directory
3. Set environment variables in Netlify dashboard
4. Deploy automatically on every push

### CORS Configuration

The API is configured to allow requests from:
- `*.github.io` domains
- `*.netlify.app` domains
- `localhost` for development

To add your custom domain, edit `netlify/functions/api.js` CORS configuration.

## Usage

### Creating Posts

1. Log in to the admin panel
2. Go to Posts > New Post
3. Fill in the form:
   - Title (required)
   - Slug (auto-generated from title)
   - Excerpt
   - Content (markdown supported)
   - Category
   - Tags
   - Featured image
   - Status (draft/published)
4. Click Save

### Managing Categories

1. Go to Admin > Categories
2. Create new categories
3. Each category can have a color for visual distinction

### Managing Comments

1. Go to Admin > Comments
2. Review pending comments
3. Approve or delete comments

## API Endpoints

### Public Endpoints

- `GET /api/blog/posts` - List published posts
- `GET /api/blog/posts/:slug` - Get single post
- `GET /api/blog/categories` - List categories
- `GET /api/blog/tags` - List tags
- `GET /api/blog/posts/:id/comments` - Get comments for post
- `POST /api/blog/posts/:id/comments` - Post a comment
- `POST /api/blog/posts/:id/view` - Increment view count
- `POST /api/blog/newsletter` - Subscribe to newsletter

### Auth Endpoints

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `GET /api/auth/user` - Get current user

### Admin Endpoints (Protected)

- `GET /api/admin/posts` - List all posts
- `POST /api/admin/posts` - Create/update post
- `DELETE /api/admin/posts/:id` - Delete post
- `GET /api/admin/categories` - List categories
- `POST /api/admin/categories` - Create/update category
- `DELETE /api/admin/categories/:id` - Delete category
- `GET /api/admin/tags` - List tags
- `POST /api/admin/tags` - Create tag
- `GET /api/admin/comments` - List comments
- `PUT /api/admin/comments/:id` - Update comment status
- `POST /api/admin/upload` - Upload media
- `GET /api/admin/stats` - Get dashboard statistics

## Development

### Local Development

1. Install dependencies: `npm install`
2. Start Netlify Dev: `npm run dev`
3. This will start local server with Functions support
4. Update `API_URL` in HTML to `http://localhost:8888`

### Testing

Test your API locally using Netlify Dev:
```bash
npm run dev
```

Then access:
- Frontend: `http://localhost:8888`
- Functions: `http://localhost:8888/.netlify/functions/api`

## Troubleshooting

### CORS Errors

If you see CORS errors:
1. Check that your frontend domain is allowed in `netlify/functions/api.js`
2. Ensure `API_URL` is correctly set in your HTML

### Database Connection Issues

1. Verify `DATABASE_URL` is correct in Netlify
2. Check that your Neon database is active
3. Ensure SSL is enabled in connection string if required

### Authentication Issues

1. Clear browser localStorage
2. Check JWT_SECRET is set in Netlify
3. Verify token expiration (default: 7 days)

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.


