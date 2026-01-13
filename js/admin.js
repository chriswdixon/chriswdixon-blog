// ============================================
// BLOG PLATFORM - ADMIN FUNCTIONALITY
// ============================================

document.addEventListener('DOMContentLoaded', function() {
  // Check authentication
  if (!api.isAuthenticated()) {
    if (!window.location.pathname.includes('login.html')) {
      window.location.href = 'admin/login.html';
      return;
    }
  }

  // Initialize admin functionality
  initAdmin();
});

async function initAdmin() {
  // Check for LinkedIn callback messages
  const urlParams = new URLSearchParams(window.location.search);
  const linkedinSuccess = urlParams.get('linkedin_success');
  const linkedinError = urlParams.get('linkedin_error');
  
  if (linkedinSuccess) {
    showMessage('LinkedIn authentication successful!', 'success');
    // Clean up URL
    window.history.replaceState({}, document.title, window.location.pathname);
  }
  
  if (linkedinError) {
    showMessage('LinkedIn error: ' + decodeURIComponent(linkedinError), 'error');
    // Clean up URL
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  // Load dashboard stats
  if (document.getElementById('admin-dashboard')) {
    await loadDashboard();
    // Also load recent posts for dashboard
    if (document.getElementById('posts-list')) {
      await loadPosts();
    }
  }

  // Load posts management
  if (document.getElementById('admin-posts') || document.getElementById('posts-list')) {
    await loadPosts();
    await checkLinkedInAuth();
  }

  // Load categories management
  if (document.getElementById('admin-categories')) {
    await loadCategories();
  }

  // Load comments management
  if (document.getElementById('admin-comments')) {
    await loadComments();
  }
}

async function loadDashboard() {
  try {
    const stats = await api.request('/api/admin/stats');
    
    const elements = {
      'stats-posts': stats.posts,
      'stats-views': stats.views || 0,
      'stats-categories': stats.categories,
      'stats-pending-comments': stats.pending_comments || 0
    };

    for (const [id, value] of Object.entries(elements)) {
      const el = document.getElementById(id);
      if (el) el.textContent = value.toLocaleString();
    }
  } catch (error) {
    console.error('Error loading dashboard:', error);
  }
}

async function loadPosts() {
  try {
    const container = document.getElementById('posts-list');
    if (!container) return;

    // Show loading state
    container.innerHTML = '<p>Loading posts...</p>';

    const posts = await api.request('/api/admin/posts');
    
    if (posts.length === 0) {
      const isInAdmin = window.location.pathname.includes('/admin/');
      const editorPath = isInAdmin ? 'editor.html' : 'admin/editor.html';
      container.innerHTML = `<p>No posts yet. <a href="${editorPath}">Create your first post!</a></p>`;
      return;
    }

    // Limit to 5 most recent posts on dashboard
    const isDashboard = document.getElementById('admin-dashboard') && !document.getElementById('admin-posts');
    const displayPosts = isDashboard ? posts.slice(0, 5) : posts;

    container.innerHTML = displayPosts.map(post => {
      const isInAdmin = window.location.pathname.includes('/admin/');
      const viewPath = isInAdmin ? `../post.html?slug=${post.slug}` : `post.html?slug=${post.slug}`;
      const editPath = isInAdmin ? `editor.html?id=${post.id}` : `admin/editor.html?id=${post.id}`;
      
      return `
      <div class="post-item">
        <div class="post-info">
          <h3>${escapeHtml(post.title)}</h3>
          <p>${post.category_name || 'Uncategorized'} • ${utils.formatDate(post.created_at)} • ${post.status} • ${post.view_count || 0} views</p>
        </div>
        <div class="post-actions">
          <a href="${viewPath}" target="_blank" class="btn-view">View</a>
          <a href="${editPath}" class="btn-edit">Edit</a>
          ${post.status === 'published' ? `<button onclick="crossPostToLinkedIn('${post.id}', '${escapeHtml(post.title)}', '${post.slug}')" class="btn-linkedin" title="Cross-post to LinkedIn">🔗 LinkedIn</button>` : ''}
          ${!isDashboard ? `<button onclick="deletePost('${post.id}')" class="btn-delete">Delete</button>` : ''}
        </div>
      </div>
    `;
    }).join('');

    // Add "View All Posts" link on dashboard if there are more posts
    if (isDashboard && posts.length > 5) {
      const viewAllLink = document.createElement('div');
      viewAllLink.style.padding = 'var(--spacing-md)';
      viewAllLink.style.textAlign = 'center';
      viewAllLink.style.borderTop = '1px solid var(--border-color)';
      viewAllLink.innerHTML = `<a href="posts.html" style="color: var(--primary-color); text-decoration: none; font-weight: 500;">View All Posts (${posts.length})</a>`;
      container.appendChild(viewAllLink);
    }
  } catch (error) {
    console.error('Error loading posts:', error);
    const container = document.getElementById('posts-list');
    if (container) {
      container.innerHTML = `<p style="color: var(--error-color, #dc3545);">Error loading posts: ${error.message || 'Unknown error'}</p>`;
    }
  }
}

async function loadCategories() {
  try {
    const categories = await api.request('/api/admin/categories');
    const container = document.getElementById('categories-list');
    
    if (!container) return;

    if (categories.length === 0) {
      container.innerHTML = '<p>No categories yet.</p>';
      return;
    }

    container.innerHTML = categories.map(cat => `
      <div class="category-item">
        <div class="category-info">
          <span class="category-badge" style="background-color: ${cat.color}">${escapeHtml(cat.name)}</span>
          <p>${escapeHtml(cat.description || '')}</p>
        </div>
        <div class="category-actions">
          <button onclick="editCategory('${cat.id}')" class="btn-edit">Edit</button>
          <button onclick="deleteCategory('${cat.id}')" class="btn-delete">Delete</button>
        </div>
      </div>
    `).join('');
    
    // Make editCategory available globally if modal exists
    if (typeof showCategoryModal === 'function') {
      window.editCategory = function(categoryId) {
        showCategoryModal(categoryId);
      };
    }
  } catch (error) {
    console.error('Error loading categories:', error);
  }
}

// Make loadCategories globally available
window.loadCategories = loadCategories;

async function loadComments() {
  try {
    const comments = await api.request('/api/admin/comments?status=pending');
    const container = document.getElementById('comments-list');
    
    if (!container) return;

    if (comments.length === 0) {
      container.innerHTML = '<p>No pending comments.</p>';
      return;
    }

    container.innerHTML = comments.map(comment => `
      <div class="comment-item">
        <div class="comment-info">
          <strong>${escapeHtml(comment.author_name)}</strong> on 
          <a href="post.html?slug=${comment.post_slug}">${escapeHtml(comment.post_title)}</a>
          <p>${escapeHtml(comment.content)}</p>
          <time>${utils.formatDateTime(comment.created_at)}</time>
        </div>
        <div class="comment-actions">
          <button onclick="approveComment('${comment.id}')" class="btn-approve">Approve</button>
          <button onclick="deleteComment('${comment.id}')" class="btn-delete">Delete</button>
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Error loading comments:', error);
  }
}

// Global functions
window.editPost = async function(postId) {
  // Check if we're already in admin directory
  const isInAdmin = window.location.pathname.includes('/admin/');
  const editorPath = isInAdmin ? `editor.html?id=${postId}` : `admin/editor.html?id=${postId}`;
  window.location.href = editorPath;
};

window.deletePost = async function(postId) {
  if (!confirm('Are you sure you want to delete this post?')) return;
  
  try {
    await api.request(`/api/admin/posts/${postId}`, 'DELETE');
    loadPosts();
  } catch (error) {
    console.error('Error deleting post:', error);
  }
};

window.editCategory = async function(categoryId) {
  // Open category editor modal
  if (typeof showCategoryModal === 'function') {
    showCategoryModal(categoryId);
  } else {
    // Fallback if modal not available (e.g., on posts page)
    showMessage('Please edit categories from the Categories page', 'info');
  }
};

window.deleteCategory = async function(categoryId) {
  if (!confirm('Are you sure you want to delete this category?')) return;
  
  try {
    await api.request(`/api/admin/categories/${categoryId}`, 'DELETE');
    loadCategories();
  } catch (error) {
    console.error('Error deleting category:', error);
  }
};

window.approveComment = async function(commentId) {
  try {
    await api.request(`/api/admin/comments/${commentId}`, 'PUT', { status: 'approved' });
    loadComments();
  } catch (error) {
    console.error('Error approving comment:', error);
  }
};

window.deleteComment = async function(commentId) {
  if (!confirm('Are you sure you want to delete this comment?')) return;
  
  try {
    await api.request(`/api/admin/comments/${commentId}`, 'DELETE');
    loadComments();
  } catch (error) {
    console.error('Error deleting comment:', error);
  }
};

window.crossPostToLinkedIn = async function(postId, postTitle, postSlug) {
  if (!confirm(`Post "${postTitle}" to LinkedIn?`)) return;
  
  try {
    const apiUrl = window.API_URL || '';
    const postUrl = `${window.location.origin}${window.location.pathname.replace(/\/admin\/.*$/, '')}/post.html?slug=${postSlug}`;
    
    const response = await api.request('/api/linkedin/post', 'POST', {
      postId: postId,
      title: postTitle,
      url: postUrl
    });
    
    if (response.success) {
      alert('Successfully posted to LinkedIn!');
    } else {
      alert('Failed to post to LinkedIn: ' + (response.error || 'Unknown error'));
    }
  } catch (error) {
    console.error('Error cross-posting to LinkedIn:', error);
    if (error.message && error.message.includes('not authenticated')) {
      if (confirm('LinkedIn authentication required. Would you like to authenticate now?')) {
        window.location.href = '/api/linkedin/auth';
      }
    } else {
      alert('Error posting to LinkedIn: ' + (error.message || 'Unknown error'));
    }
  }
};

async function checkLinkedInAuth() {
  try {
    const status = await api.request('/api/linkedin/status');
    if (!status.authenticated) {
      // Show a notice that LinkedIn needs to be connected
      const container = document.getElementById('admin-posts') || document.getElementById('posts-list');
      if (container && !container.querySelector('.linkedin-notice')) {
        const notice = document.createElement('div');
        notice.className = 'linkedin-notice';
        notice.style.cssText = 'padding: var(--spacing-md); background: rgba(0, 119, 181, 0.1); border: 1px solid #0077b5; border-radius: var(--radius-md); margin-bottom: var(--spacing-md);';
        notice.innerHTML = `
          <p style="margin: 0 0 var(--spacing-sm) 0; color: var(--text-primary);">
            <strong>LinkedIn Integration:</strong> Connect your LinkedIn account to enable cross-posting.
          </p>
          <a href="/api/linkedin/auth" class="btn-linkedin" style="display: inline-block; text-decoration: none;">
            Connect LinkedIn
          </a>
        `;
        container.insertBefore(notice, container.firstChild);
      }
    }
  } catch (error) {
    console.error('Error checking LinkedIn auth:', error);
  }
}

function showMessage(message, type = 'info') {
  // Create a toast notification
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 1rem 1.5rem;
    background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#0c71c3'};
    color: white;
    border-radius: var(--radius-lg);
    z-index: 10000;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    animation: slideIn 0.3s ease-out;
  `;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease-out forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
  
  console.log(`[${type.toUpperCase()}] ${message}`);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}



