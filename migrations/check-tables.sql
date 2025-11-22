-- Check which tables exist in the database
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
    'users',
    'blog_categories',
    'blog_tags',
    'blog_posts',
    'blog_post_tags',
    'comments',
    'media_assets',
    'newsletter_subscribers'
)
ORDER BY table_name;

-- Check for missing tables
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN '✓ users'
        ELSE '✗ users MISSING'
    END as users_status,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'blog_categories') THEN '✓ blog_categories'
        ELSE '✗ blog_categories MISSING'
    END as categories_status,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'blog_tags') THEN '✓ blog_tags'
        ELSE '✗ blog_tags MISSING'
    END as tags_status,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'blog_posts') THEN '✓ blog_posts'
        ELSE '✗ blog_posts MISSING'
    END as posts_status,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'blog_post_tags') THEN '✓ blog_post_tags'
        ELSE '✗ blog_post_tags MISSING'
    END as post_tags_status,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'media_assets') THEN '✓ media_assets'
        ELSE '✗ media_assets MISSING'
    END as media_status,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'comments') THEN '✓ comments'
        ELSE '✗ comments MISSING'
    END as comments_status;

