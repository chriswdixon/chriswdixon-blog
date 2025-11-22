// ============================================
// BLOG PLATFORM - BLOG FUNCTIONALITY
// ============================================

document.addEventListener('DOMContentLoaded', function() {
  // State
  let currentCategory = 'all';
  let currentPage = 1;
  let currentSort = 'newest';
  let searchQuery = '';
  let isLoading = false;

  // DOM Elements
  const featuredPostsContainer = document.getElementById('featured-posts');
  const postsGridContainer = document.getElementById('posts-grid');
  const loadMoreBtn = document.getElementById('load-more-btn');
  const searchInput = document.getElementById('search-input');
  const sortSelect = document.getElementById('sort-select');
  const categoryFilters = document.querySelectorAll('.filter-btn');

  // Initialize
  loadFeaturedPosts();
  loadPosts();

  // Event Listeners
  if (searchInput) {
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        searchQuery = e.target.value.trim();
        currentPage = 1;
        loadPosts();
      }, 300);
    });
  }

  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      currentSort = e.target.value;
      currentPage = 1;
      loadPosts();
    });
  }

  if (categoryFilters && categoryFilters.length > 0) {
    categoryFilters.forEach(btn => {
      btn.addEventListener('click', (e) => {
        categoryFilters.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentCategory = btn.dataset.category || 'all';
        currentPage = 1;
        loadPosts();
      });
    });
  }

  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', () => {
      currentPage++;
      loadPosts(true);
    });
  }

  // Functions
  async function loadFeaturedPosts() {
    if (!featuredPostsContainer) return;

    try {
      const posts = await api.getPosts({ featured: true, limit: 3 });
      if (posts.length === 0) {
        featuredPostsContainer.innerHTML = '';
        return;
      }

      featuredPostsContainer.innerHTML = posts.map(post => `
        <article class="featured-post">
          ${post.featured_image_url ? `
            <div class="post-image">
              <img src="${post.featured_image_url}" alt="${post.title}" loading="lazy">
            </div>
          ` : ''}
          <div class="post-content">
            ${post.category_name ? `
              <span class="post-category" style="background-color: ${post.category_color || '#0c71c3'}">
                ${post.category_name}
              </span>
            ` : ''}
            <h2 class="post-title">
              <a href="post.html?slug=${post.slug}">${post.title}</a>
            </h2>
            ${post.excerpt ? `<p class="post-excerpt">${post.excerpt}</p>` : ''}
            <div class="post-meta">
              ${post.published_at ? `<time>${utils.formatDate(post.published_at)}</time>` : ''}
              ${post.view_count ? `<span class="views">${post.view_count} views</span>` : ''}
            </div>
          </div>
        </article>
      `).join('');
    } catch (error) {
      console.error('Error loading featured posts:', error);
      featuredPostsContainer.innerHTML = '';
    }
  }

  async function loadPosts(append = false) {
    if (isLoading) return;
    if (!postsGridContainer) return;

    isLoading = true;

    if (!append) {
      postsGridContainer.innerHTML = '<div class="loading">Loading posts...</div>';
    }

    try {
      const posts = await api.getPosts({
        category: currentCategory,
        search: searchQuery,
        sort: currentSort,
        page: currentPage,
        limit: 6
      });

      if (!append) {
        postsGridContainer.innerHTML = '';
      }

      if (posts.length === 0 && !append) {
        postsGridContainer.innerHTML = '';
        if (loadMoreBtn) loadMoreBtn.style.display = 'none';
        isLoading = false;
        return;
      }

      posts.forEach(post => {
        const postElement = createPostCard(post);
        postsGridContainer.appendChild(postElement);
      });

      if (loadMoreBtn) {
        loadMoreBtn.style.display = posts.length === 6 ? 'block' : 'none';
      }
    } catch (error) {
      console.error('Error loading posts:', error);
      if (!append) {
        postsGridContainer.innerHTML = '';
      }
    } finally {
      isLoading = false;
    }
  }

  function createPostCard(post) {
    const card = document.createElement('article');
    card.className = 'post-card';
    card.innerHTML = `
      ${post.featured_image_url ? `
        <div class="post-image">
          <a href="post.html?slug=${post.slug}">
            <img src="${post.featured_image_url}" alt="${post.title}" loading="lazy">
          </a>
        </div>
      ` : ''}
      <div class="post-content">
        ${post.category_name ? `
          <span class="post-category" style="background-color: ${post.category_color || '#0c71c3'}">
            ${post.category_name}
          </span>
        ` : ''}
        <h2 class="post-title">
          <a href="post.html?slug=${post.slug}">${post.title}</a>
        </h2>
        ${post.excerpt ? `<p class="post-excerpt">${post.excerpt}</p>` : ''}
        ${post.tags && post.tags.length > 0 ? `
          <div class="post-tags">
            ${post.tags.map(tag => `<span class="tag">${tag.name}</span>`).join('')}
          </div>
        ` : ''}
        <div class="post-meta">
          ${post.published_at ? `<time>${utils.formatDate(post.published_at)}</time>` : ''}
          ${post.view_count ? `<span class="views">${post.view_count} views</span>` : ''}
        </div>
      </div>
    `;
    return card;
  }

  // Load categories for filters
  async function loadCategories() {
    try {
      const categories = await api.getCategories();
      // Populate category filters if needed
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  }

  loadCategories();
});



