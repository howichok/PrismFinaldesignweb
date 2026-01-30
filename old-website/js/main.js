/* ═══════════════════════════════════════════════════════════════════════════
   PrismMTR - Main.js
   Starfield Animation + Page-Specific Logic
   ═══════════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════════
  // STARFIELD ANIMATION
  // ═══════════════════════════════════════════════════════════════════════════

  class Starfield {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.stars = [];
      this.animationId = null;
      this.enabled = true;
      this.mouseX = 0;
      this.mouseY = 0;
      this.targetMouseX = 0;
      this.targetMouseY = 0;
      
      this.config = {
        starCount: 150,
        starSpeed: 0.15,
        starSize: { min: 0.5, max: 2 },
        parallaxStrength: 0.02,
        twinkleSpeed: 0.02,
      };
      
      this.init();
    }
    
    init() {
      this.resize();
      this.createStars();
      this.bindEvents();
      this.animate();
    }
    
    resize() {
      const dpr = window.devicePixelRatio || 1;
      this.width = window.innerWidth;
      this.height = window.innerHeight;
      
      this.canvas.width = this.width * dpr;
      this.canvas.height = this.height * dpr;
      this.canvas.style.width = `${this.width}px`;
      this.canvas.style.height = `${this.height}px`;
      
      this.ctx.scale(dpr, dpr);
    }
    
    createStars() {
      this.stars = [];
      const { starCount, starSize } = this.config;
      
      for (let i = 0; i < starCount; i++) {
        this.stars.push({
          x: Math.random() * this.width,
          y: Math.random() * this.height,
          z: Math.random(), // Depth (0 = far, 1 = close)
          size: starSize.min + Math.random() * (starSize.max - starSize.min),
          twinkle: Math.random() * Math.PI * 2,
          speed: 0.5 + Math.random() * 0.5,
        });
      }
    }
    
    bindEvents() {
      window.addEventListener('resize', () => {
        this.resize();
        this.createStars();
      });
      
      document.addEventListener('mousemove', (e) => {
        this.targetMouseX = (e.clientX - this.width / 2) / this.width;
        this.targetMouseY = (e.clientY - this.height / 2) / this.height;
      });
      
      // Check preference on load (use system preference for reduced motion, no localStorage)
      const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      this.enabled = !prefersReducedMotion;
      this.canvas.style.opacity = this.enabled ? '1' : '0';
    }
    
    update() {
      if (!this.enabled) return;
      
      const { starSpeed, parallaxStrength, twinkleSpeed } = this.config;
      
      // Smooth mouse follow
      this.mouseX += (this.targetMouseX - this.mouseX) * 0.05;
      this.mouseY += (this.targetMouseY - this.mouseY) * 0.05;
      
      for (const star of this.stars) {
        // Move stars downward slowly
        star.y += starSpeed * star.speed;
        
        // Wrap around
        if (star.y > this.height) {
          star.y = 0;
          star.x = Math.random() * this.width;
        }
        
        // Twinkle
        star.twinkle += twinkleSpeed;
      }
    }
    
    draw() {
      this.ctx.clearRect(0, 0, this.width, this.height);
      
      if (!this.enabled) return;
      
      const isDark = document.body.classList.contains('dark-mode');
      const baseColor = isDark ? 255 : 0;
      
      for (const star of this.stars) {
        // Parallax offset based on depth
        const parallaxX = this.mouseX * star.z * this.config.parallaxStrength * this.width;
        const parallaxY = this.mouseY * star.z * this.config.parallaxStrength * this.height;
        
        const x = star.x + parallaxX;
        const y = star.y + parallaxY;
        
        // Twinkle alpha
        const twinkleAlpha = 0.3 + 0.7 * ((Math.sin(star.twinkle) + 1) / 2);
        const alpha = (0.2 + star.z * 0.6) * twinkleAlpha;
        
        // Size based on depth
        const size = star.size * (0.5 + star.z * 0.5);
        
        this.ctx.beginPath();
        this.ctx.arc(x, y, size, 0, Math.PI * 2);
        this.ctx.fillStyle = `rgba(${baseColor}, ${baseColor}, ${baseColor}, ${alpha})`;
        this.ctx.fill();
      }
    }
    
    animate() {
      this.update();
      this.draw();
      this.animationId = requestAnimationFrame(() => this.animate());
    }
    
    toggle(enabled) {
      this.enabled = enabled;
      this.canvas.style.opacity = enabled ? '1' : '0';
    }
    
    destroy() {
      if (this.animationId) {
        cancelAnimationFrame(this.animationId);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HERO INTERACTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  function setupHeroActions() {
    const page = document.body.dataset.page;
    if (page !== 'home') return;
    
    // Download CTA
    const downloadBtn = document.querySelector('[data-action="goto-download"]');
    downloadBtn?.addEventListener('click', () => {
      window.location.href = 'download.html';
    });
    
    // Help CTA
    const helpBtn = document.querySelector('[data-action="goto-help"]');
    helpBtn?.addEventListener('click', () => {
      window.location.href = 'help.html';
    });
    
    // Animate stats on load
    animateStats();
  }

  function animateStats() {
    const stats = document.querySelectorAll('.stat__value');
    
    stats.forEach(stat => {
      const target = stat.textContent;
      const isNumeric = /^\d/.test(target);
      
      if (!isNumeric) return;
      
      const value = parseFloat(target.replace(/[^\d.]/g, ''));
      const suffix = target.replace(/[\d.]/g, '');
      
      let current = 0;
      const duration = 1500;
      const startTime = performance.now();
      
      function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 4); // Ease out quart
        
        current = value * eased;
        
        if (target.includes('.')) {
          stat.textContent = current.toFixed(1) + suffix;
        } else {
          stat.textContent = Math.floor(current) + suffix;
        }
        
        if (progress < 1) {
          requestAnimationFrame(update);
        }
      }
      
      // Delay start for staggered effect
      setTimeout(() => {
        requestAnimationFrame(update);
      }, 500);
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SMOOTH SCROLL
  // ═══════════════════════════════════════════════════════════════════════════

  function setupSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(link => {
      link.addEventListener('click', (e) => {
        const targetId = link.getAttribute('href').slice(1);
        const targetEl = document.getElementById(targetId);
        
        if (targetEl) {
          e.preventDefault();
          targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ACCESSIBILITY
  // ═══════════════════════════════════════════════════════════════════════════

  function setupAccessibility() {
    // Reduce motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    
    if (prefersReducedMotion.matches) {
      document.documentElement.style.setProperty('--duration-fast', '0ms');
      document.documentElement.style.setProperty('--duration-normal', '0ms');
      document.documentElement.style.setProperty('--duration-slow', '0ms');
    }
    
    // Theme defaults to Light - only changed via Settings
    // Dark mode is applied by components.js based on localStorage 'prism_darkMode'
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // NOTIFICATION POLLING
  // ═══════════════════════════════════════════════════════════════════════════

  const NOTIFICATION_POLL_INTERVAL = 90000; // 90 seconds
  let notificationPollId = null;

  async function pollNotifications() {
    if (!window.PrismAuth?.read()?.isLoggedIn) return;
    if (!window.PrismBin?.getUnreadCount) return;
    
    try {
      const userId = window.PrismAuth.read()?.userId;
      if (!userId) return;
      
      // Force refresh from server
      const count = await window.PrismBin.getUnreadCount(userId);
      
      // Update badge if PrismUI is available
      if (window.PrismUI?.updateNotificationBadge) {
        window.PrismUI.updateNotificationBadge(count);
      }
    } catch (e) {
      // Silent fail - don't spam console
    }
  }

  function startNotificationPolling() {
    if (notificationPollId) return;
    
    // Initial check after 2 seconds
    setTimeout(pollNotifications, 2000);
    
    // Then poll every 90 seconds
    notificationPollId = setInterval(pollNotifications, NOTIFICATION_POLL_INTERVAL);
  }

  function stopNotificationPolling() {
    if (notificationPollId) {
      clearInterval(notificationPollId);
      notificationPollId = null;
    }
  }

  // Start/stop polling based on auth state
  window.addEventListener('prism:auth:changed', (e) => {
    if (e.detail?.isLoggedIn) {
      startNotificationPolling();
    } else {
      stopNotificationPolling();
    }
  });

  // Stop polling when tab is hidden to save API calls
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopNotificationPolling();
    } else if (window.PrismAuth?.read()?.isLoggedIn) {
      startNotificationPolling();
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // HOME PAGE POSTS
  // ═══════════════════════════════════════════════════════════════════════════

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  async function loadHomePosts() {
    const section = document.getElementById('homePostsSection');
    const list = document.getElementById('homePostsList');
    const empty = document.getElementById('homePostsEmpty');
    const loading = list?.querySelector('.home-posts__loading');
    
    if (!section || !list) return;

    try {
      if (loading) loading.style.display = 'flex';
      if (empty) empty.style.display = 'none';

      const posts = await PrismBin.getPosts(true);
      const publishedPosts = posts
        .filter(p => p.status === 'published')
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 6);

      if (loading) loading.style.display = 'none';

      if (publishedPosts.length === 0) {
        if (empty) empty.style.display = 'flex';
        return;
      }

      if (empty) empty.style.display = 'none';

      // Clear existing posts
      list.querySelectorAll('.home-post-card').forEach(el => el.remove());

      publishedPosts.forEach((post, index) => {
        const categoryLabels = {
          news: 'News',
          update: 'Update',
          announcement: 'Announcement',
          guide: 'Guide',
          showcase: 'Showcase',
        };

        const authorName = post.author?.nickname || post.author?.mcNickname || 'Anonymous';
        const content = (post.content || '').slice(0, 150) + ((post.content || '').length > 150 ? '...' : '');
        
        const card = document.createElement('article');
        card.className = 'home-post-card';
        card.style.animationDelay = `${index * 0.05}s`;
        card.innerHTML = `
          <div class="home-post-card__header">
            <span class="home-post-card__category home-post-card__category--${post.category}">
              ${categoryLabels[post.category] || post.category}
            </span>
            <span class="home-post-card__date">${new Date(post.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
          </div>
          <h3 class="home-post-card__title">${escapeHtml(post.title)}</h3>
          <p class="home-post-card__excerpt">${escapeHtml(content)}</p>
          <div class="home-post-card__footer">
            <span class="home-post-card__author">${escapeHtml(authorName)}</span>
          </div>
        `;
        list.appendChild(card);
      });
    } catch (error) {
      console.error('[Main] Failed to load home posts:', error);
      if (loading) loading.style.display = 'none';
      if (empty) empty.style.display = 'flex';
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════════

  function init() {
    // Initialize Starfield
    const canvas = document.getElementById('starCanvas');
    if (canvas) {
      window.prismStarfield = new Starfield(canvas);
    }
    
    // Setup page features
    setupHeroActions();
    setupSmoothScroll();
    setupAccessibility();
    
    // Load home posts if on home page
    if (document.body.dataset.page === 'home' && window.PrismBin) {
      loadHomePosts();
    } else if (document.body.dataset.page === 'home') {
      // Wait for PrismBin to load
      window.addEventListener('prism:ready', () => {
        loadHomePosts();
      });
    }
    
    // Listen for Service Worker data updates
    setupSWUpdateListener();
    
    console.log('[PrismMTR] Main initialized');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SERVICE WORKER UPDATE HANDLER
  // ═══════════════════════════════════════════════════════════════════════════

  function setupSWUpdateListener() {
    // Listen for data-updated events from prefetch module
    window.addEventListener('prism-data-updated', (event) => {
      const { action } = event.detail || {};
      console.log('[PrismMTR] Data updated from SW:', action);
      
      // Trigger data refresh based on what changed
      if (action) {
        handleDataUpdate(action);
      }
    });
    
    // Listen for auth-expired events (401 from SW)
    window.addEventListener('prism-auth-expired', (event) => {
      console.log('[PrismMTR] Auth expired, logging out');
      // Session expired, force logout
      if (typeof AuthManager !== 'undefined' && AuthManager.logout) {
        AuthManager.logout();
      } else if (window.PrismAuth?.logout) {
        window.PrismAuth.logout();
      } else {
        // Fallback: redirect to home
        window.location.replace('index.html?session_expired=1');
      }
    });
    
    // Listen for SW update available
    window.addEventListener('prism-sw-update-available', () => {
      console.log('[PrismMTR] New Service Worker available');
      // Could show a "refresh for updates" notification here
      if (window.PrismUI?.showToast) {
        window.PrismUI.showToast('Update Available', 'Refresh the page for the latest version', 'info');
      }
    });
  }

  function handleDataUpdate(action) {
    const page = document.body.dataset.page;
    
    // Invalidate relevant caches in PrismData
    if (window.PrismData?.invalidateCache) {
      const cacheMap = {
        'getProjects': 'projects',
        'getPosts': 'posts',
        'getCompanies': 'companies',
        'getUsers': 'users',
      };
      
      const cacheKey = cacheMap[action];
      if (cacheKey) {
        window.PrismData.invalidateCache(cacheKey);
      }
    }
    
    // Reload data based on current page
    switch (page) {
      case 'home':
        if (action === 'getPosts' && typeof loadHomePosts === 'function') {
          loadHomePosts();
        }
        break;
      case 'projects':
        if (action === 'getProjects' && window.ProjectsPage?.loadProjects) {
          window.ProjectsPage.loadProjects();
        }
        break;
      case 'posts':
        if (action === 'getPosts' && window.PostsPage?.loadPosts) {
          window.PostsPage.loadPosts();
        }
        break;
      case 'discovery':
        if (window.DiscoveryPage?.refresh) {
          window.DiscoveryPage.refresh();
        }
        break;
      case 'dashboard':
        // Dashboard handles its own refresh
        window.dispatchEvent(new CustomEvent('prism:data-refresh', { detail: { action } }));
        break;
    }
  }

  // Wait for components to load first
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      // Give components.js time to inject
      setTimeout(init, 50);
    });
  } else {
    setTimeout(init, 50);
  }

})();
