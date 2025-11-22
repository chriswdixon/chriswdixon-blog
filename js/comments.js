// ============================================
// BLOG PLATFORM - COMMENTS FUNCTIONALITY
// ============================================

document.addEventListener('DOMContentLoaded', function() {
  const commentsContainer = document.getElementById('comments-container');
  const commentForm = document.getElementById('comment-form');
  const postId = getPostIdFromUrl();

  if (commentsContainer && postId) {
    loadComments();

    if (commentForm) {
      commentForm.addEventListener('submit', handleCommentSubmit);
    }
  }

  async function loadComments() {
    if (!commentsContainer || !postId) return;

    try {
      commentsContainer.innerHTML = '<div class="loading">Loading comments...</div>';
      const comments = await api.getComments(postId);

      if (comments.length === 0) {
        commentsContainer.innerHTML = '';
        return;
      }

      commentsContainer.innerHTML = comments.map(comment => createCommentHTML(comment)).join('');
      
      // Add reply functionality
      attachReplyHandlers();
    } catch (error) {
      console.error('Error loading comments:', error);
      commentsContainer.innerHTML = '';
    }
  }

  function createCommentHTML(comment, depth = 0) {
    const user = api.getUser();
    const isAuthorized = user && user.id === comment.user_id;
    
    let html = `
      <div class="comment" data-id="${comment.id}" data-depth="${depth}">
        <div class="comment-header">
          <div class="comment-author">
            <strong>${comment.user_name || comment.author_name}</strong>
            ${comment.author_url ? `<a href="${comment.author_url}" target="_blank" rel="nofollow">${comment.author_url}</a>` : ''}
          </div>
          <div class="comment-meta">
            <time>${utils.formatDateTime(comment.created_at)}</time>
          </div>
        </div>
        <div class="comment-content">
          ${escapeHtml(comment.content)}
        </div>
        <div class="comment-actions">
          <button class="btn-reply" onclick="showReplyForm('${comment.id}')">Reply</button>
          ${isAuthorized ? `
            <button class="btn-edit" onclick="editComment('${comment.id}')">Edit</button>
            <button class="btn-delete" onclick="deleteComment('${comment.id}')">Delete</button>
          ` : ''}
        </div>
        <div class="comment-reply-form" id="reply-form-${comment.id}" style="display: none;"></div>
        ${comment.replies && comment.replies.length > 0 ? `
          <div class="comment-replies">
            ${comment.replies.map(reply => createCommentHTML(reply, depth + 1)).join('')}
          </div>
        ` : ''}
      </div>
    `;
    return html;
  }

  function attachReplyHandlers() {
    // Reply handlers are attached via onclick in the HTML
  }

  async function handleCommentSubmit(e) {
    e.preventDefault();
    if (!commentForm || !postId) return;

    const formData = new FormData(commentForm);
    const authorName = formData.get('author_name');
    const authorEmail = formData.get('author_email');
    const authorUrl = formData.get('author_url');
    const content = formData.get('content');
    const parentId = formData.get('parent_id');

    if (!authorName || !content) {
      alert('Name and content are required');
      return;
    }

    const submitButton = commentForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'Posting...';

    try {
      const user = api.getUser();
      const comment = {
        author_name: authorName,
        author_email: authorEmail || null,
        author_url: authorUrl || null,
        content: content,
        parent_id: parentId || null,
        user_id: user ? user.id : null
      };

      await api.postComment(postId, comment);
      
      // Reset form
      commentForm.reset();
      commentForm.style.display = 'block';
      document.querySelectorAll('.comment-reply-form').forEach(form => {
        form.style.display = 'none';
      });

      // Reload comments
      loadComments();
    } catch (error) {
      console.error('Error posting comment:', error);
      // Error suppressed - no user notification
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = 'Post Comment';
    }
  }

  function getPostIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('slug');
    // If we have a slug, we'll need to get the post ID from the post data
    // For now, we'll use the slug itself and handle it in the API
    return slug || null;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Global functions for onclick handlers
  window.showReplyForm = function(parentId) {
    const replyFormContainer = document.getElementById(`reply-form-${parentId}`);
    if (!replyFormContainer) return;

    // Hide other reply forms
    document.querySelectorAll('.comment-reply-form').forEach(form => {
      if (form.id !== `reply-form-${parentId}`) {
        form.style.display = 'none';
      }
    });

    if (replyFormContainer.style.display === 'none' || !replyFormContainer.innerHTML) {
      replyFormContainer.innerHTML = `
        <form class="reply-form" onsubmit="event.preventDefault(); handleReplySubmit('${parentId}', event);">
          <input type="hidden" name="parent_id" value="${parentId}">
          <div class="form-group">
            <input type="text" name="author_name" placeholder="Your name" required>
          </div>
          <div class="form-group">
            <input type="email" name="author_email" placeholder="Your email (optional)">
          </div>
          <div class="form-group">
            <textarea name="content" placeholder="Your reply..." required></textarea>
          </div>
          <div class="form-actions">
            <button type="submit" class="btn-primary">Post Reply</button>
            <button type="button" class="btn-secondary" onclick="cancelReply('${parentId}')">Cancel</button>
          </div>
        </form>
      `;
      replyFormContainer.style.display = 'block';
    } else {
      replyFormContainer.style.display = replyFormContainer.style.display === 'none' ? 'block' : 'none';
    }
  };

  window.handleReplySubmit = async function(parentId, event) {
    const form = event.target.closest('form');
    const formData = new FormData(form);
    
    const authorName = formData.get('author_name');
    const authorEmail = formData.get('author_email');
    const content = formData.get('content');

    if (!authorName || !content) {
      return;
    }

    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'Posting...';

    try {
      const user = api.getUser();
      const comment = {
        author_name: authorName,
        author_email: authorEmail || null,
        content: content,
        parent_id: parentId,
        user_id: user ? user.id : null
      };

      await api.postComment(postId, comment);
      
      // Reload comments
      loadComments();
    } catch (error) {
      console.error('Error posting reply:', error);
      // Error suppressed - no user notification
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = 'Post Reply';
    }
  };

  window.cancelReply = function(parentId) {
    const replyFormContainer = document.getElementById(`reply-form-${parentId}`);
    if (replyFormContainer) {
      replyFormContainer.style.display = 'none';
      replyFormContainer.innerHTML = '';
    }
  };
});



