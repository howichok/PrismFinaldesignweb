/* ═══════════════════════════════════════════════════════════════════════════
   Dashboard Posts Page - Manages user's posts
   ═══════════════════════════════════════════════════════════════════════════ */

(function() {
  'use strict';

  let currentUser = null;
  let userPosts = [];

  // ═══════════════════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════════

  async function init() {
    // Only run on posts page
    if (document.body.dataset.section !== 'posts') return;

    console.log('[Dashboard-Posts] Initializing...');

    // Wait for auth to be ready
    await waitForAuth();

    // Get current user
    currentUser = typeof PrismAuth !== 'undefined' ? PrismAuth.getUser() : null;

    if (!currentUser) {
      console.log('[Dashboard-Posts] No user logged in');
      window.location.href = 'index.html';
      return;
    }

    // Update sidebar user info
    updateSidebarUser();

    // Setup event listeners
    setupEventListeners();

    // Load posts
    await loadPosts();

    // Check admin status
    checkAdminStatus();

    console.log('[Dashboard-Posts] Initialized');
  }

  // Wait for PrismAuth to be ready
  function waitForAuth() {
    return new Promise(resolve => {
      if (typeof PrismAuth !== 'undefined' && PrismAuth.getUser()) {
        resolve();
        return;
      }
      
      let attempts = 0;
      const check = setInterval(() => {
        attempts++;
        if ((typeof PrismAuth !== 'undefined' && PrismAuth.getUser()) || attempts > 20) {
          clearInterval(check);
          resolve();
        }
      }, 100);
    });
  }

  function updateSidebarUser() {
    const avatarEl = document.getElementById('sidebarUserAvatar');
    const nameEl = document.getElementById('sidebarUserName');
    const roleEl = document.getElementById('sidebarUserRole');

    if (!currentUser) return;

    const nickname = currentUser.mcNickname || currentUser.nickname || currentUser.email?.split('@')[0] || 'User';
    const initials = nickname.slice(0, 2).toUpperCase();

    if (nameEl) {
      nameEl.textContent = nickname;
      nameEl.dataset.userId = currentUser.id;
    }
    
    if (avatarEl) {
      avatarEl.dataset.userId = currentUser.id;
      if (currentUser.avatar) {
        avatarEl.innerHTML = `<img src="${currentUser.avatar}" alt="${nickname}" class="sidebar-avatar-img">`;
        avatarEl.classList.add('has-avatar');
      } else {
        avatarEl.textContent = initials;
      }
    }

    if (roleEl) {
      const roleLabels = { user: 'Member', mod: 'Moderator', admin: 'Administrator' };
      roleEl.textContent = roleLabels[currentUser.role] || 'Member';
    }

    // Add click handlers for sidebar user profile
    [avatarEl, nameEl].filter(Boolean).forEach(el => {
      el.addEventListener('click', () => {
        if (currentUser.id && typeof showUserProfile === 'function') {
          showUserProfile(currentUser.id);
        }
      });
    });
  }

  function checkAdminStatus() {
    const adminSection = document.getElementById('adminSection');
    if (adminSection && currentUser) {
      const isAdmin = currentUser.role === 'admin' || currentUser.role === 'mod';
      adminSection.style.display = isAdmin ? 'block' : 'none';
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LOAD POSTS
  // ═══════════════════════════════════════════════════════════════════════════

  async function loadPosts() {
    const loadingEl = document.getElementById('postsLoading');
    const emptyEl = document.getElementById('postsEmpty');
    const gridEl = document.getElementById('postsGrid');

    if (loadingEl) loadingEl.style.display = 'flex';
    if (emptyEl) emptyEl.style.display = 'none';
    if (gridEl) gridEl.style.display = 'none';

    try {
      // Get user's posts
      if (typeof PrismBin !== 'undefined' && PrismBin.getUserPosts) {
        userPosts = await PrismBin.getUserPosts(currentUser.id) || [];
      } else if (typeof PrismBin !== 'undefined' && PrismBin.getPosts) {
        const allPosts = await PrismBin.getPosts() || [];
        userPosts = allPosts.filter(p => p.authorId === currentUser.id || p.author_id === currentUser.id);
      } else {
        userPosts = [];
      }

      console.log('[Dashboard-Posts] Loaded posts:', userPosts.length);

      if (loadingEl) loadingEl.style.display = 'none';

      if (userPosts.length === 0) {
        if (emptyEl) emptyEl.style.display = 'block';
        if (gridEl) gridEl.style.display = 'none';
      } else {
        renderPosts();
        if (gridEl) gridEl.style.display = 'grid';
        if (emptyEl) emptyEl.style.display = 'none';
      }
    } catch (error) {
      console.error('[Dashboard-Posts] Failed to load posts:', error);
      if (loadingEl) loadingEl.style.display = 'none';
      if (gridEl) gridEl.style.display = 'none';
      
      // Show error state
      const errorEl = document.getElementById('postsError');
      if (!errorEl) {
        // Create error element if it doesn't exist
        const container = document.querySelector('.posts-container');
        if (container) {
          const errorDiv = document.createElement('div');
          errorDiv.id = 'postsError';
          errorDiv.className = 'posts-error';
          errorDiv.innerHTML = `
            <div class="empty-state">
              <div class="empty-state__icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              </div>
              <h3 class="empty-state__title">Failed to load posts</h3>
              <p class="empty-state__description">${error.message || 'An error occurred while loading your posts.'}</p>
              <button class="btn btn--primary" onclick="location.reload()">Retry</button>
            </div>
          `;
          container.appendChild(errorDiv);
        }
      } else {
        errorEl.style.display = 'block';
      }
      if (emptyEl) emptyEl.style.display = 'none';
    }
  }

  function renderPosts() {
    const gridEl = document.getElementById('postsGrid');
    if (!gridEl) return;

    gridEl.innerHTML = userPosts.map(post => {
      const title = post.title || 'Untitled Post';
      const excerpt = post.content ? post.content.substring(0, 120) + '...' : 'No content';
      const date = post.createdAt || post.created_at;
      const formattedDate = date ? new Date(date).toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: 'numeric'
      }) : 'Unknown date';
      const status = post.published ? 'Published' : 'Draft';
      const statusClass = post.published ? 'badge--success' : 'badge--warning';
      
      // Author info for clickable avatar
      const author = post.author || currentUser;
      const authorName = author?.nickname || author?.mcNickname || 'You';
      const authorInitials = authorName.slice(0, 2).toUpperCase();
      const authorId = author?.id || currentUser?.id;

      // Company info if posted by company
      const companyName = post.company?.name || post.companyName;

      return `
        <article class="post-card" data-post-id="${post.id}">
          <div class="post-card__header">
            <div class="post-card__author">
              <div class="user-chip" data-action="show-user-profile" data-user-id="${authorId}">
                <div class="user-chip__avatar">
                  ${author?.avatar ? `<img src="${author.avatar}" alt="${authorName}">` : authorInitials}
                </div>
                <span class="user-chip__name">${escapeHtml(authorName)}</span>
              </div>
              ${companyName ? `<span class="post-card__company">via ${escapeHtml(companyName)}</span>` : ''}
            </div>
            <span class="badge ${statusClass}">${status}</span>
          </div>
          <h3 class="post-card__title">${escapeHtml(title)}</h3>
          <p class="post-card__excerpt">${escapeHtml(excerpt)}</p>
          <div class="post-card__meta">
            <span class="post-card__date">${formattedDate}</span>
          </div>
          <div class="post-card__footer">
            <button class="btn btn--sm btn--outline" onclick="editPost('${post.id}')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              Edit
            </button>
            <button class="btn btn--sm btn--ghost btn--danger" onclick="deletePost('${post.id}')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
              Delete
            </button>
          </div>
        </article>
      `;
    }).join('');

    // Add click handlers for user profiles
    gridEl.querySelectorAll('[data-action="show-user-profile"]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const userId = el.dataset.userId;
        if (userId && typeof showUserProfile === 'function') {
          showUserProfile(userId);
        }
      });
    });
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // POST ACTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  window.editPost = function(postId) {
    // For edit, still go to dashboard (complex edit with markdown preview)
    // TODO: Could be enhanced to use local modal with ?mode=edit&id= param
    window.location.href = `dashboard.html?action=edit-post&postId=${postId}`;
  };

  window.createNewPost = function() {
    // Use shared modal (no redirect!)
    if (window.PrismCreateModals) {
      window.PrismCreateModals.openPost();
    } else {
      console.error('[Dashboard-Posts] PrismCreateModals not loaded');
    }
  };

  window.deletePost = async function(postId) {
    if (!confirm('Are you sure you want to delete this post?')) return;

    try {
      if (typeof PrismBin !== 'undefined' && PrismBin.deletePost) {
        await PrismBin.deletePost(postId);
      }
      showToast('Success', 'Post deleted');
      await loadPosts();
    } catch (error) {
      console.error('[Dashboard-Posts] Failed to delete post:', error);
      showToast('Error', 'Failed to delete post');
    }
  };

  function showToast(title, message) {
    if (window.PrismUI && window.PrismUI.showToast) {
      window.PrismUI.showToast(title, message);
    } else {
      const toast = document.getElementById('toast');
      if (toast) {
        toast.querySelector('.toast__title').textContent = title;
        toast.querySelector('.toast__message').textContent = message;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
      } else {
        console.log(`[Dashboard-Posts] ${title}: ${message}`);
      }
    }
  }

  // Expose loadPosts for refresh after create
  window.loadPosts = loadPosts;

  // ═══════════════════════════════════════════════════════════════════════════
  // EVENT LISTENERS
  // ═══════════════════════════════════════════════════════════════════════════

  function setupEventListeners() {
    // Create post buttons - use shared modal (no redirect!)
    document.getElementById('createPostBtn')?.addEventListener('click', () => {
      if (window.PrismCreateModals) {
        window.PrismCreateModals.openPost();
      } else {
        console.error('[Dashboard-Posts] PrismCreateModals not loaded');
      }
    });

    document.getElementById('createPostEmptyBtn')?.addEventListener('click', () => {
      if (window.PrismCreateModals) {
        window.PrismCreateModals.openPost();
      } else {
        console.error('[Dashboard-Posts] PrismCreateModals not loaded');
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RUN
  // ═══════════════════════════════════════════════════════════════════════════

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
