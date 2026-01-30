/**
 * PrismMTR Posts Page - JavaScript
 *
 * Handles:
 * - Loading and displaying posts
 * - Filtering by category
 */

(function () {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════════════════

  let allPosts = [];
  let currentCategory = '';
  let currentView = 'grid'; // 'list' or 'grid'

  // ═══════════════════════════════════════════════════════════════════════════
  // DOM ELEMENTS
  // ═══════════════════════════════════════════════════════════════════════════

  const elements = {
    postsList: null,
    postsLoading: null,
    postsEmpty: null,
    filterCategory: null,
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDERING
  // ═══════════════════════════════════════════════════════════════════════════

  function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function getInitials(name) {
    return (name || 'A').slice(0, 2).toUpperCase();
  }

  /**
   * Render markdown content safely
   */
  function renderMarkdown(content) {
    if (!content) return '';

    // Configure marked options
    if (typeof marked !== 'undefined') {
      marked.setOptions({
        breaks: true,     // Convert \n to <br>
        gfm: true,        // GitHub Flavored Markdown
        headerIds: false, // Disable auto-generated header IDs
      });

      try {
        let html = marked.parse(content);

        // Sanitize HTML to prevent XSS
        if (typeof DOMPurify !== 'undefined') {
          html = DOMPurify.sanitize(html, {
            ALLOWED_TAGS: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'ul', 'ol', 'li',
                           'strong', 'em', 'a', 'code', 'pre', 'blockquote', 'img', 'hr'],
            ALLOWED_ATTR: ['href', 'title', 'alt', 'src', 'target'],
          });
        }

        return html;
      } catch (e) {
        console.warn('[Posts] Markdown parsing failed:', e);
        return escapeHtml(content);
      }
    }

    // Fallback to plain text if marked is not available
    return escapeHtml(content);
  }

  function renderPost(post, view = 'grid') {
    const categoryLabels = {
      news: 'News',
      update: 'Update',
      announcement: 'Announcement',
      guide: 'Guide',
      showcase: 'Showcase',
    };

    // Get avatar - prefer Discord avatar_url
    const avatarUrl = post.author?.avatar || post.author?.avatar_url;
    const authorName = post.author?.nickname || post.author?.mcNickname || 'Anonymous';
    const initials = getInitials(authorName);
    
    const avatarHtml = avatarUrl 
      ? `<img src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(authorName)}" class="post-card__avatar post-card__avatar--image" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
         <div class="post-card__avatar" style="display: none;">${initials}</div>`
      : `<div class="post-card__avatar">${initials}</div>`;

    // Truncate content for grid view
    const content = view === 'grid' 
      ? (post.content || '').slice(0, 200) + ((post.content || '').length > 200 ? '...' : '')
      : post.content;

    if (view === 'list') {
      return `
        <article class="post-card post-card--list">
          <div class="post-card__main">
            <div class="post-card__header">
              <span class="post-card__category post-card__category--${post.category}">
                ${categoryLabels[post.category] || post.category}
              </span>
              <span class="post-card__date">${formatDate(post.createdAt)}</span>
            </div>
            <h2 class="post-card__title">${escapeHtml(post.title)}</h2>
            <div class="post-card__content markdown-content">${renderMarkdown(content)}</div>
          </div>
          <div class="post-card__footer">
            <div class="post-card__author">
              ${avatarHtml}
              <span class="post-card__author-name">${escapeHtml(authorName)}</span>
            </div>
          </div>
        </article>
      `;
    }

    return `
      <article class="post-card post-card--grid">
        <div class="post-card__header">
          <span class="post-card__category post-card__category--${post.category}">
            ${categoryLabels[post.category] || post.category}
          </span>
          <span class="post-card__date">${formatDate(post.createdAt)}</span>
        </div>
        <h2 class="post-card__title">${escapeHtml(post.title)}</h2>
        <div class="post-card__content markdown-content">${renderMarkdown(content)}</div>
        <div class="post-card__footer">
          <div class="post-card__author">
            ${avatarHtml}
            <span class="post-card__author-name">${escapeHtml(authorName)}</span>
          </div>
        </div>
      </article>
    `;
  }

  function render() {
    if (!elements.postsList) return;

    // Filter posts
    let filteredPosts = allPosts;
    if (currentCategory) {
      filteredPosts = allPosts.filter(p => p.category === currentCategory);
    }

    // Sort by date (newest first)
    filteredPosts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Clear existing post cards
    elements.postsList.querySelectorAll('.post-card').forEach(el => el.remove());

    // Hide loading
    if (elements.postsLoading) {
      elements.postsLoading.style.display = 'none';
    }

    // Show empty state or posts
    if (filteredPosts.length === 0) {
      if (elements.postsEmpty) {
        elements.postsEmpty.style.display = 'flex';
      }
    } else {
      if (elements.postsEmpty) {
        elements.postsEmpty.style.display = 'none';
      }

      filteredPosts.forEach((post, index) => {
        const html = renderPost(post, currentView);
        const template = document.createElement('template');
        template.innerHTML = html.trim();
        const element = template.content.firstChild;
        element.style.animationDelay = `${index * 0.05}s`;
        elements.postsList.appendChild(element);
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DATA LOADING
  // ═══════════════════════════════════════════════════════════════════════════

  async function loadPosts() {
    if (elements.postsLoading) {
      elements.postsLoading.style.display = 'flex';
    }
    if (elements.postsEmpty) {
      elements.postsEmpty.style.display = 'none';
    }

    try {
      allPosts = await PrismBin.getPosts(true);
      console.log('[Posts] Loaded', allPosts.length, 'posts');
    } catch (error) {
      console.error('[Posts] Failed to load posts:', error);
      allPosts = [];
    }

    render();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EVENT LISTENERS
  // ═══════════════════════════════════════════════════════════════════════════

  function setupEventListeners() {
    // Category filter
    elements.filterCategory?.addEventListener('change', (e) => {
      currentCategory = e.target.value;
      render();
    });

    // View toggle (in-memory only - not persisted)
    document.querySelectorAll('.view-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        if (view === currentView) return;
        
        currentView = view;
        
        // Update buttons
        document.querySelectorAll('.view-toggle-btn').forEach(b => {
          b.classList.toggle('active', b.dataset.view === view);
        });
        
        // Update container class
        if (elements.postsList) {
          elements.postsList.classList.toggle('posts-list--grid', view === 'grid');
          elements.postsList.classList.toggle('posts-list--list', view === 'list');
        }
        
        render();
      });
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════════

  function cacheElements() {
    elements.postsList = document.getElementById('postsList');
    elements.postsLoading = document.getElementById('postsLoading');
    elements.postsEmpty = document.getElementById('postsEmpty');
    elements.filterCategory = document.getElementById('filterCategory');
  }

  async function init() {
    if (document.body.dataset.page !== 'posts') return;

    console.log('[Posts] Initializing...');

    cacheElements();
    
    // Default view is grid (no localStorage)
    // currentView is already initialized to 'grid'
    
    // Set initial view
    if (elements.postsList) {
      elements.postsList.classList.toggle('posts-list--grid', currentView === 'grid');
      elements.postsList.classList.toggle('posts-list--list', currentView === 'list');
    }
    
    // Set active button
    document.querySelectorAll('.view-toggle-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === currentView);
    });
    
    setupEventListeners();
    await loadPosts();

    console.log('[Posts] Page initialized');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 100));
  } else {
    setTimeout(init, 100);
  }
})();
