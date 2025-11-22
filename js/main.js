// ============================================
// BLOG PLATFORM - API CLIENT
// ============================================

// Configuration
// API_URL should be set in js/config.js or by window.API_URL
// If config.js hasn't loaded yet, this will use the default
const API_URL = window.API_URL || '';

// API Client Class
class ApiClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl || API_URL || '';
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const token = localStorage.getItem('access_token');
    
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(error.error || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API request error:', error);
      throw error;
    }
  }

  // Auth methods
  async login(email, password) {
    const data = await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    if (data.access_token) {
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('user', JSON.stringify(data.user));
    }
    return data;
  }

  async register(email, password, name) {
    const data = await this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name })
    });
    if (data.access_token) {
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('user', JSON.stringify(data.user));
    }
    return data;
  }

  async getCurrentUser() {
    return this.request('/api/auth/user');
  }

  logout() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
  }

  isAuthenticated() {
    return !!localStorage.getItem('access_token');
  }

  getToken() {
    return localStorage.getItem('access_token');
  }

  getUser() {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  }

  // Blog methods
  async getPosts(options = {}) {
    const params = new URLSearchParams();
    if (options.featured) params.append('featured', 'true');
    if (options.category && options.category !== 'all') params.append('category', options.category);
    if (options.search) params.append('search', options.search);
    if (options.sort) params.append('sort', options.sort);
    if (options.page) params.append('page', options.page);
    if (options.limit) params.append('limit', options.limit);
    
    const query = params.toString();
    return this.request(`/api/blog/posts${query ? '?' + query : ''}`);
  }

  async getPostBySlug(slug) {
    return this.request(`/api/blog/posts/${slug}`);
  }

  async incrementViewCount(postId) {
    return this.request(`/api/blog/posts/${postId}/view`, {
      method: 'POST'
    });
  }

  async getCategories() {
    return this.request('/api/blog/categories');
  }

  async getTags() {
    return this.request('/api/blog/tags');
  }

  // Comments methods
  async getComments(postId) {
    return this.request(`/api/blog/posts/${postId}/comments`);
  }

  async postComment(postId, comment) {
    return this.request(`/api/blog/posts/${postId}/comments`, {
      method: 'POST',
      body: JSON.stringify(comment)
    });
  }

  // Newsletter
  async subscribeNewsletter(email) {
    return this.request('/api/blog/newsletter', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
  }
}

// Initialize API client
const api = new ApiClient();

// Export for use in other scripts
if (typeof window !== 'undefined') {
  window.api = api;
}

// Utility functions
const utils = {
  formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  },

  formatDateTime(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  },

  truncate(text, length = 150) {
    if (!text) return '';
    if (text.length <= length) return text;
    return text.substring(0, length).trim() + '...';
  },

  slugify(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
};

// Export utils
if (typeof window !== 'undefined') {
  window.utils = utils;
}


