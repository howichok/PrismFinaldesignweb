/* ═══════════════════════════════════════════════════════════════════════════
   Dashboard Projects Page - Manages user's projects
   ═══════════════════════════════════════════════════════════════════════════ */

(function() {
  'use strict';

  let currentUser = null;
  let userProjects = [];

  // ═══════════════════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════════

  async function init() {
    // Only run on projects page
    if (document.body.dataset.section !== 'projects') return;

    console.log('[Dashboard-Projects] Initializing...');

    // Wait for auth to be ready
    await waitForAuth();

    // Get current user
    currentUser = typeof PrismAuth !== 'undefined' ? PrismAuth.getUser() : null;

    if (!currentUser) {
      console.log('[Dashboard-Projects] No user logged in');
      window.location.href = 'index.html';
      return;
    }

    // Update sidebar user info
    updateSidebarUser();

    // Setup event listeners
    setupEventListeners();

    // Load projects
    await loadProjects();

    // Check admin status
    checkAdminStatus();

    console.log('[Dashboard-Projects] Initialized');
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
  // LOAD PROJECTS
  // ═══════════════════════════════════════════════════════════════════════════

  async function loadProjects() {
    const loadingEl = document.getElementById('projectsLoading');
    const emptyEl = document.getElementById('projectsEmpty');
    const gridEl = document.getElementById('projectsGrid');

    if (loadingEl) loadingEl.style.display = 'flex';
    if (emptyEl) emptyEl.style.display = 'none';
    if (gridEl) gridEl.style.display = 'none';

    try {
      // Get user's projects
      if (typeof PrismBin !== 'undefined' && PrismBin.getUserProjects) {
        userProjects = await PrismBin.getUserProjects(currentUser.id) || [];
      } else if (typeof PrismBin !== 'undefined' && PrismBin.getProjects) {
        const allProjects = await PrismBin.getProjects() || [];
        userProjects = allProjects.filter(p => 
          p.authorId === currentUser.id || 
          p.author_id === currentUser.id ||
          p.ownerId === currentUser.id ||
          p.owner_id === currentUser.id ||
          (p.team && p.team.some(t => t.id === currentUser.id))
        );
      } else {
        userProjects = [];
      }

      console.log('[Dashboard-Projects] Loaded projects:', userProjects.length);

      if (loadingEl) loadingEl.style.display = 'none';

      if (userProjects.length === 0) {
        if (emptyEl) emptyEl.style.display = 'block';
        if (gridEl) gridEl.style.display = 'none';
      } else {
        renderProjects();
        if (gridEl) gridEl.style.display = 'grid';
        if (emptyEl) emptyEl.style.display = 'none';
      }
    } catch (error) {
      console.error('[Dashboard-Projects] Failed to load projects:', error);
      if (loadingEl) loadingEl.style.display = 'none';
      if (gridEl) gridEl.style.display = 'none';
      
      // Show error state
      const errorEl = document.getElementById('projectsError');
      if (!errorEl) {
        const container = document.querySelector('.projects-container');
        if (container) {
          const errorDiv = document.createElement('div');
          errorDiv.id = 'projectsError';
          errorDiv.className = 'projects-error';
          errorDiv.innerHTML = `
            <div class="empty-state">
              <div class="empty-state__icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              </div>
              <h3 class="empty-state__title">Failed to load projects</h3>
              <p class="empty-state__description">${error.message || 'An error occurred while loading your projects.'}</p>
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

  function renderProjects() {
    const gridEl = document.getElementById('projectsGrid');
    if (!gridEl) return;

    const categoryLabels = {
      metro: 'Metro / Transit',
      rail: 'Railway',
      city: 'City Building',
      infrastructure: 'Infrastructure',
      creative: 'Creative'
    };

    gridEl.innerHTML = userProjects.map(project => {
      const name = project.name || 'Untitled Project';
      const description = project.description ? project.description.substring(0, 100) + '...' : 'No description';
      const category = project.category || 'creative';
      const categoryLabel = categoryLabels[category] || category;
      const coverUrl = project.coverUrl || project.cover_url || project.thumbnailUrl || project.thumbnail_url;
      const team = project.team || [];
      const memberCount = team.length || 1;

      // Owner info
      const owner = project.owner || currentUser;
      const ownerName = owner?.nickname || owner?.mcNickname || 'You';
      const ownerInitials = ownerName.slice(0, 2).toUpperCase();
      const ownerId = owner?.id || currentUser?.id;

      // Team avatars (max 3)
      const teamAvatars = team.slice(0, 3).map(member => {
        const memberName = member.nickname || member.mcNickname || 'User';
        const memberInitials = memberName.slice(0, 2).toUpperCase();
        return `
          <div class="project-card__team-avatar" data-action="show-user-profile" data-user-id="${member.id}" title="${escapeHtml(memberName)}">
            ${member.avatar ? `<img src="${member.avatar}" alt="${memberName}">` : memberInitials}
          </div>
        `;
      }).join('');

      return `
        <article class="project-card" data-project-id="${project.id}">
          <div class="project-card__cover">
            ${coverUrl ? `<img src="${coverUrl}" alt="${escapeHtml(name)}">` : `
              <div class="project-card__cover-placeholder">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                </svg>
              </div>
            `}
          </div>
          <div class="project-card__body">
            <span class="project-card__category">${escapeHtml(categoryLabel)}</span>
            <h3 class="project-card__name">${escapeHtml(name)}</h3>
            <p class="project-card__description">${escapeHtml(description)}</p>
            <div class="project-card__meta">
              <div class="project-card__owner">
                <div class="user-chip user-chip--sm" data-action="show-user-profile" data-user-id="${ownerId}">
                  <div class="user-chip__avatar">
                    ${owner?.avatar ? `<img src="${owner.avatar}" alt="${ownerName}">` : ownerInitials}
                  </div>
                  <span class="user-chip__name">${escapeHtml(ownerName)}</span>
                </div>
              </div>
              ${team.length > 0 ? `
                <div class="project-card__team">
                  ${teamAvatars}
                  ${team.length > 3 ? `<span class="project-card__team-more">+${team.length - 3}</span>` : ''}
                </div>
              ` : ''}
            </div>
          </div>
          <div class="project-card__footer">
            <a href="project.html?id=${project.id}" class="btn btn--sm btn--outline">View</a>
            <button class="btn btn--sm btn--ghost" onclick="editProject('${project.id}')">Edit</button>
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
  // PROJECT ACTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  window.editProject = function(projectId) {
    // For edit, still go to dashboard (complex edit wizard with team management)
    // TODO: Could be enhanced to use local modal with ?mode=edit&id= param
    window.location.href = `dashboard.html?action=edit-project&projectId=${projectId}`;
  };

  window.createNewProject = function() {
    // Use shared modal (no redirect!)
    if (window.PrismCreateModals) {
      window.PrismCreateModals.openProject();
    } else {
      console.error('[Dashboard-Projects] PrismCreateModals not loaded');
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
        console.log(`[Dashboard-Projects] ${title}: ${message}`);
      }
    }
  }

  // Expose loadProjects for refresh after create
  window.loadProjects = loadProjects;

  // ═══════════════════════════════════════════════════════════════════════════
  // EVENT LISTENERS
  // ═══════════════════════════════════════════════════════════════════════════

  function setupEventListeners() {
    // Create project buttons - use shared modal (no redirect!)
    document.getElementById('createProjectBtn')?.addEventListener('click', () => {
      if (window.PrismCreateModals) {
        window.PrismCreateModals.openProject();
      } else {
        console.error('[Dashboard-Projects] PrismCreateModals not loaded');
      }
    });

    document.getElementById('createProjectEmptyBtn')?.addEventListener('click', () => {
      if (window.PrismCreateModals) {
        window.PrismCreateModals.openProject();
      } else {
        console.error('[Dashboard-Projects] PrismCreateModals not loaded');
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
