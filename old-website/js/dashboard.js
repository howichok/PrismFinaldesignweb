/**
 * PrismMTR Dashboard - JavaScript
 *
 * Handles:
 * - Sidebar navigation between sections
 * - Create Post/Project modals
 * - Settings management
 * - Admin panel (mod/admin only)
 * - User info display
 */

(function () {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════════════════

  let currentUser = null;
  let currentSection = 'home';
  let projectImageData = null;
  let companyLogoData = null;
  let projectCoowners = [];
  let projectMembers = [];

  // Permissions state
  let selectedOverrideUser = null;
  let userOverrides = {};

  // Companies state
  let selectedCompany = null;
  let userCompanies = [];

  // ═══════════════════════════════════════════════════════════════════════════
  // DOM ELEMENTS
  // ═══════════════════════════════════════════════════════════════════════════

  const elements = {
    // Sidebar
    sidebarUserAvatar: null,
    sidebarUserName: null,
    sidebarUserRole: null,
    adminSection: null,

    // Settings
    settingMcNickname: null,
    settingEmail: null,
    settingRole: null,
    dashboardThemeToggle: null,
    dashboardStarsToggle: null,
    discordConnectionStatus: null,

    // Post Modal
    createPostModal: null,
    createPostForm: null,
    postTitle: null,
    postContent: null,
    postCategory: null,
    submitPostBtn: null,

    // Project Modal
    createProjectModal: null,
    createProjectForm: null,
    projectName: null,
    projectDescription: null,
    projectCategory: null,
    projectStatus: null,
    projectImageUpload: null,
    projectImageInput: null,
    projectImagePlaceholder: null,
    projectImagePreview: null,
    submitProjectBtn: null,

    // Team inputs
    projectCoownerInput: null,
    projectCoownersList: null,
    projectCoownersEmpty: null,
    addProjectCoownerBtn: null,
    projectMemberInput: null,
    projectMembersList: null,
    projectMembersEmpty: null,
    addProjectMemberBtn: null,
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // SIDEBAR NAVIGATION
  // ═══════════════════════════════════════════════════════════════════════════

  function switchSection(sectionName) {
    if (currentSection === sectionName) return;

    // Update nav items
    document.querySelectorAll('.sidebar-nav__item').forEach(item => {
      item.classList.toggle('active', item.dataset.section === sectionName);
    });

    // Update sections
    document.querySelectorAll('.dashboard-section').forEach(section => {
      section.classList.toggle('active', section.dataset.section === sectionName);
    });

    currentSection = sectionName;
    console.log('[Dashboard] Switched to section:', sectionName);

    // Load data based on section
    if (sectionName === 'posts') {
      loadUserPosts();
    } else if (sectionName === 'projects') {
      loadUserProjects();
    } else if (sectionName === 'admin') {
      const activeAdminTab = document.querySelector('.admin-tabs__tab.active');
      const tabName = activeAdminTab?.dataset.adminTab || 'users';
      
      if (tabName === 'users') {
        loadAdminUsers();
      } else if (tabName === 'moderation') {
        loadModerationContent();
      } else if (tabName === 'notifications') {
        loadAdminNotifications?.();
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // USER INFO
  // ═══════════════════════════════════════════════════════════════════════════

  function updateUserInfo() {
    if (!currentUser) return;

    // Update sidebar
    const sidebarName = document.getElementById('sidebarUserName');
    const sidebarRole = document.getElementById('sidebarUserRole');
    const sidebarAvatar = document.getElementById('sidebarUserAvatar');

    if (sidebarName) {
      sidebarName.textContent = currentUser.mcNickname || currentUser.nickname || 'User';
    }

    if (sidebarRole) {
      const roleLabels = { user: 'Member', mod: 'Moderator', admin: 'Administrator' };
      sidebarRole.textContent = roleLabels[currentUser.role] || 'Member';
    }

    if (sidebarAvatar) {
      const avatarUrl = currentUser.avatar || currentUser.avatar_url;
      if (avatarUrl) {
        sidebarAvatar.innerHTML = `<img src="${avatarUrl}" alt="${currentUser.mcNickname || currentUser.nickname}">`;
        sidebarAvatar.classList.add('has-avatar');
      } else {
        const initials = (currentUser.mcNickname || currentUser.nickname || 'U').slice(0, 2).toUpperCase();
        sidebarAvatar.textContent = initials;
        sidebarAvatar.classList.remove('has-avatar');
      }
    }

    // Update settings page
    updateSettingsPage();
  }

  function updateSettingsPage() {
    if (!currentUser) return;

    // Update account info
    const settingMcNickname = document.getElementById('settingMcNickname');
    const settingEmail = document.getElementById('settingEmail');
    const settingRole = document.getElementById('settingRole');

    if (settingMcNickname) {
      settingMcNickname.textContent = currentUser.mcNickname || currentUser.nickname || 'Not set';
    }

    if (settingEmail) {
      settingEmail.textContent = currentUser.email || '-';
    }

    if (settingRole) {
      const roleLabels = { user: 'Member', mod: 'Moderator', admin: 'Administrator' };
      settingRole.textContent = roleLabels[currentUser.role] || 'Member';
    }
  }

  function oldUpdateUserInfo() {
    if (!currentUser) return;

    const nickname = currentUser.mcNickname || currentUser.nickname || 'User';
    const initials = nickname.slice(0, 2).toUpperCase();
    const role = currentUser.role || 'user';
    const roleLabels = { user: 'Member', mod: 'Moderator', admin: 'Administrator' };
    const avatarUrl = currentUser.avatar;

    // Sidebar user info - use avatar image if available
    if (elements.sidebarUserAvatar) {
      if (avatarUrl) {
        elements.sidebarUserAvatar.innerHTML = `<img src="${avatarUrl}" alt="${nickname}" class="sidebar-avatar-img">`;
        elements.sidebarUserAvatar.classList.add('has-avatar');
      } else {
        elements.sidebarUserAvatar.textContent = initials;
        elements.sidebarUserAvatar.classList.remove('has-avatar');
      }
    }
    if (elements.sidebarUserName) {
      elements.sidebarUserName.textContent = nickname;
    }
    if (elements.sidebarUserRole) {
      elements.sidebarUserRole.textContent = roleLabels[role] || 'Member';
    }

    // Show admin section for mod/admin
    if (elements.adminSection) {
      const isStaff = role === 'mod' || role === 'admin';
      elements.adminSection.style.display = isStaff ? 'block' : 'none';
    }

    // Settings info
    if (elements.settingMcNickname) {
      elements.settingMcNickname.textContent = currentUser.mcNickname || 'Not set';
    }
    if (elements.settingEmail) {
      elements.settingEmail.textContent = currentUser.email || '-';
    }
    if (elements.settingRole) {
      elements.settingRole.textContent = roleLabels[role] || 'User';
    }

    // Update permission toggles
    updatePermissionToggles();

    // Discord connection
    if (elements.discordConnectionStatus) {
      const hasDiscord = currentUser.connections?.discord?.connected ||
                        currentUser.connections?.discord === true;
      elements.discordConnectionStatus.textContent = hasDiscord ? 'Connected' : 'Not connected';
      elements.discordConnectionStatus.classList.toggle('setting-row__status--connected', hasDiscord);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SETTINGS
  // ═══════════════════════════════════════════════════════════════════════════

  function initSettings() {
    // Theme toggle
    if (elements.dashboardThemeToggle) {
      const isDark = document.body.classList.contains('dark-mode');
      elements.dashboardThemeToggle.querySelectorAll('.theme-toggle__btn').forEach(btn => {
        const theme = btn.dataset.theme;
        btn.classList.toggle('active', (theme === 'dark') === isDark);
      });
    }

    // Stars toggle
    if (elements.dashboardStarsToggle) {
      const settings = getSettings();
      elements.dashboardStarsToggle.checked = settings.showStars !== false;
    }
  }

  // In-memory settings (not persisted - follows system preferences)
  let inMemorySettings = null;
  
  function getSettings() {
    if (!inMemorySettings) {
      // Use system preferences as defaults
      const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
      const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      inMemorySettings = {
        darkMode: prefersDark,
        showStars: !prefersReducedMotion,
      };
    }
    return inMemorySettings;
  }

  function saveSettings(settings) {
    // Save to in-memory only (not persisted)
    inMemorySettings = { ...getSettings(), ...settings };
  }

  function handleThemeChange(theme) {
    const isDark = theme === 'dark';
    document.body.classList.toggle('dark-mode', isDark);

    const settings = getSettings();
    settings.darkMode = isDark;
    saveSettings(settings);

    // Update toggle buttons
    if (elements.dashboardThemeToggle) {
      elements.dashboardThemeToggle.querySelectorAll('.theme-toggle__btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === theme);
      });
    }
  }

  function handleStarsToggle(enabled) {
    const settings = getSettings();
    settings.showStars = enabled;
    saveSettings(settings);

    // Toggle star canvas visibility
    const starCanvas = document.getElementById('starCanvas');
    if (starCanvas) {
      starCanvas.style.display = enabled ? 'block' : 'none';
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ADMIN TABS
  // ═══════════════════════════════════════════════════════════════════════════

  function switchAdminTab(tabName) {
    // Update tabs
    document.querySelectorAll('.admin-tabs__tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.adminTab === tabName);
    });

    // Update panels
    document.querySelectorAll('.admin-panel').forEach(panel => {
      panel.classList.toggle('active', panel.dataset.adminPanel === tabName);
    });

    // Load data for specific tabs
    if (tabName === 'users') {
      loadAdminUsers();
    } else if (tabName === 'moderation') {
      loadModerationContent();
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ADMIN USERS TAB
  // ═══════════════════════════════════════════════════════════════════════════

  // State for admin user search
  let allAdminUsers = [];
  let adminUserSearchTimeout = null;

  async function loadAdminUsers() {
    const tbody = document.getElementById('adminUsersTable');
    if (!tbody) return;

    tbody.innerHTML = `
      <tr class="admin-table__loading">
        <td colspan="5">
          <div class="loading-spinner"></div>
          <span>Loading users...</span>
        </td>
      </tr>
    `;

    try {
      const users = await PrismBin.getUsers(true);
      allAdminUsers = users || [];
      renderAdminUsersTable(allAdminUsers);
    } catch (error) {
      console.error('[Dashboard] Failed to load users:', error);
      allAdminUsers = [];
      tbody.innerHTML = `
        <tr class="admin-table__error">
          <td colspan="5">Failed to load users. <button class="btn btn--sm btn--outline" onclick="loadAdminUsers()">Retry</button></td>
        </tr>
      `;
    }
  }

  function filterAdminUsers(query) {
    if (!query || query.length === 0) {
      renderAdminUsersTable(allAdminUsers);
      return;
    }
    
    const lowerQuery = query.toLowerCase();
    const filtered = allAdminUsers.filter(user => {
      const nickname = (user.mcNickname || user.nickname || '').toLowerCase();
      const email = (user.email || '').toLowerCase();
      const role = (user.role || '').toLowerCase();
      return nickname.includes(lowerQuery) || email.includes(lowerQuery) || role.includes(lowerQuery);
    });
    
    renderAdminUsersTable(filtered);
  }

  function renderAdminUsersTable(users) {
    const tbody = document.getElementById('adminUsersTable');
    if (!tbody) return;

    if (!users || users.length === 0) {
      tbody.innerHTML = `
        <tr class="admin-table__empty">
          <td colspan="5">No users found</td>
        </tr>
      `;
      return;
    }

    const roleLabels = { user: 'Member', mod: 'Moderator', admin: 'Administrator' };
    const roleClasses = { user: 'badge--secondary', mod: 'badge--warning', admin: 'badge--primary' };
    const isAdmin = currentUser?.role === 'admin';

    tbody.innerHTML = users.map(user => {
      const nickname = user.mcNickname || user.nickname || 'Unknown';
      const email = user.email || '-';
      const role = user.role || 'user';
      const joined = user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-';
      const avatarUrl = user.avatar;
      const initials = nickname.slice(0, 2).toUpperCase();
      const isSelf = user.id === currentUser?.id;
      const overrides = user.permissionOverrides || {};

      return `
        <tr data-user-id="${user.id}">
          <td>
            <div class="admin-user-cell">
              <div class="admin-user-avatar ${avatarUrl ? 'has-avatar' : ''}">
                ${avatarUrl ? `<img src="${avatarUrl}" alt="${nickname}">` : initials}
              </div>
              <span class="admin-user-name">${escapeHtml(nickname)}</span>
            </div>
          </td>
          <td>${escapeHtml(email)}</td>
          <td><span class="badge ${roleClasses[role]}">${roleLabels[role]}</span></td>
          <td>${joined}</td>
          <td>
            <div class="admin-actions">
              ${isAdmin && !isSelf ? `
                <button class="btn btn--sm btn--outline" data-action="open-user-overlay" data-user-id="${user.id}">
                  Actions
                </button>
              ` : '<span class="text-muted">-</span>'}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Add event listeners for role changes
    tbody.querySelectorAll('.admin-role-select').forEach(select => {
      select.addEventListener('change', async (e) => {
        e.stopPropagation();
        const userId = e.target.dataset.userId;
        const newRole = e.target.value;
        const oldRole = e.target.dataset.currentRole;

        if (newRole === oldRole) return;

        try {
          await PrismBin.updateUser(userId, { role: newRole });
          e.target.dataset.currentRole = newRole;
          showToast('Success', 'User role updated');
          loadAdminUsers();
        } catch (error) {
          console.error('[Dashboard] Role update failed:', error);
          e.target.value = oldRole;
          showToast('Error', 'Failed to update user role');
        }
      });
    });

  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ADMIN PROJECTS TAB
  // ═══════════════════════════════════════════════════════════════════════════

  async function loadAdminProjects() {
    const tbody = document.getElementById('adminProjectsTable');
    if (!tbody) return;

    tbody.innerHTML = `
      <tr class="admin-table__loading">
        <td colspan="5">
          <div class="loading-spinner"></div>
          <span>Loading projects...</span>
        </td>
      </tr>
    `;

    try {
      const [projects, users] = await Promise.all([
        PrismBin.getProjects(true),
        PrismBin.getUsers()
      ]);
      renderAdminProjectsTable(projects, users);
    } catch (error) {
      console.error('[Dashboard] Failed to load projects:', error);
      tbody.innerHTML = `
        <tr class="admin-table__error">
          <td colspan="5">Failed to load projects. <button class="btn btn--sm btn--outline" onclick="loadAdminProjects()">Retry</button></td>
        </tr>
      `;
    }
  }

  function renderAdminProjectsTable(projects, users) {
    const tbody = document.getElementById('adminProjectsTable');
    if (!tbody) return;

    if (!projects || projects.length === 0) {
      tbody.innerHTML = `
        <tr class="admin-table__empty">
          <td colspan="5">No projects found</td>
        </tr>
      `;
      return;
    }

    const statusClasses = { active: 'badge--success', paused: 'badge--warning', completed: 'badge--secondary' };

    tbody.innerHTML = projects.map(project => {
      const owner = users.find(u => u.id === project.ownerId);
      const ownerName = owner?.mcNickname || owner?.nickname || 'Unknown';
      const category = CATEGORY_DISPLAY_LABELS[project.category] || project.category || '-';
      const status = project.status || 'active';

      return `
        <tr data-project-id="${project.id}">
          <td><span class="admin-project-name">${escapeHtml(project.name || 'Unnamed')}</span></td>
          <td>${escapeHtml(ownerName)}</td>
          <td>${escapeHtml(category)}</td>
          <td><span class="badge ${statusClasses[status]}">${status}</span></td>
          <td>
            <div class="admin-actions">
              <button class="btn btn--sm btn--outline btn--danger" data-action="delete-project" data-project-id="${project.id}">
                Delete
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // USER POSTS
  // ═══════════════════════════════════════════════════════════════════════════

  async function loadUserPosts() {
    const postsContainer = document.getElementById('postsList');
    if (!postsContainer) return;

    const grid = postsContainer.querySelector('.dashboard-grid');
    if (!grid) return;

    // Keep create tile, remove posts
    grid.querySelectorAll('.post-card').forEach(el => el.remove());

    try {
      const posts = await PrismBin.getPosts(true);
      const userPosts = posts.filter(p => p.author?.id === currentUser?.id || p.authorId === currentUser?.id);
      
      if (userPosts.length === 0) {
        // Show empty state after create tile
        const emptyEl = document.createElement('div');
        emptyEl.className = 'post-card post-card--empty';
        emptyEl.innerHTML = `
          <p>You haven't created any posts yet.</p>
        `;
        grid.appendChild(emptyEl);
        return;
      }

      userPosts.forEach(post => {
        const card = document.createElement('div');
        card.className = 'post-card';
        card.dataset.postId = post.id;
        card.innerHTML = `
          <div class="post-card__actions">
            <button class="btn btn--sm btn--ghost" data-action="edit-post" data-post-id="${post.id}" title="Edit">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button class="btn btn--sm btn--ghost btn--danger" data-action="delete-post" data-post-id="${post.id}" title="Delete">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          </div>
          <h3 class="post-card__title">${escapeHtml(post.title)}</h3>
          <p class="post-card__excerpt">${escapeHtml((post.content || '').slice(0, 100))}${post.content?.length > 100 ? '...' : ''}</p>
          <div class="post-card__meta">
            <span class="post-card__category badge badge--secondary">${CATEGORY_DISPLAY_LABELS[post.category] || post.category}</span>
            <span class="post-card__date">${new Date(post.createdAt).toLocaleDateString()}</span>
          </div>
        `;
        grid.appendChild(card);
      });
    } catch (error) {
      console.error('[Dashboard] Failed to load user posts:', error);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // USER PROJECTS
  // ═══════════════════════════════════════════════════════════════════════════

  async function loadUserProjects() {
    const projectsContainer = document.getElementById('projectsList');
    if (!projectsContainer) return;

    const grid = projectsContainer.querySelector('.dashboard-grid');
    if (!grid) return;

    // Keep create tile, remove projects
    grid.querySelectorAll('.project-card').forEach(el => el.remove());

    try {
      const projects = await PrismBin.getProjects(true);
      const userProjects = projects.filter(p => p.ownerId === currentUser?.id || p.owner?.id === currentUser?.id);
      
      if (userProjects.length === 0) {
        // Show empty state after create tile
        const emptyEl = document.createElement('div');
        emptyEl.className = 'project-card project-card--empty';
        emptyEl.innerHTML = `
          <p>You haven't created any projects yet.</p>
        `;
        grid.appendChild(emptyEl);
        return;
      }

      const statusClasses = { active: 'badge--success', paused: 'badge--warning', completed: 'badge--secondary', published: 'badge--success' };

      userProjects.forEach(project => {
        const card = document.createElement('div');
        card.className = 'project-card';
        card.dataset.projectId = project.id;
        card.innerHTML = `
          <div class="project-card__actions">
            <button class="btn btn--sm btn--ghost" data-action="edit-project" data-project-id="${project.id}" title="Edit">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button class="btn btn--sm btn--ghost btn--danger" data-action="delete-project" data-project-id="${project.id}" title="Delete">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          </div>
          ${project.image ? `<img src="${project.image}" alt="${escapeHtml(project.name)}" class="project-card__image">` : ''}
          <h3 class="project-card__title">${escapeHtml(project.name)}</h3>
          <p class="project-card__desc">${escapeHtml((project.description || '').slice(0, 80))}${project.description?.length > 80 ? '...' : ''}</p>
          <div class="project-card__meta">
            <span class="badge badge--secondary">${CATEGORY_DISPLAY_LABELS[project.category] || project.category}</span>
            <span class="badge ${statusClasses[project.status] || 'badge--secondary'}">${project.status || 'active'}</span>
          </div>
        `;
        grid.appendChild(card);
      });
    } catch (error) {
      console.error('[Dashboard] Failed to load user projects:', error);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MODAL MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
  }

  function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('open');
      document.body.style.overflow = '';
    }
  }

  /**
   * Populate the author selector dropdown with companies where user can post
   */
  async function populateAuthorSelector(selectId) {
    const select = document.getElementById(selectId);
    if (!select || !currentUser) return;

    // Reset to personal only
    select.innerHTML = '<option value="personal">Myself (Personal)</option>';

    try {
      // Get companies where user can post
      const companies = await PrismBin.getCompaniesForPosting(currentUser.id);
      
      if (companies && companies.length > 0) {
        companies.forEach(company => {
          const option = document.createElement('option');
          option.value = company.id;
          option.textContent = `${company.name} (Company)`;
          select.appendChild(option);
        });
      }
    } catch (error) {
      console.warn('[Dashboard] Failed to load companies for posting:', error);
    }
  }

  function resetPostForm() {
    if (elements.createPostForm) {
      elements.createPostForm.reset();
    }
    // Reset editing state
    editingPostId = null;

    // Reset modal title and button text
    const modal = document.getElementById('createPostModal');
    if (modal) {
      const modalTitle = modal.querySelector('.modal__title');
      if (modalTitle) modalTitle.textContent = 'Create Post';
      const submitText = document.getElementById('postSubmitText');
      if (submitText) submitText.textContent = 'Publish Post';
    }

    // Reset wizard to step 1
    postWizardStep = 1;
    updatePostWizard();

    // Populate company selector
    populateAuthorSelector('postAuthorSelect');
  }

  function resetProjectForm() {
    if (elements.createProjectForm) {
      elements.createProjectForm.reset();
    }
    projectImageData = null;
    projectCoowners = [];
    projectMembers = [];
    
    // Reset editing state
    editingProjectId = null;

    if (elements.projectImagePreview) {
      elements.projectImagePreview.style.display = 'none';
      elements.projectImagePreview.src = '';
    }
    if (elements.projectImagePlaceholder) {
      elements.projectImagePlaceholder.style.display = 'flex';
    }
    if (elements.projectImageUpload) {
      elements.projectImageUpload.classList.remove('image-upload--has-image');
    }

    // Reset modal title and button text
    const modal = document.getElementById('createProjectModal');
    if (modal) {
      const modalTitle = modal.querySelector('.modal__title');
      if (modalTitle) modalTitle.textContent = 'Create Project';
      const submitText = document.getElementById('projectSubmitText');
      if (submitText) submitText.textContent = 'Create Project';
    }

    // Reset wizard to step 1
    projectWizardStep = 1;
    updateProjectWizard();

    // Populate company selector
    populateAuthorSelector('projectAuthorSelect');

    renderTeamList('coowners');
    renderTeamList('members');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // POST CREATION WIZARD
  // ═══════════════════════════════════════════════════════════════════════════

  let postWizardStep = 1;
  const POST_WIZARD_TOTAL_STEPS = 3;

  function updatePostWizard() {
    const wizard = document.getElementById('postWizard');
    if (!wizard) return;

    // Update progress steps
    wizard.querySelectorAll('.wizard-progress__step').forEach(step => {
      const stepNum = parseInt(step.dataset.step, 10);
      step.classList.remove('active', 'completed');
      if (stepNum === postWizardStep) {
        step.classList.add('active');
      } else if (stepNum < postWizardStep) {
        step.classList.add('completed');
      }
    });

    // Update step panels
    wizard.querySelectorAll('.wizard-step').forEach(panel => {
      const stepNum = parseInt(panel.dataset.wizardStep, 10);
      panel.classList.toggle('active', stepNum === postWizardStep);
    });

    // Update button states
    const step1NextBtn = document.getElementById('postStep1Next');
    if (step1NextBtn) {
      const categorySelected = wizard.querySelector('input[name="postCategory"]:checked');
      step1NextBtn.disabled = !categorySelected;
    }

    // Update preview if on step 3
    if (postWizardStep === 3) {
      updatePostPreview();
    }
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
        console.warn('[Dashboard] Markdown parsing failed:', e);
        return escapeHtml(content);
      }
    }

    // Fallback to plain text if marked is not available
    return escapeHtml(content);
  }

  function updatePostPreview() {
    const category = document.querySelector('#postWizard input[name="postCategory"]:checked')?.value || '';
    const title = document.getElementById('postTitle')?.value || '';
    const content = document.getElementById('postContent')?.value || '';

    const categoryLabels = {
      news: 'News',
      update: 'Update',
      announcement: 'Announcement',
      guide: 'Guide',
      showcase: 'Showcase',
    };

    document.getElementById('postPreviewCategory').textContent = categoryLabels[category] || category;
    document.getElementById('postPreviewTitle').textContent = title || 'Untitled Post';

    // Render markdown for content preview
    const previewContent = document.getElementById('postPreviewContent');
    if (previewContent) {
      previewContent.innerHTML = renderMarkdown(content) || '<p class="preview-placeholder">No content</p>';
      previewContent.classList.add('markdown-content');
    }

    // User info
    if (currentUser) {
      const userName = currentUser.nickname || currentUser.name || 'You';
      const userAvatar = currentUser.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=random`;
      document.getElementById('postPreviewAvatar').src = userAvatar;
      document.getElementById('postPreviewAuthor').textContent = userName;
    }

    // Check if moderation is needed (for non-mods/admins)
    const needsMod = currentUser && currentUser.role !== 'mod' && currentUser.role !== 'admin';
    const moderationNotice = document.getElementById('postModerationNotice');
    const submitText = document.getElementById('postSubmitText');

    if (moderationNotice) {
      moderationNotice.style.display = needsMod ? 'flex' : 'none';
    }
    if (submitText) {
      submitText.textContent = needsMod ? 'Submit for Review' : 'Publish Post';
    }
  }

  function goToPostStep(step) {
    if (step < 1 || step > POST_WIZARD_TOTAL_STEPS) return;

    // Validate current step before advancing
    if (step > postWizardStep) {
      if (!validatePostStep(postWizardStep)) return;
    }

    postWizardStep = step;
    updatePostWizard();
  }

  function validatePostStep(step) {
    const wizard = document.getElementById('postWizard');
    if (!wizard) return false;

    switch (step) {
      case 1:
        return !!wizard.querySelector('input[name="postCategory"]:checked');
      case 2:
        const title = document.getElementById('postTitle')?.value?.trim();
        const content = document.getElementById('postContent')?.value?.trim();
        if (!title) {
          showToast('Error', 'Please enter a title');
          return false;
        }
        if (!content || content.length < 20) {
          showToast('Error', 'Content must be at least 20 characters');
          return false;
        }
        return true;
      default:
        return true;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PROJECT CREATION WIZARD
  // ═══════════════════════════════════════════════════════════════════════════

  let projectWizardStep = 1;
  const PROJECT_WIZARD_TOTAL_STEPS = 4;

  function updateProjectWizard() {
    const wizard = document.getElementById('projectWizard');
    if (!wizard) return;

    // Update progress steps
    wizard.querySelectorAll('.wizard-progress__step').forEach(step => {
      const stepNum = parseInt(step.dataset.step, 10);
      step.classList.remove('active', 'completed');
      if (stepNum === projectWizardStep) {
        step.classList.add('active');
      } else if (stepNum < projectWizardStep) {
        step.classList.add('completed');
      }
    });

    // Update step panels
    wizard.querySelectorAll('.wizard-step').forEach(panel => {
      const stepNum = parseInt(panel.dataset.wizardStep, 10);
      panel.classList.toggle('active', stepNum === projectWizardStep);
    });

    // Update button states
    const step1NextBtn = document.getElementById('projectStep1Next');
    if (step1NextBtn) {
      const categorySelected = wizard.querySelector('input[name="projectCategory"]:checked');
      step1NextBtn.disabled = !categorySelected;
    }

    // Update preview if on step 4
    if (projectWizardStep === 4) {
      updateProjectPreview();
    }
  }

  function updateProjectPreview() {
    const category = document.querySelector('#projectWizard input[name="projectCategory"]:checked')?.value || '';
    const status = document.querySelector('#projectWizard input[name="projectStatus"]:checked')?.value || 'active';
    const name = document.getElementById('projectName')?.value || '';
    const description = document.getElementById('projectDescription')?.value || '';

    const categoryLabels = {
      building: 'Building',
      station: 'Station',
      line_section: 'Line Section',
      line: 'Line',
    };

    const statusLabels = {
      planning: 'Planning',
      active: 'Active',
      completed: 'Completed',
      paused: 'Paused',
    };

    document.getElementById('projectPreviewCategory').textContent = categoryLabels[category] || category;
    document.getElementById('projectPreviewStatus').textContent = statusLabels[status] || status;
    document.getElementById('projectPreviewTitle').textContent = name || 'Untitled Project';
    document.getElementById('projectPreviewDesc').textContent = description || 'No description';

    // Image preview
    const previewImage = document.getElementById('projectPreviewImage');
    if (previewImage && projectImageData) {
      previewImage.innerHTML = `<img src="${projectImageData}" alt="Preview">`;
    }

    // Owner info
    if (currentUser) {
      const userName = currentUser.nickname || currentUser.name || 'You';
      document.getElementById('projectPreviewOwner').textContent = userName;
    }

    // Team preview
    const teamCount = projectCoowners.length + projectMembers.length;
    const teamEl = document.getElementById('projectPreviewTeam');
    if (teamEl) {
      if (teamCount > 0) {
        teamEl.innerHTML = `
          <span class="project-preview__owner">${currentUser?.nickname || 'You'}</span>
          <span>+ ${teamCount} team member${teamCount > 1 ? 's' : ''}</span>
        `;
      }
    }

    // Check if moderation is needed
    const needsMod = currentUser && currentUser.role !== 'mod' && currentUser.role !== 'admin';
    const moderationNotice = document.getElementById('projectModerationNotice');
    const submitText = document.getElementById('projectSubmitText');

    if (moderationNotice) {
      moderationNotice.style.display = needsMod ? 'flex' : 'none';
    }
    if (submitText) {
      submitText.textContent = needsMod ? 'Submit for Review' : 'Create Project';
    }
  }

  function goToProjectStep(step) {
    if (step < 1 || step > PROJECT_WIZARD_TOTAL_STEPS) return;

    // Validate current step before advancing
    if (step > projectWizardStep) {
      if (!validateProjectStep(projectWizardStep)) return;
    }

    projectWizardStep = step;
    updateProjectWizard();
  }

  function validateProjectStep(step) {
    const wizard = document.getElementById('projectWizard');
    if (!wizard) return false;

    switch (step) {
      case 1:
        return !!wizard.querySelector('input[name="projectCategory"]:checked');
      case 2:
        const name = document.getElementById('projectName')?.value?.trim();
        const desc = document.getElementById('projectDescription')?.value?.trim();
        if (!name) {
          showToast('Error', 'Please enter a project name');
          return false;
        }
        if (!desc || desc.length < 20) {
          showToast('Error', 'Description must be at least 20 characters');
          return false;
        }
        return true;
      case 3:
        // Team step is optional
        return true;
      default:
        return true;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPANY CREATION WIZARD
  // ═══════════════════════════════════════════════════════════════════════════

  let companyWizardStep = 1;
  const COMPANY_WIZARD_TOTAL_STEPS = 3;

  function updateCompanyWizard() {
    const wizard = document.getElementById('companyWizard');
    if (!wizard) return;

    // Update progress steps
    wizard.querySelectorAll('.wizard-progress__step').forEach(step => {
      const stepNum = parseInt(step.dataset.step, 10);
      step.classList.remove('active', 'completed');
      if (stepNum === companyWizardStep) {
        step.classList.add('active');
      } else if (stepNum < companyWizardStep) {
        step.classList.add('completed');
      }
    });

    // Update step panels
    wizard.querySelectorAll('.wizard-step').forEach(panel => {
      const stepNum = parseInt(panel.dataset.wizardStep, 10);
      panel.classList.toggle('active', stepNum === companyWizardStep);
    });

    // Update button states
    const step1NextBtn = document.getElementById('companyStep1Next');
    if (step1NextBtn) {
      const categorySelected = wizard.querySelectorAll('input[name="companyCategories"]:checked');
      step1NextBtn.disabled = categorySelected.length === 0;
    }

    // Update preview if on step 3
    if (companyWizardStep === 3) {
      updateCompanyPreview();
    }
  }

  function updateCompanyPreview() {
    const categories = Array.from(document.querySelectorAll('#companyWizard input[name="companyCategories"]:checked'))
      .map(cb => cb.value);
    const name = document.getElementById('companyName')?.value || '';
    const description = document.getElementById('companyDescription')?.value || '';

    const categoryLabels = {
      metro: 'Metro / Transit',
      rail: 'Railway',
      city: 'City Building',
      infrastructure: 'Infrastructure',
      creative: 'Creative / Other',
    };

    const categoryNames = categories.map(c => categoryLabels[c] || c).join(', ');

    // New ID naming (matching project wizard style)
    const previewName = document.getElementById('companyPreviewName');
    const previewCategories = document.getElementById('companyPreviewCategories');
    const previewDesc = document.getElementById('companyPreviewDesc');
    const previewOwner = document.getElementById('companyPreviewOwner');
    const previewLogo = document.getElementById('companyPreviewLogo');

    if (previewName) previewName.textContent = name || 'Untitled Company';
    if (previewCategories) previewCategories.textContent = categoryNames || 'No categories';
    if (previewDesc) previewDesc.textContent = description || 'No description provided';
    if (previewOwner && currentUser) {
      previewOwner.textContent = `Owner: ${currentUser.nickname || currentUser.name || 'You'}`;
    }
    
    // Update logo preview if we have one
    if (previewLogo && companyLogoData) {
      previewLogo.innerHTML = `<img src="${companyLogoData}" alt="Company Logo" style="width: 100%; height: 100%; object-fit: cover;">`;
    } else if (previewLogo) {
      previewLogo.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
          <path d="M3 21h18"/>
          <path d="M5 21V7l8-4v18"/>
          <path d="M19 21V11l-6-4"/>
        </svg>
      `;
    }
  }

  function goToCompanyStep(step) {
    if (step < 1 || step > COMPANY_WIZARD_TOTAL_STEPS) return;

    // Validate current step before advancing
    if (step > companyWizardStep) {
      if (!validateCompanyStep(companyWizardStep)) return;
    }

    companyWizardStep = step;
    updateCompanyWizard();
  }

  function validateCompanyStep(step) {
    const wizard = document.getElementById('companyWizard');
    if (!wizard) return false;

    switch (step) {
      case 1:
        const selectedCategories = wizard.querySelectorAll('input[name="companyCategories"]:checked');
        if (selectedCategories.length === 0) {
          showToast('Error', 'Please select at least one category');
          return false;
        }
        return true;
      case 2:
        const name = document.getElementById('companyName')?.value?.trim();
        if (!name) {
          showToast('Error', 'Please enter a company name');
          return false;
        }
        return true;
      default:
        return true;
    }
  }

  function resetCompanyWizard() {
    companyWizardStep = 1;
    editingCompanyId = null;

    // Reset form
    const form = document.getElementById('createCompanyForm');
    if (form) form.reset();

    // Reset character counters
    const nameCount = document.getElementById('companyNameCount');
    const descCount = document.getElementById('companyDescCount');
    if (nameCount) nameCount.textContent = '0';
    if (descCount) descCount.textContent = '0';

    // Reset company logo
    removeCompanyLogo();
    companyLogoData = null;

    // Reset category checkboxes
    document.querySelectorAll('input[name="companyCategories"]').forEach(cb => {
      cb.checked = false;
      cb.disabled = false;
    });

    // Reset modal title and button text
    const modal = document.getElementById('createCompanyModal');
    if (modal) {
      const modalTitle = modal.querySelector('.modal__title');
      if (modalTitle) modalTitle.textContent = 'Create Company';
      const submitText = document.getElementById('companySubmitText');
      if (submitText) submitText.textContent = 'Create Company';
    }

    // Update wizard
    updateCompanyWizard();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // IMAGE UPLOAD
  // ═══════════════════════════════════════════════════════════════════════════

  function handleImageUploadClick() {
    elements.projectImageInput?.click();
  }

  function handleImageChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      showToast('Error', 'Image must be less than 2MB');
      return;
    }

    if (!file.type.startsWith('image/')) {
      showToast('Error', 'Please select an image file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      projectImageData = event.target.result;

      if (elements.projectImagePreview) {
        elements.projectImagePreview.src = projectImageData;
        elements.projectImagePreview.style.display = 'block';
      }
      if (elements.projectImagePlaceholder) {
        elements.projectImagePlaceholder.style.display = 'none';
      }
      if (elements.projectImageUpload) {
        elements.projectImageUpload.classList.add('image-upload--has-image');
      }
      // Show remove button
      const removeBtn = document.getElementById('projectImageRemove');
      if (removeBtn) {
        removeBtn.style.display = 'flex';
      }
    };
    reader.readAsDataURL(file);
  }

  // Company logo upload handling
  function handleCompanyLogoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      showToast('Error', 'Image must be less than 2MB');
      return;
    }

    if (!file.type.startsWith('image/')) {
      showToast('Error', 'Please select an image file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      companyLogoData = event.target.result;

      const preview = document.getElementById('companyLogoPreview');
      const placeholder = document.getElementById('companyLogoPlaceholder');
      const upload = document.getElementById('companyLogoUpload');
      const removeBtn = document.getElementById('companyLogoRemove');

      if (preview) {
        preview.src = companyLogoData;
        preview.style.display = 'block';
      }
      if (placeholder) {
        placeholder.style.display = 'none';
      }
      if (upload) {
        upload.classList.add('image-upload--has-image');
      }
      if (removeBtn) {
        removeBtn.style.display = 'flex';
      }
    };
    reader.readAsDataURL(file);
  }

  function removeCompanyLogo() {
    companyLogoData = null;
    
    const input = document.getElementById('companyLogoInput');
    const preview = document.getElementById('companyLogoPreview');
    const placeholder = document.getElementById('companyLogoPlaceholder');
    const upload = document.getElementById('companyLogoUpload');
    const removeBtn = document.getElementById('companyLogoRemove');

    if (input) input.value = '';
    if (preview) {
      preview.src = '';
      preview.style.display = 'none';
    }
    if (placeholder) {
      placeholder.style.display = 'flex';
    }
    if (upload) {
      upload.classList.remove('image-upload--has-image');
    }
    if (removeBtn) {
      removeBtn.style.display = 'none';
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TEAM MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  function renderTeamList(type) {
    const list = type === 'coowners' ? projectCoowners : projectMembers;
    const listEl = type === 'coowners' ? elements.projectCoownersList : elements.projectMembersList;
    const emptyEl = type === 'coowners' ? elements.projectCoownersEmpty : elements.projectMembersEmpty;

    if (!listEl) return;

    listEl.querySelectorAll('.team-chip').forEach(el => el.remove());

    if (list.length === 0) {
      if (emptyEl) emptyEl.style.display = 'flex';
    } else {
      if (emptyEl) emptyEl.style.display = 'none';

      list.forEach((name, index) => {
        const chip = document.createElement('div');
        chip.className = 'team-chip';
        chip.innerHTML = `
          <span>${escapeHtml(name)}</span>
          <button type="button" class="team-chip__remove" data-type="${type}" data-index="${index}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        `;
        listEl.appendChild(chip);
      });
    }
  }

  function addTeamMember(type) {
    const input = type === 'coowners' ? elements.projectCoownerInput : elements.projectMemberInput;
    const list = type === 'coowners' ? projectCoowners : projectMembers;

    if (!input) return;

    const name = input.value.trim();
    if (!name) {
      showToast('Error', 'Please enter a username');
      return;
    }

    if (list.includes(name)) {
      showToast('Error', 'User already added');
      return;
    }

    list.push(name);
    input.value = '';
    renderTeamList(type);
  }

  function removeTeamMember(type, index) {
    const list = type === 'coowners' ? projectCoowners : projectMembers;
    list.splice(index, 1);
    renderTeamList(type);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // POST SUBMISSION
  // ═══════════════════════════════════════════════════════════════════════════

  async function handlePostSubmit(e) {
    e.preventDefault();

    if (!currentUser) {
      showToast('Error', 'You must be logged in to create a post');
      return;
    }

    // Get values from wizard
    const title = document.getElementById('postTitle')?.value?.trim();
    const content = document.getElementById('postContent')?.value?.trim();
    const category = document.querySelector('#postWizard input[name="postCategory"]:checked')?.value;
    
    // Get author selection (personal or company)
    const authorSelect = document.getElementById('postAuthorSelect');
    const authorValue = authorSelect?.value || 'personal';
    const isPostingAsCompany = authorValue !== 'personal';
    const companyId = isPostingAsCompany ? authorValue : null;

    if (!title || !content || !category) {
      showToast('Error', 'Please fill in all required fields');
      return;
    }

    const submitBtn = document.getElementById('submitPostBtn');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner-small"></span> ' + (editingPostId ? 'Saving...' : 'Publishing...');
    }

    try {
      // If editing existing post
      if (editingPostId) {
        await PrismBin.updatePost(editingPostId, {
          title,
          content,
          category,
          updatedAt: new Date().toISOString(),
        });
        showToast('Success', 'Post updated successfully!');
        editingPostId = null;
      } else {
        // Check if moderation is needed
        const needsMod = currentUser.role !== 'mod' && currentUser.role !== 'admin';

        if (needsMod) {
          // Submit for moderation
          await PrismBin.createModerationRequest({
            type: PrismBin.MODERATION_TYPES.CREATE_POST,
            userId: currentUser.id,
            data: {
              title,
              content,
              category,
              companyId: companyId,
            },
          });

          showToast('Success', 'Post submitted for review!');
        } else {
          // Direct publish for mods/admins
          const post = {
            title,
            content,
            category,
            author: {
              id: currentUser.id,
              nickname: currentUser.mcNickname || currentUser.nickname || 'Anonymous',
            },
            authorId: currentUser.id,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          // Add company if posting as company
          if (companyId) {
            post.companyId = companyId;
            post.company_id = companyId;
          }

          await PrismBin.createPost(post);
          showToast('Success', 'Post published successfully!');
        }
      }

      closeModal('createPostModal');
      resetPostForm();
      await loadUserPosts();

    } catch (error) {
      console.error('[Dashboard] Post creation error:', error);
      showToast('Error', error.message || 'Failed to save post');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
          <span id="postSubmitText">Publish Post</span>
        `;
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PROJECT SUBMISSION
  // ═══════════════════════════════════════════════════════════════════════════

  async function handleProjectSubmit(e) {
    e.preventDefault();

    if (!currentUser) {
      showToast('Error', 'You must be logged in to create a project');
      return;
    }

    // Get values from wizard
    const name = document.getElementById('projectName')?.value?.trim();
    const description = document.getElementById('projectDescription')?.value?.trim();
    const category = document.querySelector('#projectWizard input[name="projectCategory"]:checked')?.value;
    const status = document.querySelector('#projectWizard input[name="projectStatus"]:checked')?.value || 'active';
    
    // Get author selection (personal or company)
    const authorSelect = document.getElementById('projectAuthorSelect');
    const authorValue = authorSelect?.value || 'personal';
    const isCreatingAsCompany = authorValue !== 'personal';
    const companyId = isCreatingAsCompany ? authorValue : null;

    if (!name || !description || !category) {
      showToast('Error', 'Please fill in all required fields');
      return;
    }

    const submitBtn = document.getElementById('submitProjectBtn');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner-small"></span> ' + (editingProjectId ? 'Saving...' : 'Creating...');
    }

    try {
      // Upload image if present and is a new data URL
      let imageUrl = null;
      if (projectImageData) {
        // Only upload if it's a data URL (new image), not an existing URL
        if (projectImageData.startsWith('data:')) {
          try {
            const uploaded = await PrismBin.uploadImage(projectImageData, 'images', 'projects');
            imageUrl = uploaded.url;
          } catch (imgErr) {
            console.warn('[Dashboard] Image upload failed, continuing without image:', imgErr);
          }
        } else {
          // Keep existing URL
          imageUrl = projectImageData;
        }
      }

      // If editing existing project
      if (editingProjectId) {
        await PrismBin.updateProject(editingProjectId, {
          name,
          description,
          category,
          status: status === 'active' ? 'published' : status,
          image: imageUrl,
          updatedAt: new Date().toISOString(),
        });
        showToast('Success', 'Project updated successfully!');
        editingProjectId = null;
      } else {
        // Check if moderation is needed
        const needsMod = currentUser.role !== 'mod' && currentUser.role !== 'admin';

        if (needsMod) {
          // Submit for moderation
          await PrismBin.createModerationRequest({
            type: PrismBin.MODERATION_TYPES.CREATE_PROJECT,
            userId: currentUser.id,
            data: {
              name,
              description,
              category,
              status,
              image: imageUrl,
              companyId: companyId,
              coowners: projectCoowners,
              members: projectMembers,
            },
          });

          showToast('Success', 'Project submitted for review!');
        } else {
          // Direct create for mods/admins
          const project = {
            name,
            description,
            category,
            status: status === 'active' ? 'published' : status,
            image: imageUrl,
            ownerId: currentUser.id,
          };

          // Add company if creating as company
          if (companyId) {
            project.companyId = companyId;
            project.company_id = companyId;
          }

          const created = await PrismBin.createProject(project);
          console.log('[Dashboard] Project created:', created);
          showToast('Success', 'Project created successfully!');
        }
      }

      closeModal('createProjectModal');
      resetProjectForm();
      
      // Reload user projects
      await loadUserProjects();

    } catch (error) {
      console.error('[Dashboard] Project creation error:', error);
      showToast('Error', error.message || 'Failed to save project');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          <span id="projectSubmitText">Create Project</span>
        `;
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EDIT / DELETE POST HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════

  let editingPostId = null;

  async function openEditPostModal(postId, isAdmin = false) {
    try {
      const post = await PrismBin.getPostById(postId);
      if (!post) {
        showToast('Error', 'Post not found');
        return;
      }

      // Check permission
      const isOwner = post.author?.id === currentUser?.id || post.authorId === currentUser?.id;
      const canEdit = isOwner || isAdmin || currentUser?.role === 'admin' || currentUser?.role === 'mod';
      if (!canEdit) {
        showToast('Error', 'You do not have permission to edit this post');
        return;
      }

      editingPostId = postId;

      // Populate the form
      const modal = document.getElementById('createPostModal');
      if (!modal) return;

      document.getElementById('postTitle').value = post.title || '';
      document.getElementById('postContent').value = post.content || '';

      // Set category radio
      if (post.category) {
        const radio = modal.querySelector(`input[name="postCategory"][value="${post.category}"]`);
        if (radio) radio.checked = true;
      }

      // Update modal title and button text
      const modalTitle = modal.querySelector('.modal__title');
      if (modalTitle) modalTitle.textContent = 'Edit Post';

      const submitText = document.getElementById('postSubmitText');
      if (submitText) submitText.textContent = 'Save Changes';

      postWizardStep = 1;
      updatePostWizard();
      openModal('createPostModal');
    } catch (error) {
      console.error('[Dashboard] Failed to load post for editing:', error);
      showToast('Error', 'Failed to load post');
    }
  }

  async function handleDeletePost(postId, isAdmin = false) {
    try {
      const post = await PrismBin.getPostById(postId);
      if (!post) {
        showToast('Error', 'Post not found');
        return;
      }

      // Check permission
      const isOwner = post.author?.id === currentUser?.id || post.authorId === currentUser?.id;
      const canDelete = isOwner || isAdmin || currentUser?.role === 'admin' || currentUser?.role === 'mod';
      if (!canDelete) {
        showToast('Error', 'You do not have permission to delete this post');
        return;
      }

      if (!confirm(`Are you sure you want to delete "${post.title}"? This action cannot be undone.`)) {
        return;
      }

      await PrismBin.deletePost(postId);
      showToast('Success', 'Post deleted successfully');
      await loadUserPosts();

      // Reload admin posts if in admin section
      if (currentSection === 'admin') {
        loadAdminPosts?.();
      }
    } catch (error) {
      console.error('[Dashboard] Failed to delete post:', error);
      showToast('Error', error.message || 'Failed to delete post');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EDIT / DELETE PROJECT HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════

  let editingProjectId = null;

  async function openEditProjectModal(projectId, isAdmin = false) {
    try {
      const project = await PrismBin.getProjectById(projectId);
      if (!project) {
        showToast('Error', 'Project not found');
        return;
      }

      // Check permission
      const isOwner = project.ownerId === currentUser?.id || project.owner?.id === currentUser?.id;
      const canEdit = isOwner || isAdmin || currentUser?.role === 'admin' || currentUser?.role === 'mod';
      if (!canEdit) {
        showToast('Error', 'You do not have permission to edit this project');
        return;
      }

      editingProjectId = projectId;

      // Populate the form
      const modal = document.getElementById('createProjectModal');
      if (!modal) return;

      document.getElementById('projectName').value = project.name || '';
      document.getElementById('projectDescription').value = project.description || '';

      // Set category radio
      if (project.category) {
        const radio = modal.querySelector(`input[name="projectCategory"][value="${project.category}"]`);
        if (radio) radio.checked = true;
      }

      // Set status radio
      const statusVal = project.status === 'published' ? 'active' : (project.status || 'active');
      const statusRadio = modal.querySelector(`input[name="projectStatus"][value="${statusVal}"]`);
      if (statusRadio) statusRadio.checked = true;

      // Set image preview if exists
      if (project.image) {
        projectImageData = project.image;
        if (elements.projectImagePreview) {
          elements.projectImagePreview.src = project.image;
          elements.projectImagePreview.style.display = 'block';
        }
        if (elements.projectImagePlaceholder) {
          elements.projectImagePlaceholder.style.display = 'none';
        }
        if (elements.projectImageUpload) {
          elements.projectImageUpload.classList.add('image-upload--has-image');
        }
      }

      // Update modal title and button text
      const modalTitle = modal.querySelector('.modal__title');
      if (modalTitle) modalTitle.textContent = 'Edit Project';

      const submitText = document.getElementById('projectSubmitText');
      if (submitText) submitText.textContent = 'Save Changes';

      projectWizardStep = 1;
      updateProjectWizard();
      openModal('createProjectModal');
    } catch (error) {
      console.error('[Dashboard] Failed to load project for editing:', error);
      showToast('Error', 'Failed to load project');
    }
  }

  async function handleDeleteProject(projectId, isAdmin = false) {
    try {
      const project = await PrismBin.getProjectById(projectId);
      if (!project) {
        showToast('Error', 'Project not found');
        return;
      }

      // Check permission
      const isOwner = project.ownerId === currentUser?.id || project.owner?.id === currentUser?.id;
      const canDelete = isOwner || isAdmin || currentUser?.role === 'admin' || currentUser?.role === 'mod';
      if (!canDelete) {
        showToast('Error', 'You do not have permission to delete this project');
        return;
      }

      if (!confirm(`Are you sure you want to delete "${project.name}"? This action cannot be undone.`)) {
        return;
      }

      await PrismBin.deleteProject(projectId);
      showToast('Success', 'Project deleted successfully');
      await loadUserProjects();

      // Reload admin projects if in admin section
      if (currentSection === 'admin') {
        loadAdminProjects?.();
      }
    } catch (error) {
      console.error('[Dashboard] Failed to delete project:', error);
      showToast('Error', error.message || 'Failed to delete project');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EDIT / DELETE COMPANY HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════

  let editingCompanyId = null;

  async function openEditCompanyModal(companyId, isAdmin = false) {
    try {
      const company = await PrismBin.getCompanyById(companyId);
      if (!company) {
        showToast('Error', 'Company not found');
        return;
      }

      // Check permission
      const isOwner = company.ownerId === currentUser?.id || company.owner?.id === currentUser?.id;
      const canEdit = isOwner || isAdmin || currentUser?.role === 'admin' || currentUser?.role === 'mod';
      if (!canEdit) {
        showToast('Error', 'You do not have permission to edit this company');
        return;
      }

      editingCompanyId = companyId;

      // Populate the form
      const modal = document.getElementById('createCompanyModal');
      if (!modal) return;

      document.getElementById('companyName').value = company.name || '';
      document.getElementById('companyDescription').value = company.description || '';

      // Set category radio
      const categories = company.categories || [company.category];
      if (categories.length > 0) {
        const radio = modal.querySelector(`input[name="companyCategory"][value="${categories[0]}"]`);
        if (radio) radio.checked = true;
      }

      // Set logo preview if exists
      if (company.logo || company.logoUrl) {
        companyLogoData = company.logo || company.logoUrl;
        const preview = document.getElementById('companyLogoPreview');
        const placeholder = document.getElementById('companyLogoPlaceholder');
        const upload = document.getElementById('companyLogoUpload');
        
        if (preview) {
          preview.src = companyLogoData;
          preview.style.display = 'block';
        }
        if (placeholder) placeholder.style.display = 'none';
        if (upload) upload.classList.add('image-upload--has-image');
      }

      // Update modal title and button text
      const modalTitle = modal.querySelector('.modal__title');
      if (modalTitle) modalTitle.textContent = 'Edit Company';

      const submitText = document.getElementById('companySubmitText');
      if (submitText) submitText.textContent = 'Save Changes';

      companyWizardStep = 1;
      updateCompanyWizard();
      openModal('createCompanyModal');
    } catch (error) {
      console.error('[Dashboard] Failed to load company for editing:', error);
      showToast('Error', 'Failed to load company');
    }
  }

  async function handleDeleteCompany(companyId, isAdmin = false) {
    try {
      const company = await PrismBin.getCompanyById(companyId);
      if (!company) {
        showToast('Error', 'Company not found');
        return;
      }

      // Check permission
      const isOwner = company.ownerId === currentUser?.id || company.owner?.id === currentUser?.id;
      const canDelete = isOwner || isAdmin || currentUser?.role === 'admin' || currentUser?.role === 'mod';
      if (!canDelete) {
        showToast('Error', 'You do not have permission to delete this company');
        return;
      }

      if (!confirm(`Are you sure you want to delete "${company.name}"? This action cannot be undone.`)) {
        return;
      }

      await PrismBin.deleteCompany(companyId);
      showToast('Success', 'Company deleted successfully');
      await loadUserCompanies();

      // Reload admin companies if in admin section
      if (currentSection === 'admin') {
        loadAdminCompanies?.();
      }
    } catch (error) {
      console.error('[Dashboard] Failed to delete company:', error);
      showToast('Error', error.message || 'Failed to delete company');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // USER MANAGEMENT OVERLAY
  // ═══════════════════════════════════════════════════════════════════════════

  let selectedUserForManagement = null;

  async function openUserManagementOverlay(userId) {
    try {
      const users = await PrismBin.getUsers(true);
      const user = users.find(u => u.id === userId);
      if (!user) {
        showToast('Error', 'User not found');
        return;
      }

      selectedUserForManagement = user;
      renderUserManagementOverlay(user);
      
      const overlay = document.getElementById('userManagementOverlay');
      if (overlay) {
        overlay.classList.add('open');
        document.body.style.overflow = 'hidden';
      }
    } catch (error) {
      console.error('[Dashboard] Failed to open user overlay:', error);
      showToast('Error', 'Failed to load user data');
    }
  }

  function closeUserManagementOverlay() {
    const overlay = document.getElementById('userManagementOverlay');
    if (overlay) {
      overlay.classList.remove('open');
      document.body.style.overflow = '';
    }
    selectedUserForManagement = null;
  }

  function renderUserManagementOverlay(user) {
    const body = document.getElementById('userOverlayBody');
    if (!body) return;

    const nickname = user.mcNickname || user.nickname || 'Unknown';
    const email = user.email || '-';
    const role = user.role || 'user';
    const avatarUrl = user.avatar || user.avatar_url;
    const initials = nickname.slice(0, 2).toUpperCase();
    const joined = user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-';
    const overrides = user.permissionOverrides || {};
    const roleLabels = { user: 'Member', mod: 'Moderator', admin: 'Administrator' };
    const roleClasses = { user: 'badge--secondary', mod: 'badge--warning', admin: 'badge--primary' };

    body.innerHTML = `
      <!-- User Profile Card -->
      <div class="user-overlay__profile">
        <div class="user-overlay__avatar ${avatarUrl ? 'has-avatar' : ''}">
          ${avatarUrl ? `<img src="${avatarUrl}" alt="${escapeHtml(nickname)}">` : initials}
        </div>
        <div class="user-overlay__info">
          <h3 class="user-overlay__name">${escapeHtml(nickname)}</h3>
          <p class="user-overlay__email">${escapeHtml(email)}</p>
          <div class="user-overlay__meta">
            <span class="badge ${roleClasses[role]}">${roleLabels[role]}</span>
            <span class="user-overlay__joined">Joined ${joined}</span>
          </div>
        </div>
      </div>

      <!-- Permissions Section -->
      <div class="user-overlay__section">
        <h4 class="user-overlay__section-title">Permissions</h4>
        <div class="user-overlay__permissions">
          <div class="user-overlay__permission-item">
            <div class="user-overlay__permission-info">
              <span class="user-overlay__permission-name">Create Projects</span>
              <span class="user-overlay__permission-desc">Allow user to create new projects</span>
            </div>
            <label class="toggle">
              <input type="checkbox" 
                     data-permission="create_project" 
                     ${overrides.create_project === true ? 'checked' : ''}
                     ${overrides.create_project === false ? 'disabled' : ''}>
              <span class="toggle__slider"></span>
            </label>
          </div>
          <div class="user-overlay__permission-item">
            <div class="user-overlay__permission-info">
              <span class="user-overlay__permission-name">Create Companies</span>
              <span class="user-overlay__permission-desc">Allow user to create new companies</span>
            </div>
            <label class="toggle">
              <input type="checkbox" 
                     data-permission="create_company" 
                     ${overrides.create_company === true ? 'checked' : ''}
                     ${overrides.create_company === false ? 'disabled' : ''}>
              <span class="toggle__slider"></span>
            </label>
          </div>
          <div class="user-overlay__permission-item">
            <div class="user-overlay__permission-info">
              <span class="user-overlay__permission-name">Create Posts</span>
              <span class="user-overlay__permission-desc">Allow user to create new posts</span>
            </div>
            <label class="toggle">
              <input type="checkbox" 
                     data-permission="create_post" 
                     ${overrides.create_post === true ? 'checked' : ''}
                     ${overrides.create_post === false ? 'disabled' : ''}>
              <span class="toggle__slider"></span>
            </label>
          </div>
        </div>
      </div>

      <!-- Account Management Section -->
      <div class="user-overlay__section">
        <h4 class="user-overlay__section-title">Account Management</h4>
        <div class="user-overlay__actions">
          <button class="btn btn--outline btn--full" data-action="admin-change-username" data-user-id="${user.id}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Change Username
          </button>
          <div class="user-overlay__role-select">
            <label class="user-overlay__label">Role</label>
            <select class="form-control" data-action="admin-change-role" data-user-id="${user.id}" data-current-role="${role}">
              <option value="user" ${role === 'user' ? 'selected' : ''}>Member</option>
              <option value="mod" ${role === 'mod' ? 'selected' : ''}>Moderator</option>
              <option value="admin" ${role === 'admin' ? 'selected' : ''}>Administrator</option>
            </select>
          </div>
          <button class="btn btn--danger btn--outline btn--full" data-action="admin-delete-user" data-user-id="${user.id}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
            Delete User
          </button>
        </div>
      </div>
    `;

    // Add event listeners for permission toggles
    body.querySelectorAll('input[data-permission]').forEach(checkbox => {
      // Store current state
      const permission = checkbox.dataset.permission;
      const currentValue = overrides[permission];
      
      // Set initial visual state
      if (currentValue === false) {
        checkbox.checked = false;
        checkbox.disabled = true;
        checkbox.closest('.user-overlay__permission-item')?.classList.add('permission-disallowed');
      } else if (currentValue === true) {
        checkbox.checked = true;
        checkbox.disabled = false;
        checkbox.closest('.user-overlay__permission-item')?.classList.add('permission-allowed');
      } else {
        checkbox.checked = false;
        checkbox.disabled = false;
        checkbox.closest('.user-overlay__permission-item')?.classList.remove('permission-allowed', 'permission-disallowed');
      }
      
      checkbox.addEventListener('click', async (e) => {
        e.preventDefault();
        const permission = e.target.dataset.permission;
        const currentValue = overrides[permission];
        const item = e.target.closest('.user-overlay__permission-item');
        
        // Cycle through states: null -> true -> false -> null
        let newValue;
        if (currentValue === undefined || currentValue === null) {
          // Default -> Allow
          newValue = true;
          e.target.checked = true;
          e.target.disabled = false;
          item?.classList.add('permission-allowed');
          item?.classList.remove('permission-disallowed');
        } else if (currentValue === true) {
          // Allow -> Disallow
          newValue = false;
          e.target.checked = false;
          e.target.disabled = true;
          item?.classList.remove('permission-allowed');
          item?.classList.add('permission-disallowed');
        } else {
          // Disallow -> Default
          newValue = null;
          e.target.checked = false;
          e.target.disabled = false;
          item?.classList.remove('permission-allowed', 'permission-disallowed');
        }

        await handleToggleUserPermission(user.id, permission, newValue);
      });
    });

    // Add event listener for role change
    const roleSelect = body.querySelector('select[data-action="admin-change-role"]');
    if (roleSelect) {
      roleSelect.addEventListener('change', async (e) => {
        const newRole = e.target.value;
        const oldRole = e.target.dataset.currentRole;
        if (newRole === oldRole) return;
        await handleChangeUserRole(user.id, newRole);
        e.target.dataset.currentRole = newRole;
        // Reload overlay
        await openUserManagementOverlay(user.id);
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ADMIN USER MANAGEMENT HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════

  async function handleToggleUserPermission(userId, permission, value = null) {
    try {
      const users = await PrismBin.getUsers(true);
      const user = users.find(u => u.id === userId);
      if (!user) {
        showToast('Error', 'User not found');
        return;
      }

      const currentOverrides = user.permissionOverrides || {};
      
      // If value is explicitly provided, use it; otherwise toggle
      let newValue;
      if (value !== null) {
        newValue = value;
      } else {
        const currentValue = currentOverrides[permission];
        newValue = currentValue === true ? false : (currentValue === false ? null : true);
      }

      const updates = {
        permissionOverrides: {
          ...currentOverrides,
          [permission]: newValue
        }
      };

      if (newValue === null) {
        delete updates.permissionOverrides[permission];
      }

      await PrismBin.updateUser(userId, updates);
      showToast('Success', 'Permission updated');
      
      // Reload admin users table
      loadAdminUsers();
      
      // Update overlay if open
      if (selectedUserForManagement && selectedUserForManagement.id === userId) {
        const updatedUsers = await PrismBin.getUsers(true);
        const updatedUser = updatedUsers.find(u => u.id === userId);
        if (updatedUser) {
          renderUserManagementOverlay(updatedUser);
        }
      }
    } catch (error) {
      console.error('[Dashboard] Failed to toggle permission:', error);
      showToast('Error', error.message || 'Failed to update permission');
    }
  }

  async function openChangeUsernameModal(userId) {
    const users = await PrismBin.getUsers(true);
    const user = users.find(u => u.id === userId);
    if (!user) {
      showToast('Error', 'User not found');
      return;
    }

    const newUsername = prompt(`Enter new username for ${user.mcNickname || user.nickname}:`, user.mcNickname || user.nickname);
    if (!newUsername || newUsername.trim() === '') return;

    try {
      await PrismBin.updateUser(userId, { mcNickname: newUsername.trim() });
      showToast('Success', 'Username updated');
      loadAdminUsers();
      
      // Update overlay if open
      if (selectedUserForManagement && selectedUserForManagement.id === userId) {
        const updatedUsers = await PrismBin.getUsers(true);
        const updatedUser = updatedUsers.find(u => u.id === userId);
        if (updatedUser) {
          renderUserManagementOverlay(updatedUser);
        }
      }
    } catch (error) {
      console.error('[Dashboard] Failed to change username:', error);
      showToast('Error', error.message || 'Failed to update username');
    }
  }

  async function handleDeleteUser(userId) {
    if (userId === currentUser?.id) {
      showToast('Error', 'You cannot delete yourself');
      return;
    }

    const users = await PrismBin.getUsers(true);
    const user = users.find(u => u.id === userId);
    if (!user) {
      showToast('Error', 'User not found');
      return;
    }

    if (!confirm(`Are you sure you want to delete user "${user.mcNickname || user.nickname}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await PrismBin.deleteUser(userId);
      showToast('Success', 'User deleted');
      
      // Close overlay if open
      if (selectedUserForManagement && selectedUserForManagement.id === userId) {
        closeUserManagementOverlay();
      }
      
      loadAdminUsers();
    } catch (error) {
      console.error('[Dashboard] Failed to delete user:', error);
      showToast('Error', error.message || 'Failed to delete user');
    }
  }

  async function handleChangeUserRole(userId, newRole) {
    if (userId === currentUser?.id && newRole !== 'admin') {
      if (!confirm('You are about to change your own role. This may remove your admin access. Continue?')) {
        return;
      }
    }

    try {
      await PrismBin.updateUser(userId, { role: newRole });
      showToast('Success', `Role changed to ${newRole}`);
      loadAdminUsers();
      
      // Update overlay if open
      if (selectedUserForManagement && selectedUserForManagement.id === userId) {
        const updatedUsers = await PrismBin.getUsers(true);
        const updatedUser = updatedUsers.find(u => u.id === userId);
        if (updatedUser) {
          renderUserManagementOverlay(updatedUser);
        }
      }
    } catch (error) {
      console.error('[Dashboard] Failed to change role:', error);
      showToast('Error', error.message || 'Failed to change role');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PERMISSIONS MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  async function initPermissionsTab() {
    // Load role permissions into the table
    try {
      const rolePerms = await PrismBin.getAllRolePermissions();
      updateRolePermissionsUI(rolePerms);
    } catch (error) {
      console.error('[Dashboard] Failed to load role permissions:', error);
    }
  }

  function updateRolePermissionsUI(rolePerms) {
    const table = document.getElementById('rolePermissionsTable');
    if (!table) return;

    const permTypes = ['create_project', 'create_post', 'trusted_member', 'admin_access'];

    permTypes.forEach(perm => {
      ['user', 'mod'].forEach(role => {
        const checkbox = table.querySelector(`input[data-role="${role}"][data-perm="${perm}"]`);
        if (checkbox) {
          checkbox.checked = rolePerms[role]?.[perm] || false;
        }
      });
    });
  }

  async function saveRolePermissions() {
    const table = document.getElementById('rolePermissionsTable');
    if (!table) return;

    const saveBtn = document.getElementById('saveRolePermissionsBtn');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<span class="spinner-small"></span> Saving...';
    }

    try {
      const permissions = {
        user: {},
        mod: {},
        admin: {
          create_project: true,
          create_post: true,
          trusted_member: true,
          admin_access: true,
        },
      };

      const permTypes = ['create_project', 'create_post', 'trusted_member', 'admin_access'];

      permTypes.forEach(perm => {
        ['user', 'mod'].forEach(role => {
          const checkbox = table.querySelector(`input[data-role="${role}"][data-perm="${perm}"]`);
          if (checkbox) {
            permissions[role][perm] = checkbox.checked;
          }
        });
      });

      await PrismBin.saveRolePermissions(permissions);
      showToast('Success', 'Role permissions saved');
    } catch (error) {
      console.error('[Dashboard] Failed to save role permissions:', error);
      showToast('Error', 'Failed to save permissions');
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
            <polyline points="17 21 17 13 7 13 7 21"/>
            <polyline points="7 3 7 8 15 8"/>
          </svg>
          Save Changes
        `;
      }
    }
  }

  async function resetRolePermissions() {
    if (!confirm('Reset all role permissions to defaults?')) return;

    try {
      await PrismBin.saveRolePermissions(PrismBin.DEFAULT_ROLE_PERMISSIONS);
      updateRolePermissionsUI(PrismBin.DEFAULT_ROLE_PERMISSIONS);
      showToast('Success', 'Permissions reset to defaults');
    } catch (error) {
      showToast('Error', 'Failed to reset permissions');
    }
  }

  // User override search
  let userSearchTimeout = null;
  async function handleUserOverrideSearch(query) {
    const resultsEl = document.getElementById('userOverrideResults');
    if (!resultsEl) return;

    // Handle null/undefined query
    if (!query || typeof query !== 'string' || query.length < 2) {
      resultsEl.innerHTML = `
        <div class="empty-state empty-state--compact">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="11" cy="11" r="8"/>
            <path d="M21 21l-4.35-4.35"/>
          </svg>
          <p>Search for a user to manage their permission overrides</p>
        </div>
      `;
      return;
    }

    resultsEl.innerHTML = '<div class="loading-spinner"></div>';

    try {
      let users;
      try {
        users = await PrismBin.getUsers();
      } catch (fetchErr) {
        console.error('[Dashboard] Failed to fetch users:', fetchErr);
        resultsEl.innerHTML = `
          <div class="empty-state empty-state--compact">
            <p>Failed to load users. Please try again.</p>
          </div>
        `;
        return;
      }
      
      // Ensure users is an array
      if (!Array.isArray(users)) {
        console.warn('[Dashboard] Users data is not an array:', typeof users);
        users = [];
      }
      
      const q = query.toLowerCase();
      const matches = users.filter(u => {
        if (!u) return false;
        try {
          return (u.mcNickname?.toLowerCase()?.includes(q)) ||
                 (u.nickname?.toLowerCase()?.includes(q)) ||
                 (u.email?.toLowerCase()?.includes(q));
        } catch {
          return false;
        }
      }).slice(0, 10);

      if (matches.length === 0) {
        resultsEl.innerHTML = `
          <div class="empty-state empty-state--compact">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            <p>No users found matching "${escapeHtml(query)}"</p>
          </div>
        `;
        return;
      }

      resultsEl.innerHTML = matches.map(user => {
        try {
          const name = user.mcNickname || user.nickname || 'Unknown';
          const initials = (name || 'UN').slice(0, 2).toUpperCase();
          const hasOverrides = user.permissionOverrides && Object.keys(user.permissionOverrides).length > 0;
          const roleBadgeClass = user.role === 'admin' ? 'role-badge--admin' :
                                user.role === 'mod' ? 'role-badge--mod' : 'role-badge--user';

          return `
            <div class="user-result" data-user-id="${escapeHtml(user.id || '')}">
              <div class="user-result__avatar">${escapeHtml(initials)}</div>
              <div class="user-result__info">
                <span class="user-result__name">${escapeHtml(name)}</span>
                <span class="user-result__email">${escapeHtml(user.email || '-')}</span>
              </div>
              <div class="user-result__badge">
                <span class="role-badge ${roleBadgeClass}">${escapeHtml(user.role || 'user')}</span>
              </div>
              ${hasOverrides ? '<span class="user-result__has-overrides">Has Overrides</span>' : ''}
            </div>
          `;
        } catch (renderErr) {
          console.warn('[Dashboard] Failed to render user:', user, renderErr);
          return '';
        }
      }).join('');

    } catch (error) {
      console.error('[Dashboard] User search error:', error);
      resultsEl.innerHTML = `
        <div class="empty-state empty-state--compact">
          <p>Failed to search users</p>
        </div>
      `;
    }
  }

  async function selectUserForOverride(userId) {
    try {
      const user = await PrismBin.getUserById(userId);
      if (!user) {
        showToast('Error', 'User not found');
        return;
      }

      selectedOverrideUser = user;
      userOverrides = { ...user.permissionOverrides } || {};

      const panel = document.getElementById('userOverridePanel');
      const resultsEl = document.getElementById('userOverrideResults');

      if (panel) {
        panel.style.display = 'block';

        const name = user.mcNickname || user.nickname || 'Unknown';
        const initials = name.slice(0, 2).toUpperCase();
        const roleBadgeClass = user.role === 'admin' ? 'role-badge--admin' :
                              user.role === 'mod' ? 'role-badge--mod' : 'role-badge--user';

        document.getElementById('overrideUserAvatar').textContent = initials;
        document.getElementById('overrideUserName').textContent = name;
        document.getElementById('overrideUserRole').innerHTML =
          `<span class="role-badge ${roleBadgeClass}">${user.role || 'user'}</span>`;

        renderUserOverrideList(user);
      }

      if (resultsEl) {
        resultsEl.innerHTML = '';
      }

    } catch (error) {
      console.error('[Dashboard] Failed to load user:', error);
      showToast('Error', 'Failed to load user');
    }
  }

  function renderUserOverrideList(user) {
    const listEl = document.getElementById('userOverrideList');
    if (!listEl) return;

    const rolePerms = PrismBin.getRolePermissions(user.role || 'user');
    const permTypes = [
      { key: 'create_project', name: 'Create Project', desc: 'Can create new projects and objects' },
      { key: 'create_post', name: 'Create Post', desc: 'Can create and publish posts' },
      { key: 'trusted_member', name: 'Trusted Member', desc: 'Bypass moderation for content' },
      { key: 'admin_access', name: 'Admin Access', desc: 'Access admin panel and tools' },
    ];

    listEl.innerHTML = permTypes.map(perm => {
      const roleDefault = rolePerms[perm.key] || false;
      const override = userOverrides[perm.key];
      const hasOverride = typeof override === 'boolean';

      let statusClass = 'override-item__status--from-role';
      let statusText = `From role: ${roleDefault ? 'Allowed' : 'Denied'}`;

      if (hasOverride) {
        statusClass = override ? 'override-item__status--override-on' : 'override-item__status--override-off';
        statusText = override ? 'Override: Allowed' : 'Override: Denied';
      }

      const isDefault = !hasOverride;
      const isOn = hasOverride && override === true;
      const isOff = hasOverride && override === false;

      return `
        <div class="override-item" data-perm="${perm.key}">
          <div class="override-item__info">
            <span class="override-item__name">${perm.name}</span>
            <span class="override-item__status ${statusClass}">${statusText}</span>
          </div>
          <div class="override-item__controls">
            <div class="override-toggle">
              <button type="button" class="override-toggle__btn override-toggle__btn--default ${isDefault ? 'active' : ''}"
                      data-perm="${perm.key}" data-value="default">Default</button>
              <button type="button" class="override-toggle__btn override-toggle__btn--on ${isOn ? 'active' : ''}"
                      data-perm="${perm.key}" data-value="on">On</button>
              <button type="button" class="override-toggle__btn override-toggle__btn--off ${isOff ? 'active' : ''}"
                      data-perm="${perm.key}" data-value="off">Off</button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  function handleOverrideToggle(permKey, value) {
    if (value === 'default') {
      delete userOverrides[permKey];
    } else if (value === 'on') {
      userOverrides[permKey] = true;
    } else if (value === 'off') {
      userOverrides[permKey] = false;
    }

    if (selectedOverrideUser) {
      renderUserOverrideList(selectedOverrideUser);
    }
  }

  async function saveUserOverrides() {
    if (!selectedOverrideUser) return;

    const saveBtn = document.getElementById('saveUserOverridesBtn');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<span class="spinner-small"></span> Saving...';
    }

    try {
      const overrides = Object.keys(userOverrides).length > 0 ? userOverrides : null;
      await PrismBin.setUserPermissionOverrides(selectedOverrideUser.id, overrides);
      selectedOverrideUser.permissionOverrides = overrides;
      showToast('Success', 'User permissions saved');
    } catch (error) {
      console.error('[Dashboard] Failed to save user overrides:', error);
      showToast('Error', 'Failed to save permissions');
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          Save Overrides
        `;
      }
    }
  }

  async function clearUserOverrides() {
    if (!selectedOverrideUser) return;
    if (!confirm('Clear all permission overrides for this user?')) return;

    try {
      await PrismBin.clearUserPermissionOverrides(selectedOverrideUser.id);
      userOverrides = {};
      selectedOverrideUser.permissionOverrides = null;
      renderUserOverrideList(selectedOverrideUser);
      showToast('Success', 'Overrides cleared');
    } catch (error) {
      showToast('Error', 'Failed to clear overrides');
    }
  }

  function closeUserOverridePanel() {
    selectedOverrideUser = null;
    userOverrides = {};

    const panel = document.getElementById('userOverridePanel');
    if (panel) panel.style.display = 'none';

    const searchInput = document.getElementById('userOverrideSearch');
    if (searchInput) searchInput.value = '';

    const resultsEl = document.getElementById('userOverrideResults');
    if (resultsEl) {
      resultsEl.innerHTML = `
        <div class="empty-state empty-state--compact">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="11" cy="11" r="8"/>
            <path d="M21 21l-4.35-4.35"/>
          </svg>
          <p>Search for a user to manage their permission overrides</p>
        </div>
      `;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPANIES MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  async function loadUserCompanies() {
    if (!currentUser) return;

    try {
      console.log('[Dashboard] Loading user companies for user:', currentUser.id);
      
      // Force refresh companies cache
      if (window.PrismBin && window.PrismBin.invalidateCache) {
        window.PrismBin.invalidateCache('companies');
      }
      
      // Load all companies with force refresh, then filter
      const allCompanies = await PrismBin.getCompanies(true);
      console.log('[Dashboard] All companies loaded:', allCompanies.length);
      
      // Filter companies for current user
      const userCompaniesList = allCompanies.filter(c => 
        c.owner?.id === currentUser.id || 
        c.ownerId === currentUser.id ||
        c.members?.some(m => m.id === currentUser.id)
      );

      console.log('[Dashboard] User companies found:', userCompaniesList.length);
      
      // Load invitations in parallel
      const invitations = await PrismBin.getInvitationsForUser(currentUser.id).catch(() => []);

      userCompanies = userCompaniesList;
      renderCompaniesSection();
      renderPendingInvitations(invitations);
    } catch (error) {
      console.error('[Dashboard] Failed to load companies:', error);
      showToast('Error', 'Failed to load companies');
    }
  }

  async function loadPendingInvitations() {
    if (!currentUser) return;

    try {
      const invitations = await PrismBin.getInvitationsForUser(currentUser.id);
      renderPendingInvitations(invitations);
    } catch (error) {
      console.error('[Dashboard] Failed to load invitations:', error);
    }
  }

  function renderPendingInvitations(invitations) {
    const companiesListEl = document.getElementById('companiesList');
    if (!companiesListEl) return;

    // Remove existing pending invitations section
    const existingSection = companiesListEl.querySelector('.pending-invitations');
    if (existingSection) existingSection.remove();

    if (invitations.length === 0) return;

    const section = document.createElement('div');
    section.className = 'pending-invitations';
    section.innerHTML = `
      <div class="pending-invitations__title">
        <span>Pending Invitations</span>
        <span class="pending-invitations__badge">${invitations.length}</span>
      </div>
      ${invitations.map(inv => `
        <div class="invite-card" data-invitation-id="${inv.id}">
          <div class="invite-card__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M3 21h18"/>
              <path d="M5 21V7l8-4v18"/>
              <path d="M19 21V11l-6-4"/>
            </svg>
          </div>
          <div class="invite-card__info">
            <span class="invite-card__company">${escapeHtml(inv.companyName)}</span>
            <span class="invite-card__role">Invited as ${inv.role}</span>
          </div>
          <div class="invite-card__actions">
            <button class="btn btn--primary btn--sm" data-action="accept-invite" data-invitation-id="${inv.id}">Accept</button>
            <button class="btn btn--ghost btn--sm" data-action="decline-invite" data-invitation-id="${inv.id}">Decline</button>
          </div>
        </div>
      `).join('')}
    `;

    companiesListEl.insertBefore(section, companiesListEl.firstChild);
  }

  function renderCompaniesSection() {
    const companiesListEl = document.getElementById('companiesList');
    if (!companiesListEl) return;

    // Clear but preserve pending invitations
    const pendingSection = companiesListEl.querySelector('.pending-invitations');
    companiesListEl.innerHTML = '';
    if (pendingSection) companiesListEl.appendChild(pendingSection);

    // Check if user can create companies
    const canCreateCompany = PrismBin.checkUserPermissionSync(currentUser, 'create_company');

    // Show Create tile only if user has permission
    const createTileHTML = canCreateCompany ? `
      <div class="create-tile" data-action="create-company">
        <div class="create-tile__icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </div>
        <span class="create-tile__label">Create Company</span>
      </div>
    ` : '';

    if (userCompanies.length === 0) {
      companiesListEl.innerHTML += `
        <div class="dashboard-grid dashboard-grid--companies">
          ${createTileHTML}
        </div>
      `;
      return;
    }

    const cardsHTML = userCompanies.map(company => {
      const userRole = company.owner?.id === currentUser.id ? 'owner' :
                       company.members?.find(m => m.id === currentUser.id)?.role || 'member';
      const memberCount = company.members?.length || 1;

      return `
        <div class="company-card" data-company-id="${company.id}">
          <div class="company-card__header">
            <div class="company-card__icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M3 21h18"/>
                <path d="M5 21V7l8-4v18"/>
                <path d="M19 21V11l-6-4"/>
              </svg>
            </div>
            <div class="company-card__info">
              <h3 class="company-card__name">${escapeHtml(company.name)}</h3>
              <span class="company-card__role company-card__role--${userRole}">${userRole}</span>
            </div>
          </div>
          <p class="company-card__description">${escapeHtml(company.description || 'No description')}</p>
          <div class="company-card__footer">
            <div class="company-card__stat">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
              </svg>
              ${memberCount} member${memberCount !== 1 ? 's' : ''}
            </div>
            <div class="company-card__stat">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              ${new Date(company.createdAt).toLocaleDateString()}
            </div>
          </div>
        </div>
      `;
    }).join('');

    companiesListEl.innerHTML = (pendingSection ? pendingSection.outerHTML : '') + `
      <div class="dashboard-grid dashboard-grid--companies">
        ${createTileHTML}
        ${cardsHTML}
      </div>
    `;
  }

  async function handleAcceptInvitation(invitationId) {
    if (!currentUser) return;

    try {
      await PrismBin.acceptInvitation(invitationId, currentUser.id);
      showToast('Success', 'You have joined the company!');
      await loadUserCompanies();
    } catch (error) {
      console.error('[Dashboard] Failed to accept invitation:', error);
      showToast('Error', error.message || 'Failed to accept invitation');
    }
  }

  async function handleDeclineInvitation(invitationId) {
    if (!currentUser) return;

    try {
      await PrismBin.declineInvitation(invitationId, currentUser.id);
      showToast('Info', 'Invitation declined');
      await loadPendingInvitations();
    } catch (error) {
      console.error('[Dashboard] Failed to decline invitation:', error);
      showToast('Error', error.message || 'Failed to decline invitation');
    }
  }

  async function handleCreateCompany(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    console.log('[Dashboard] ===== handleCreateCompany START =====');

    try {
      // Check user authentication
      if (!currentUser) {
        console.error('[Dashboard] No currentUser found');
        showToast('Error', 'You must be logged in to create a company');
        return;
      }

      console.log('[Dashboard] Current user:', currentUser.id);

      // Get form data
      const name = document.getElementById('companyName')?.value?.trim();
      const description = document.getElementById('companyDescription')?.value?.trim();
      const categoryCheckboxes = document.querySelectorAll('input[name="companyCategories"]:checked');
      const categories = Array.from(categoryCheckboxes).map(cb => cb.value);

      console.log('[Dashboard] Form data collected:');
      console.log('[Dashboard]   name:', name);
      console.log('[Dashboard]   description:', description?.substring(0, 50));
      console.log('[Dashboard]   categories:', categories);

      // Validate
      if (!name) {
        showToast('Error', 'Please enter a company name');
        return;
      }
      
      if (categories.length === 0) {
        showToast('Error', 'Please select at least one category');
        return;
      }

      // Upload logo if present
      let logoUrl = null;
      if (companyLogoData && companyLogoData.startsWith('data:')) {
        try {
          console.log('[Dashboard] Uploading logo...');
          const uploadResult = await PrismBin.uploadImage(companyLogoData, 'images', 'companies');
          logoUrl = uploadResult?.url || uploadResult;
          console.log('[Dashboard] Logo uploaded:', logoUrl);
        } catch (imgErr) {
          console.warn('[Dashboard] Logo upload failed:', imgErr);
        }
      } else if (companyLogoData) {
        logoUrl = companyLogoData;
      }

      // Prepare company data
      const companyData = {
        name,
        description: description || '',
        categories,
        category: categories[0],
        owner_id: currentUser.id,
        ownerId: currentUser.id,
      };

      if (logoUrl) {
        companyData.logo_url = logoUrl;
      }

      console.log('[Dashboard] Company data to send:', JSON.stringify(companyData, null, 2));

      // Create or update
      let result;
      if (editingCompanyId) {
        console.log('[Dashboard] Updating company:', editingCompanyId);
        result = await PrismBin.updateCompany(editingCompanyId, companyData);
        showToast('Success', 'Company updated!');
        editingCompanyId = null;
      } else {
        console.log('[Dashboard] Creating company via PrismBin.createCompany...');
        result = await PrismBin.createCompany(companyData);
        console.log('[Dashboard] Create result:', result);
        
        if (!result || !result.id) {
          throw new Error('Company creation failed - no result returned');
        }
        
        showToast('Success', 'Company created successfully!');
      }

      console.log('[Dashboard] ===== SUCCESS =====');

      // Close modal and reset
      closeModal('createCompanyModal');
      document.getElementById('createCompanyForm')?.reset();
      document.querySelectorAll('input[name="companyCategories"]').forEach(cb => {
        cb.checked = false;
        cb.disabled = false;
      });
      resetCompanyWizard();
      
      // Force refresh and reload
      if (window.PrismBin?.invalidateCache) {
        window.PrismBin.invalidateCache('companies');
      }
      
      await loadUserCompanies();
      switchSection('companies');
      
      console.log('[Dashboard] Company operation completed successfully');

    } catch (error) {
      console.error('[Dashboard] Company operation failed:', error);
      console.error('[Dashboard] Error details:', {
        message: error.message,
        stack: error.stack,
        error: error
      });
      
      const errorMessage = error?.message || error?.error || 'Failed to save company. Please try again.';
      showToast('Error', errorMessage);
    } finally {
      // Always restore button state
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnContent;
      }
    }
  }

  async function openCompanyDetail(companyId) {
    try {
      const company = await PrismBin.getCompanyById(companyId);
      if (!company) {
        showToast('Error', 'Company not found');
        return;
      }

      selectedCompany = company;
      const userRole = await PrismBin.getUserCompanyRole(companyId, currentUser.id);

      // Update modal content
      document.getElementById('companyDetailName').textContent = company.name;
      
      // Display categories (support both single category and array of categories)
      const categoriesDisplay = formatCompanyCategories(company);
      document.getElementById('companyDetailCategory').textContent = categoriesDisplay;
      
      document.getElementById('companyDetailDescription').textContent = company.description || 'No description';

      // Render actions based on role
      const actionsEl = document.getElementById('companyDetailActions');
      if (actionsEl) {
        if (PrismBin.hasCompanyPermission(userRole, 'admin')) {
          actionsEl.innerHTML = `
            <button class="btn btn--primary btn--sm" data-action="invite-member">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="8.5" cy="7" r="4"/>
                <line x1="20" y1="8" x2="20" y2="14"/>
                <line x1="23" y1="11" x2="17" y2="11"/>
              </svg>
              Invite Member
            </button>
          `;
        } else {
          actionsEl.innerHTML = '';
        }
      }

      // Render members
      await renderCompanyMembers(company, userRole);

      // Render invitations (only for admin+)
      if (PrismBin.hasCompanyPermission(userRole, 'admin')) {
        await renderCompanyInvitations(company);
      }

      // Switch to members tab
      switchCompanyTab('members');

      openModal('companyDetailModal');

    } catch (error) {
      console.error('[Dashboard] Failed to open company detail:', error);
      showToast('Error', 'Failed to load company');
    }
  }

  async function renderCompanyMembers(company, viewerRole) {
    const listEl = document.getElementById('companyMembersList');
    if (!listEl) return;

    const members = company.members || [];
    const isAdmin = PrismBin.hasCompanyPermission(viewerRole, 'admin');

    if (members.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state empty-state--compact">
          <p>No members yet</p>
        </div>
      `;
      return;
    }

    listEl.innerHTML = members.map(member => {
      const initials = (member.nickname || 'U').slice(0, 2).toUpperCase();
      const isTrusted = company.trustedMembers?.includes(member.id);
      const isOwner = member.role === 'owner';
      const canManage = isAdmin && !isOwner && member.id !== currentUser.id;

      return `
        <div class="member-item" data-member-id="${member.id}">
          <div class="member-item__avatar">${initials}</div>
          <div class="member-item__info">
            <span class="member-item__name">${escapeHtml(member.nickname)}</span>
            <span class="member-item__role">
              ${member.role === 'owner' ? 'Owner' : member.role === 'admin' ? 'Admin' : 'Member'}
              ${isTrusted ? '<span class="member-item__badge">Trusted</span>' : ''}
            </span>
          </div>
          ${canManage ? `
            <div class="member-item__actions">
              ${!isTrusted ? `
                <button class="btn btn--ghost btn--icon" data-action="set-trusted" data-member-id="${member.id}" title="Mark as trusted">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  </svg>
                </button>
              ` : `
                <button class="btn btn--ghost btn--icon" data-action="remove-trusted" data-member-id="${member.id}" title="Remove trusted status">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    <line x1="15" y1="9" x2="9" y2="15"/>
                    <line x1="9" y1="9" x2="15" y2="15"/>
                  </svg>
                </button>
              `}
              <button class="btn btn--ghost btn--icon" data-action="remove-member" data-member-id="${member.id}" title="Remove member">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="8.5" cy="7" r="4"/>
                  <line x1="18" y1="8" x2="23" y2="13"/>
                  <line x1="23" y1="8" x2="18" y2="13"/>
                </svg>
              </button>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  }

  async function renderCompanyInvitations(company) {
    const listEl = document.getElementById('companyInvitationsList');
    if (!listEl) return;

    try {
      const invitations = await PrismBin.getPendingInvitationsByCompany(company.id);

      if (invitations.length === 0) {
        listEl.innerHTML = `
          <div class="empty-state empty-state--compact">
            <p>No pending invitations</p>
          </div>
        `;
        return;
      }

      listEl.innerHTML = invitations.map(inv => `
        <div class="invitation-item" data-invitation-id="${inv.id}">
          <div class="invitation-item__info">
            <span class="invitation-item__username">${escapeHtml(inv.inviteeUsername)}</span>
            <div class="invitation-item__meta">
              <span>Invited as ${inv.role}</span>
              <span class="invitation-item__status invitation-item__status--${inv.status}">${inv.status}</span>
            </div>
          </div>
          <div class="invitation-item__actions">
            <button class="btn btn--ghost btn--sm" data-action="cancel-invite" data-invitation-id="${inv.id}">Cancel</button>
          </div>
        </div>
      `).join('');

    } catch (error) {
      console.error('[Dashboard] Failed to load invitations:', error);
      listEl.innerHTML = '<p class="error">Failed to load invitations</p>';
    }
  }

  function switchCompanyTab(tabName) {
    document.querySelectorAll('.company-detail__tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.companyTab === tabName);
    });
    document.querySelectorAll('.company-detail__panel').forEach(panel => {
      panel.classList.toggle('active', panel.dataset.companyPanel === tabName);
    });
  }

  function openInviteMemberModal(companyId) {
    const company = userCompanies.find(c => c.id === companyId) || selectedCompany;
    if (!company) return;

    document.getElementById('inviteCompanyId').value = companyId;
    document.getElementById('inviteModalCompanyName').textContent = `Invite to ${company.name}`;
    document.getElementById('inviteMemberForm')?.reset();
    openModal('inviteMemberModal');
  }

  async function handleInviteMember(e) {
    e.preventDefault();

    const companyId = document.getElementById('inviteCompanyId')?.value;
    const username = document.getElementById('inviteUsername')?.value?.trim();
    const role = document.getElementById('inviteRole')?.value;

    if (!companyId || !username || !role) {
      showToast('Error', 'Please fill in all fields');
      return;
    }

    const submitBtn = document.getElementById('submitInviteBtn');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner-small"></span> Sending...';
    }

    try {
      await PrismBin.createInvitation(companyId, currentUser.id, username, role);
      showToast('Success', `Invitation sent to ${username}!`);
      closeModal('inviteMemberModal');

      // Refresh invitations list if company detail is open
      if (selectedCompany && selectedCompany.id === companyId) {
        await renderCompanyInvitations(selectedCompany);
      }

    } catch (error) {
      console.error('[Dashboard] Failed to send invitation:', error);
      showToast('Error', error.message || 'Failed to send invitation');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
          Send Invite
        `;
      }
    }
  }

  async function handleSetTrustedMember(memberId, isTrusted) {
    if (!selectedCompany) return;

    try {
      await PrismBin.setCompanyTrustedMember(selectedCompany.id, memberId, isTrusted);
      showToast('Success', isTrusted ? 'Member is now trusted' : 'Trusted status removed');

      // Refresh the company data
      selectedCompany = await PrismBin.getCompanyById(selectedCompany.id);
      const userRole = await PrismBin.getUserCompanyRole(selectedCompany.id, currentUser.id);
      await renderCompanyMembers(selectedCompany, userRole);

    } catch (error) {
      console.error('[Dashboard] Failed to update trusted status:', error);
      showToast('Error', error.message || 'Failed to update member');
    }
  }

  async function handleRemoveMember(memberId) {
    if (!selectedCompany) return;
    if (!confirm('Remove this member from the company?')) return;

    try {
      await PrismBin.removeCompanyMember(selectedCompany.id, memberId);
      showToast('Success', 'Member removed');

      // Refresh the company data
      selectedCompany = await PrismBin.getCompanyById(selectedCompany.id);
      const userRole = await PrismBin.getUserCompanyRole(selectedCompany.id, currentUser.id);
      await renderCompanyMembers(selectedCompany, userRole);
      await loadUserCompanies();

    } catch (error) {
      console.error('[Dashboard] Failed to remove member:', error);
      showToast('Error', error.message || 'Failed to remove member');
    }
  }

  async function handleCancelInvitation(invitationId) {
    if (!selectedCompany) return;
    if (!confirm('Cancel this invitation?')) return;

    try {
      await PrismBin.cancelInvitation(invitationId, selectedCompany.id, currentUser.id);
      showToast('Success', 'Invitation cancelled');
      await renderCompanyInvitations(selectedCompany);
    } catch (error) {
      console.error('[Dashboard] Failed to cancel invitation:', error);
      showToast('Error', error.message || 'Failed to cancel invitation');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // COLLABORATIONS MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  let selectedCollabCompany = null;

  async function renderCompanyCollaborations(company) {
    if (!company) return;

    const incomingList = document.getElementById('incomingCollabList');
    const activeList = document.getElementById('activeCollabList');
    const outgoingList = document.getElementById('outgoingCollabList');

    // Get user's role to determine if they can manage collaborations
    const userRole = await PrismBin.getUserCompanyRole(company.id, currentUser.id);
    const canManage = PrismBin.hasCompanyPermission(userRole, 'admin');

    // Show/hide action panel based on permissions
    const actionsPanel = document.getElementById('collabActionsPanel');
    if (actionsPanel) {
      actionsPanel.style.display = canManage ? 'flex' : 'none';
    }

    try {
      // Get all collaborations for this company
      const allCollabs = await PrismBin.getCollaborationsByCompany(company.id);

      // Filter by type
      const incoming = allCollabs.filter(c => c.companyB === company.id && c.status === 'pending');
      const active = allCollabs.filter(c => c.status === 'active');
      const outgoing = allCollabs.filter(c => c.companyA === company.id && c.status === 'pending');

      // Render incoming requests
      if (incomingList) {
        if (incoming.length === 0) {
          incomingList.innerHTML = `
            <div class="collab-empty">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <rect x="3" y="5" width="18" height="14" rx="2"/>
                <polyline points="3 7 12 13 21 7"/>
              </svg>
              <p>No incoming requests</p>
            </div>
          `;
        } else {
          incomingList.innerHTML = incoming.map(collab => `
            <div class="collab-item" data-collab-id="${collab.id}">
              <div class="collab-item__icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M3 21h18"/>
                  <path d="M5 21V7l8-4v18"/>
                  <path d="M19 21V11l-6-4"/>
                </svg>
              </div>
              <div class="collab-item__info">
                <span class="collab-item__name">${escapeHtml(collab.companyAName)}</span>
                <div class="collab-item__meta">
                  <span>Wants to collaborate</span>
                  <span class="collab-item__status collab-item__status--pending">Pending</span>
                </div>
              </div>
              ${canManage ? `
                <div class="collab-item__actions">
                  <button class="btn btn--primary btn--sm" data-action="accept-collab" data-collab-id="${collab.id}">Accept</button>
                  <button class="btn btn--ghost btn--sm" data-action="decline-collab" data-collab-id="${collab.id}">Decline</button>
                </div>
              ` : ''}
            </div>
          `).join('');
        }
      }

      // Render active collaborations
      if (activeList) {
        if (active.length === 0) {
          activeList.innerHTML = `
            <div class="collab-empty">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <circle cx="18" cy="5" r="3"/>
                <circle cx="6" cy="12" r="3"/>
                <circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg>
              <p>No active collaborations</p>
            </div>
          `;
        } else {
          activeList.innerHTML = active.map(collab => {
            const partnerName = collab.companyA === company.id ? collab.companyBName : collab.companyAName;
            return `
              <div class="collab-item" data-collab-id="${collab.id}">
                <div class="collab-item__icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M3 21h18"/>
                    <path d="M5 21V7l8-4v18"/>
                    <path d="M19 21V11l-6-4"/>
                  </svg>
                </div>
                <div class="collab-item__info">
                  <span class="collab-item__name">${escapeHtml(partnerName)}</span>
                  <div class="collab-item__meta">
                    <span>Active since ${new Date(collab.acceptedAt).toLocaleDateString()}</span>
                    <span class="collab-item__status collab-item__status--active">Active</span>
                  </div>
                </div>
                ${canManage ? `
                  <div class="collab-item__actions">
                    <button class="btn btn--danger btn--sm btn--outline" data-action="end-collab" data-collab-id="${collab.id}">End</button>
                  </div>
                ` : ''}
              </div>
            `;
          }).join('');
        }
      }

      // Render outgoing requests
      if (outgoingList) {
        if (outgoing.length === 0) {
          outgoingList.innerHTML = `
            <div class="collab-empty">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
              <p>No outgoing requests</p>
            </div>
          `;
        } else {
          outgoingList.innerHTML = outgoing.map(collab => `
            <div class="collab-item" data-collab-id="${collab.id}">
              <div class="collab-item__icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M3 21h18"/>
                  <path d="M5 21V7l8-4v18"/>
                  <path d="M19 21V11l-6-4"/>
                </svg>
              </div>
              <div class="collab-item__info">
                <span class="collab-item__name">${escapeHtml(collab.companyBName)}</span>
                <div class="collab-item__meta">
                  <span>Sent ${new Date(collab.createdAt).toLocaleDateString()}</span>
                  <span class="collab-item__status collab-item__status--pending">Pending</span>
                </div>
              </div>
              ${canManage ? `
                <div class="collab-item__actions">
                  <button class="btn btn--ghost btn--sm" data-action="cancel-collab" data-collab-id="${collab.id}">Cancel</button>
                </div>
              ` : ''}
            </div>
          `).join('');
        }
      }

    } catch (error) {
      console.error('[Dashboard] Failed to load collaborations:', error);
    }
  }

  function openRequestCollabModal() {
    if (!selectedCompany) return;

    selectedCollabCompany = null;
    document.getElementById('collabFromCompanyId').value = selectedCompany.id;
    document.getElementById('collabModalCompanyName').textContent = `Request collaboration for ${selectedCompany.name}`;
    document.getElementById('collabCompanySearch').value = '';
    document.getElementById('collabToCompanyId').value = '';
    document.getElementById('submitCollabBtn').disabled = true;

    // Reset search results
    const resultsEl = document.getElementById('collabSearchResults');
    if (resultsEl) {
      resultsEl.innerHTML = `
        <div class="empty-state empty-state--compact">
          <p>Search for a company to send a collaboration request</p>
        </div>
      `;
    }

    // Hide selected company panel
    const selectedPanel = document.getElementById('collabSelectedCompany');
    if (selectedPanel) selectedPanel.style.display = 'none';

    openModal('requestCollabModal');
  }

  let collabSearchTimeout = null;
  async function handleCollabCompanySearch(query) {
    const resultsEl = document.getElementById('collabSearchResults');
    if (!resultsEl) return;

    if (!query || query.length < 2) {
      resultsEl.innerHTML = `
        <div class="empty-state empty-state--compact">
          <p>Search for a company to send a collaboration request</p>
        </div>
      `;
      return;
    }

    resultsEl.innerHTML = '<div class="loading-spinner"></div>';

    try {
      const companies = await PrismBin.getCompanies();
      const q = query.toLowerCase();

      // Filter companies - exclude current company and companies user doesn't own/admin
      const matches = companies.filter(c => {
        if (c.id === selectedCompany?.id) return false;
        return c.name?.toLowerCase().includes(q);
      }).slice(0, 8);

      if (matches.length === 0) {
        resultsEl.innerHTML = `
          <div class="empty-state empty-state--compact">
            <p>No companies found matching "${escapeHtml(query)}"</p>
          </div>
        `;
        return;
      }

      resultsEl.innerHTML = matches.map(company => `
        <div class="collab-search-result" data-company-id="${company.id}">
          <div class="collab-search-result__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M3 21h18"/>
              <path d="M5 21V7l8-4v18"/>
              <path d="M19 21V11l-6-4"/>
            </svg>
          </div>
          <div class="collab-search-result__info">
            <span class="collab-search-result__name">${escapeHtml(company.name)}</span>
            <span class="collab-search-result__category">${escapeHtml(formatCompanyCategories(company))}</span>
          </div>
        </div>
      `).join('');

    } catch (error) {
      console.error('[Dashboard] Company search error:', error);
      resultsEl.innerHTML = `
        <div class="empty-state empty-state--compact">
          <p>Failed to search companies</p>
        </div>
      `;
    }
  }

  async function selectCollabCompany(companyId) {
    try {
      const company = await PrismBin.getCompanyById(companyId);
      if (!company) return;

      selectedCollabCompany = company;
      document.getElementById('collabToCompanyId').value = company.id;
      document.getElementById('collabSelectedName').textContent = company.name;
      document.getElementById('collabSelectedCategory').textContent = formatCompanyCategories(company);

      // Show selected panel, hide search results
      document.getElementById('collabSelectedCompany').style.display = 'block';
      document.getElementById('collabSearchResults').innerHTML = '';
      document.getElementById('collabCompanySearch').value = '';

      // Enable submit button
      document.getElementById('submitCollabBtn').disabled = false;

    } catch (error) {
      console.error('[Dashboard] Failed to select company:', error);
    }
  }

  function clearCollabSelection() {
    selectedCollabCompany = null;
    document.getElementById('collabToCompanyId').value = '';
    document.getElementById('collabSelectedCompany').style.display = 'none';
    document.getElementById('submitCollabBtn').disabled = true;

    // Show default search message
    document.getElementById('collabSearchResults').innerHTML = `
      <div class="empty-state empty-state--compact">
        <p>Search for a company to send a collaboration request</p>
      </div>
    `;
  }

  async function handleSubmitCollabRequest(e) {
    e.preventDefault();

    const fromCompanyId = document.getElementById('collabFromCompanyId').value;
    const toCompanyId = document.getElementById('collabToCompanyId').value;

    if (!fromCompanyId || !toCompanyId || !currentUser) {
      showToast('Error', 'Please select a company to collaborate with');
      return;
    }

    const submitBtn = document.getElementById('submitCollabBtn');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner-small"></span> Sending...';
    }

    try {
      await PrismBin.createCollaborationRequest(fromCompanyId, toCompanyId, currentUser.id);
      showToast('Success', 'Collaboration request sent!');
      closeModal('requestCollabModal');

      // Refresh collaborations if company detail is open
      if (selectedCompany) {
        await renderCompanyCollaborations(selectedCompany);
      }

    } catch (error) {
      console.error('[Dashboard] Failed to send collaboration request:', error);
      showToast('Error', error.message || 'Failed to send request');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
          Send Request
        `;
      }
    }
  }

  async function handleAcceptCollaboration(collabId) {
    if (!selectedCompany || !currentUser) return;

    try {
      await PrismBin.acceptCollaboration(collabId, selectedCompany.id, currentUser.id);
      showToast('Success', 'Collaboration accepted!');
      await renderCompanyCollaborations(selectedCompany);
    } catch (error) {
      console.error('[Dashboard] Failed to accept collaboration:', error);
      showToast('Error', error.message || 'Failed to accept collaboration');
    }
  }

  async function handleDeclineCollaboration(collabId) {
    if (!selectedCompany || !currentUser) return;

    try {
      await PrismBin.declineCollaboration(collabId, selectedCompany.id, currentUser.id);
      showToast('Info', 'Collaboration declined');
      await renderCompanyCollaborations(selectedCompany);
    } catch (error) {
      console.error('[Dashboard] Failed to decline collaboration:', error);
      showToast('Error', error.message || 'Failed to decline collaboration');
    }
  }

  async function handleCancelCollaboration(collabId) {
    if (!selectedCompany || !currentUser) return;
    if (!confirm('Cancel this collaboration request?')) return;

    try {
      await PrismBin.cancelCollaboration(collabId, selectedCompany.id, currentUser.id);
      showToast('Info', 'Collaboration request cancelled');
      await renderCompanyCollaborations(selectedCompany);
    } catch (error) {
      console.error('[Dashboard] Failed to cancel collaboration:', error);
      showToast('Error', error.message || 'Failed to cancel');
    }
  }

  async function handleEndCollaboration(collabId) {
    if (!selectedCompany || !currentUser) return;
    if (!confirm('End this collaboration? The other company will be notified.')) return;

    try {
      await PrismBin.cancelCollaboration(collabId, selectedCompany.id, currentUser.id);
      showToast('Info', 'Collaboration ended');
      await renderCompanyCollaborations(selectedCompany);
    } catch (error) {
      console.error('[Dashboard] Failed to end collaboration:', error);
      showToast('Error', error.message || 'Failed to end collaboration');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPANY CONTENT MANAGEMENT (Lines, Stations, Buildings)
  // ═══════════════════════════════════════════════════════════════════════════

  let currentContentFilter = 'all';
  let editingContentItem = null;

  async function renderCompanyContent(company, filter = 'all') {
    if (!company) return;

    const contentList = document.getElementById('companyContentList');
    const sharedSection = document.getElementById('sharedContentSection');
    const sharedList = document.getElementById('sharedContentList');
    const actionsPanel = document.getElementById('contentActionsPanel');

    currentContentFilter = filter;

    // Get user's role
    const userRole = await PrismBin.getUserCompanyRole(company.id, currentUser.id);
    const canManage = PrismBin.hasCompanyPermission(userRole, 'admin');

    // Show/hide actions based on role
    if (actionsPanel) {
      actionsPanel.style.display = userRole ? 'flex' : 'none';
    }

    try {
      // Get company content
      let content = await PrismBin.getContentByCompany(company.id);

      // Apply filter
      if (filter !== 'all') {
        content = content.filter(c => c.type === filter);
      }

      // Render content list
      if (contentList) {
        if (content.length === 0) {
          contentList.innerHTML = `
            <div class="content-empty">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M3 3h18v18H3z"/>
                <path d="M9 3v18"/>
                <path d="M15 3v18"/>
                <path d="M3 9h18"/>
                <path d="M3 15h18"/>
              </svg>
              <p>No ${filter === 'all' ? 'content' : filter + 's'} yet</p>
            </div>
          `;
        } else {
          contentList.innerHTML = content.map(item => renderContentItem(item, canManage)).join('');
        }
      }

      // Get and render shared content from collaborators
      const sharedContent = await PrismBin.getSharedContentFromCollaborators(company.id);
      const filteredShared = filter === 'all' ? sharedContent : sharedContent.filter(c => c.type === filter);

      if (sharedSection && sharedList) {
        if (filteredShared.length === 0) {
          sharedSection.style.display = 'none';
        } else {
          sharedSection.style.display = 'block';
          sharedList.innerHTML = filteredShared.map(item => renderContentItem(item, false, true)).join('');
        }
      }

    } catch (error) {
      console.error('[Dashboard] Failed to load content:', error);
      if (contentList) {
        contentList.innerHTML = `
          <div class="content-empty">
            <p>Failed to load content</p>
          </div>
        `;
      }
    }
  }

  function renderContentItem(item, canManage = false, isFromCollaborator = false) {
    const icons = {
      line: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
        <line x1="4" y1="22" x2="4" y2="15"/>
      </svg>`,
      station: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>`,
      building: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M3 21h18"/>
        <path d="M5 21V7l8-4v18"/>
        <path d="M19 21V11l-6-4"/>
      </svg>`,
    };

    const sharedClass = item.shared ? 'content-item--shared' : '';

    return `
      <div class="content-item ${sharedClass}" data-content-id="${item.id}">
        <div class="content-item__icon content-item__icon--${item.type}">
          ${icons[item.type] || icons.building}
        </div>
        <div class="content-item__info">
          <div class="content-item__name">
            ${escapeHtml(item.name)}
            ${item.shared ? `
              <span class="content-item__shared-badge">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="18" cy="5" r="3"/>
                  <circle cx="6" cy="12" r="3"/>
                  <circle cx="18" cy="19" r="3"/>
                </svg>
                Shared
              </span>
            ` : ''}
          </div>
          <div class="content-item__meta">
            <span class="content-item__type">${item.type}</span>
            ${isFromCollaborator ? `<span class="content-item__company">from ${escapeHtml(item.companyName)}</span>` : ''}
            ${item.description ? `<span>${escapeHtml(item.description.substring(0, 50))}${item.description.length > 50 ? '...' : ''}</span>` : ''}
          </div>
        </div>
        ${canManage && !isFromCollaborator ? `
          <div class="content-item__actions">
            <button class="btn btn--ghost btn--icon" data-action="toggle-content-shared" data-content-id="${item.id}" title="${item.shared ? 'Unshare' : 'Share with collaborators'}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                <circle cx="18" cy="5" r="3"/>
                <circle cx="6" cy="12" r="3"/>
                <circle cx="18" cy="19" r="3"/>
                ${item.shared ? '' : '<line x1="1" y1="1" x2="23" y2="23"/>'}
              </svg>
            </button>
            <button class="btn btn--ghost btn--icon" data-action="edit-content" data-content-id="${item.id}" title="Edit">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button class="btn btn--ghost btn--icon" data-action="delete-content" data-content-id="${item.id}" title="Delete">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          </div>
        ` : ''}
      </div>
    `;
  }

  function openAddContentModal(editItem = null) {
    if (!selectedCompany) return;

    editingContentItem = editItem;

    document.getElementById('contentCompanyId').value = selectedCompany.id;
    document.getElementById('contentItemId').value = editItem?.id || '';

    // Update modal title
    document.getElementById('contentModalTitle').textContent = editItem ? 'Edit Content' : 'Add Content';
    document.getElementById('contentModalSubtitle').textContent = editItem
      ? `Editing ${editItem.name}`
      : 'Create a new line, station, or building';

    // Fill form if editing
    if (editItem) {
      document.querySelector(`input[name="contentType"][value="${editItem.type}"]`).checked = true;
      document.getElementById('contentName').value = editItem.name;
      document.getElementById('contentDescription').value = editItem.description || '';
      document.getElementById('contentShared').checked = editItem.shared || false;
    } else {
      document.getElementById('addContentForm').reset();
      document.querySelector('input[name="contentType"][value="line"]').checked = true;
    }

    openModal('addContentModal');
  }

  async function handleSubmitContent(e) {
    e.preventDefault();

    const companyId = document.getElementById('contentCompanyId').value;
    const itemId = document.getElementById('contentItemId').value;
    const type = document.querySelector('input[name="contentType"]:checked')?.value;
    const name = document.getElementById('contentName').value.trim();
    const description = document.getElementById('contentDescription').value.trim();
    const shared = document.getElementById('contentShared').checked;

    if (!companyId || !type || !name) {
      showToast('Error', 'Please fill in required fields');
      return;
    }

    const submitBtn = document.getElementById('submitContentBtn');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner-small"></span> Saving...';
    }

    try {
      if (itemId) {
        // Update existing item
        await PrismBin.updateContentItem(itemId, { type, name, description, shared }, currentUser.id);
        showToast('Success', 'Content updated!');
      } else {
        // Create new item
        await PrismBin.createCompanyContentItem(companyId, { type, name, description }, currentUser.id);
        showToast('Success', 'Content created!');
      }

      closeModal('addContentModal');
      editingContentItem = null;

      // Refresh content
      if (selectedCompany) {
        await renderCompanyContent(selectedCompany, currentContentFilter);
      }

    } catch (error) {
      console.error('[Dashboard] Failed to save content:', error);
      showToast('Error', error.message || 'Failed to save content');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          Save Content
        `;
      }
    }
  }

  async function handleToggleContentShared(contentId) {
    if (!selectedCompany || !currentUser) return;

    try {
      await PrismBin.toggleContentShared(contentId, currentUser.id);
      showToast('Success', 'Sharing status updated');
      await renderCompanyContent(selectedCompany, currentContentFilter);
    } catch (error) {
      console.error('[Dashboard] Failed to toggle shared:', error);
      showToast('Error', error.message || 'Failed to update sharing');
    }
  }

  async function handleEditContent(contentId) {
    try {
      const item = await PrismBin.getContentById(contentId);
      if (item) {
        openAddContentModal(item);
      }
    } catch (error) {
      console.error('[Dashboard] Failed to load content for edit:', error);
      showToast('Error', 'Failed to load content');
    }
  }

  async function handleDeleteContent(contentId) {
    if (!selectedCompany || !currentUser) return;
    if (!confirm('Delete this content item?')) return;

    try {
      await PrismBin.deleteContentItem(contentId, currentUser.id);
      showToast('Success', 'Content deleted');
      await renderCompanyContent(selectedCompany, currentContentFilter);
    } catch (error) {
      console.error('[Dashboard] Failed to delete content:', error);
      showToast('Error', error.message || 'Failed to delete');
    }
  }

  function handleContentFilterChange(filter) {
    currentContentFilter = filter;

    // Update filter buttons
    document.querySelectorAll('.content-filter').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.contentType === filter);
    });

    // Re-render content
    if (selectedCompany) {
      renderCompanyContent(selectedCompany, filter);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MODERATION SYSTEM - ENTITIES MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  let currentEntityType = 'companies';
  let currentRequestType = 'moderation';

  function loadModerationContent() {
    // Initialize subtabs
    initModerationSubtabs();
    // Load default entity type
    loadEntities(currentEntityType);
  }

  function initModerationSubtabs() {
    // Subtab switching
    document.querySelectorAll('.moderation-subtab').forEach(tab => {
      tab.addEventListener('click', () => {
        const subtab = tab.dataset.subtab;
        document.querySelectorAll('.moderation-subtab').forEach(t => t.classList.toggle('active', t.dataset.subtab === subtab));
        document.querySelectorAll('.moderation-subpanel').forEach(p => p.classList.toggle('active', p.dataset.subpanel === subtab));
        
        if (subtab === 'entities') {
          loadEntities(currentEntityType);
        } else if (subtab === 'requests') {
          if (currentRequestType === 'moderation') {
            loadModerationRequests(currentModerationFilter);
          } else {
            loadNicknameRequests(currentNicknameFilter);
          }
        }
      });
    });

    // Entity type tabs
    document.querySelectorAll('.entity-type-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const type = tab.dataset.entityType;
        document.querySelectorAll('.entity-type-tab').forEach(t => t.classList.toggle('active', t.dataset.entityType === type));
        currentEntityType = type;
        loadEntities(type);
      });
    });

    // Request type tabs
    document.querySelectorAll('.request-type-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const type = tab.dataset.requestType;
        document.querySelectorAll('.request-type-tab').forEach(t => t.classList.toggle('active', t.dataset.requestType === type));
        currentRequestType = type;
        if (type === 'moderation') {
          loadModerationRequests(currentModerationFilter);
        } else {
          loadNicknameRequests(currentNicknameFilter);
        }
      });
    });

    // Entity search
    const entitySearch = document.getElementById('entitySearch');
    if (entitySearch) {
      entitySearch.addEventListener('input', (e) => {
        filterEntities(e.target.value);
      });
    }
  }

  let allEntities = [];

  async function loadEntities(type) {
    currentEntityType = type;
    const tbody = document.getElementById('entityTableBody');
    const thead = document.getElementById('entityTableHead');
    if (!tbody) return;

    // Update table header based on type
    if (thead) {
      if (type === 'posts') {
        thead.innerHTML = `
          <tr>
            <th>Title</th>
            <th>Author</th>
            <th>Category</th>
            <th>Date</th>
            <th>Actions</th>
          </tr>
        `;
      } else {
        thead.innerHTML = `
          <tr>
            <th>Name</th>
            <th>Owner</th>
            <th>Category</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        `;
      }
    }

    tbody.innerHTML = `
      <tr class="admin-table__loading">
        <td colspan="5">
          <div class="loading-spinner"></div>
          <span>Loading ${type}...</span>
        </td>
      </tr>
    `;

    try {
      let data = [];
      if (type === 'companies') {
        data = await PrismBin.getCompanies(true);
      } else if (type === 'projects') {
        data = await PrismBin.getProjects(true);
      } else if (type === 'posts') {
        data = await PrismBin.getPosts(true);
      }

      allEntities = data || [];
      renderEntitiesTable(type, allEntities);
    } catch (error) {
      console.error(`[Dashboard] Failed to load ${type}:`, error);
      tbody.innerHTML = `
        <tr class="admin-table__error">
          <td colspan="5">Failed to load ${type}. <button class="btn btn--sm btn--outline" onclick="loadEntities('${type}')">Retry</button></td>
        </tr>
      `;
    }
  }

  function filterEntities(query) {
    if (!query || query.length === 0) {
      renderEntitiesTable(currentEntityType, allEntities);
      return;
    }

    const lowerQuery = query.toLowerCase();
    const filtered = allEntities.filter(item => {
      const name = (item.name || item.title || '').toLowerCase();
      const owner = (item.owner?.nickname || item.author?.nickname || '').toLowerCase();
      const category = (item.category || '').toLowerCase();
      return name.includes(lowerQuery) || owner.includes(lowerQuery) || category.includes(lowerQuery);
    });

    renderEntitiesTable(currentEntityType, filtered);
  }

  function renderEntitiesTable(type, items) {
    const tbody = document.getElementById('entityTableBody');
    if (!tbody) return;

    if (!items || items.length === 0) {
      tbody.innerHTML = `
        <tr class="admin-table__empty">
          <td colspan="5">No ${type} found</td>
        </tr>
      `;
      return;
    }

    const statusClasses = { 
      active: 'badge--success', 
      published: 'badge--success',
      paused: 'badge--warning', 
      completed: 'badge--secondary',
      draft: 'badge--secondary'
    };

    tbody.innerHTML = items.map(item => {
      const name = item.name || item.title || 'Unnamed';
      const ownerName = item.owner?.nickname || item.author?.nickname || 'Unknown';
      const category = CATEGORY_DISPLAY_LABELS[item.category] || item.category || '-';
      const status = item.status || 'active';
      const date = item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '-';

      if (type === 'posts') {
        return `
          <tr data-item-id="${item.id}">
            <td><span class="admin-entity-name">${escapeHtml(name)}</span></td>
            <td>${escapeHtml(ownerName)}</td>
            <td>${escapeHtml(category)}</td>
            <td>${date}</td>
            <td>
              <div class="admin-actions">
                <button class="btn btn--sm btn--outline" data-action="admin-edit-post" data-post-id="${item.id}">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                  Edit
                </button>
                <button class="btn btn--sm btn--outline btn--danger" data-action="admin-delete-post" data-post-id="${item.id}">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                  </svg>
                  Delete
                </button>
              </div>
            </td>
          </tr>
        `;
      } else if (type === 'projects') {
        return `
          <tr data-item-id="${item.id}">
            <td><span class="admin-entity-name">${escapeHtml(name)}</span></td>
            <td>${escapeHtml(ownerName)}</td>
            <td>${escapeHtml(category)}</td>
            <td><span class="badge ${statusClasses[status] || 'badge--secondary'}">${status}</span></td>
            <td>
              <div class="admin-actions">
                <button class="btn btn--sm btn--outline" data-action="admin-edit-project" data-project-id="${item.id}">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                  Edit
                </button>
                <button class="btn btn--sm btn--outline btn--danger" data-action="admin-delete-project" data-project-id="${item.id}">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                  </svg>
                  Delete
                </button>
              </div>
            </td>
          </tr>
        `;
      } else {
        // Companies
        return `
          <tr data-item-id="${item.id}">
            <td><span class="admin-entity-name">${escapeHtml(name)}</span></td>
            <td>${escapeHtml(ownerName)}</td>
            <td>${escapeHtml(category)}</td>
            <td><span class="badge ${statusClasses[status] || 'badge--secondary'}">${status}</span></td>
            <td>
              <div class="admin-actions">
                <button class="btn btn--sm btn--outline" data-action="admin-edit-company" data-company-id="${item.id}">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                  Edit
                </button>
                <button class="btn btn--sm btn--outline btn--danger" data-action="admin-delete-company" data-company-id="${item.id}">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                  </svg>
                  Delete
                </button>
              </div>
            </td>
          </tr>
        `;
      }
    }).join('');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MODERATION SYSTEM - REQUESTS
  // ═══════════════════════════════════════════════════════════════════════════

  let currentModerationFilter = 'pending';
  let selectedModerationRequest = null;

  async function loadModerationRequests(filter = 'pending') {
    currentModerationFilter = filter;

    const moderationList = document.getElementById('moderationList');
    const moderationEmpty = document.getElementById('moderationEmpty');
    const pendingCount = document.getElementById('moderationPendingCount');
    const contentRequestsBadge = document.getElementById('contentRequestsBadge');

    if (!moderationList) return;

    // Update filter buttons
    document.querySelectorAll('.moderation-filter').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.filter === filter);
    });

    // Show loading
    moderationList.innerHTML = `
      <div class="moderation-loading">
        <div class="loading-spinner"></div>
        <span>Loading moderation requests...</span>
      </div>
    `;
    if (moderationEmpty) moderationEmpty.style.display = 'none';

    try {
      let requests = await PrismBin.getModerationRequests(true);

      // Update pending count
      const pending = requests.filter(r => r.status === PrismBin.MODERATION_STATUS.PENDING);
      if (pendingCount) {
        pendingCount.textContent = pending.length;
      }
      if (contentRequestsBadge) {
        contentRequestsBadge.textContent = pending.length;
      }

      // Filter requests
      if (filter !== 'all') {
        requests = requests.filter(r => {
          switch (filter) {
            case 'pending':
              return r.status === PrismBin.MODERATION_STATUS.PENDING;
            case 'approved':
              return r.status === PrismBin.MODERATION_STATUS.APPROVED;
            case 'rejected':
              return r.status === PrismBin.MODERATION_STATUS.REJECTED ||
                     r.status === PrismBin.MODERATION_STATUS.REVISION_REQUESTED;
            default:
              return true;
          }
        });
      }

      // Sort by date (newest first)
      requests.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      if (requests.length === 0) {
        moderationList.innerHTML = '';
        if (moderationEmpty) moderationEmpty.style.display = 'flex';
        return;
      }

      if (moderationEmpty) moderationEmpty.style.display = 'none';

      // Get users and companies in parallel for display
      const [users, companies] = await Promise.all([
        PrismBin.getUsers(),
        PrismBin.getCompanies(),
      ]);

      moderationList.innerHTML = requests.map(request => {
        const user = users.find(u => u.id === request.userId);
        const company = request.companyId ? companies.find(c => c.id === request.companyId) : null;

        return renderModerationCard(request, user, company);
      }).join('');

    } catch (error) {
      console.error('[Dashboard] Failed to load moderation requests:', error);
      moderationList.innerHTML = `
        <div class="moderation-empty">
          <p>Failed to load moderation requests</p>
        </div>
      `;
    }
  }

  function renderModerationCard(request, user, company) {
    const typeIcons = {
      create_content: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 5v14M5 12h14"/>
      </svg>`,
      edit_content: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
      </svg>`,
      create_project: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <path d="M3 9h18"/>
        <path d="M9 21V9"/>
      </svg>`,
      create_post: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
      </svg>`,
    };

    const typeLabel = PrismBin.MODERATION_TYPE_LABELS[request.type] || request.type;
    const typeIcon = typeIcons[request.type] || typeIcons.create_content;
    const iconClass = request.type === 'edit_content' ? 'moderation-card__type-icon--edit' :
                      request.type === 'create_project' ? 'moderation-card__type-icon--project' :
                      request.type === 'create_post' ? 'moderation-card__type-icon--post' : '';

    const statusClass = request.status === 'approved' ? 'moderation-card__status--approved' :
                        request.status === 'rejected' ? 'moderation-card__status--rejected' :
                        request.status === 'revision_requested' ? 'moderation-card__status--revision' :
                        'moderation-card__status--pending';

    const statusText = request.status === 'approved' ? 'Одобрено' :
                       request.status === 'rejected' ? 'Отклонено' :
                       request.status === 'revision_requested' ? 'Требует доработки' :
                       'На рассмотрении';

    const createdDate = new Date(request.createdAt).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const userName = user?.nickname || user?.name || 'Unknown User';
    const userAvatar = user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=random`;
    const companyName = company?.name || 'N/A';

    return `
      <div class="moderation-card" data-request-id="${request.id}">
        <div class="moderation-card__header">
          <div class="moderation-card__type">
            <div class="moderation-card__type-icon ${iconClass}">
              ${typeIcon}
            </div>
            <span class="moderation-card__type-label">${typeLabel}</span>
          </div>
          <span class="moderation-card__status ${statusClass}">${statusText}</span>
        </div>

        <div class="moderation-card__body">
          <div class="moderation-card__info">
            <div class="moderation-info">
              <span class="moderation-info__label">Пользователь</span>
              <span class="moderation-info__value moderation-info__user">
                <img class="moderation-info__avatar" src="${userAvatar}" alt="${escapeHtml(userName)}">
                ${escapeHtml(userName)}
              </span>
            </div>
            <div class="moderation-info">
              <span class="moderation-info__label">Компания</span>
              <span class="moderation-info__value">${escapeHtml(companyName)}</span>
            </div>
            <div class="moderation-info">
              <span class="moderation-info__label">Дата</span>
              <span class="moderation-info__value">${createdDate}</span>
            </div>
          </div>

          <div class="moderation-card__preview">
            <div class="moderation-preview__title">Детали</div>
            <div class="moderation-preview__content">
              ${renderModerationPreview(request)}
            </div>
          </div>
        </div>

        ${request.status === 'pending' ? `
          <div class="moderation-card__actions">
            <button class="btn btn--ghost btn--sm" data-action="view-moderation" data-request-id="${request.id}">
              Просмотр
            </button>
            <button class="btn btn--danger btn--sm" data-action="quick-reject" data-request-id="${request.id}">
              Отклонить
            </button>
            <button class="btn btn--success btn--sm" data-action="quick-approve" data-request-id="${request.id}">
              Одобрить
            </button>
          </div>
        ` : ''}
      </div>
    `;
  }

  function renderModerationPreview(request) {
    const data = request.data || {};

    switch (request.type) {
      case 'create_content':
      case 'edit_content':
        const contentType = PrismBin.CONTENT_TYPE_LABELS[data.contentType] || data.contentType;
        return `
          <div class="moderation-preview__item">
            <span class="moderation-preview__key">Тип:</span>
            <span class="moderation-preview__value">${escapeHtml(contentType)}</span>
          </div>
          <div class="moderation-preview__item">
            <span class="moderation-preview__key">Название:</span>
            <span class="moderation-preview__value">${escapeHtml(data.name || 'N/A')}</span>
          </div>
          ${data.description ? `
            <div class="moderation-preview__item">
              <span class="moderation-preview__key">Описание:</span>
              <span class="moderation-preview__value">${escapeHtml(data.description)}</span>
            </div>
          ` : ''}
        `;

      case 'create_project':
        return `
          <div class="moderation-preview__item">
            <span class="moderation-preview__key">Название:</span>
            <span class="moderation-preview__value">${escapeHtml(data.name || 'N/A')}</span>
          </div>
          <div class="moderation-preview__item">
            <span class="moderation-preview__key">Категория:</span>
            <span class="moderation-preview__value">${escapeHtml(data.category || 'N/A')}</span>
          </div>
        `;

      case 'create_post':
        return `
          <div class="moderation-preview__item">
            <span class="moderation-preview__key">Заголовок:</span>
            <span class="moderation-preview__value">${escapeHtml(data.title || 'N/A')}</span>
          </div>
          <div class="moderation-preview__item">
            <span class="moderation-preview__key">Категория:</span>
            <span class="moderation-preview__value">${escapeHtml(data.category || 'N/A')}</span>
          </div>
        `;

      default:
        return '<p>No preview available</p>';
    }
  }

  function openModerationReviewModal(requestId) {
    loadModerationReview(requestId);
    openModal('moderationReviewModal');
  }

  async function loadModerationReview(requestId) {
    // Load request and reference data in parallel
    const [request, users, companies] = await Promise.all([
      PrismBin.getModerationRequestById(requestId),
      PrismBin.getUsers(),
      PrismBin.getCompanies(),
    ]);

    if (!request) {
      showToast('Error', 'Request not found');
      closeModal('moderationReviewModal');
      return;
    }

    selectedModerationRequest = request;

    const user = users.find(u => u.id === request.userId);
    const company = request.companyId ? companies.find(c => c.id === request.companyId) : null;

    // Update modal content
    const typeLabel = PrismBin.MODERATION_TYPE_LABELS[request.type] || request.type;
    document.getElementById('moderationReviewType').textContent = typeLabel;
    document.getElementById('moderationReviewId').value = request.id;

    // User info
    const userName = user?.nickname || user?.name || 'Unknown';
    const userAvatar = user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=random`;
    document.querySelector('#moderationReviewUser .moderation-detail__avatar').src = userAvatar;
    document.querySelector('#moderationReviewUser .moderation-detail__name').textContent = userName;

    // Company
    document.getElementById('moderationReviewCompany').textContent = company?.name || 'N/A';

    // Date
    const createdDate = new Date(request.createdAt).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    document.getElementById('moderationReviewDate').textContent = createdDate;

    // Content details
    const data = request.data || {};
    const contentType = PrismBin.CONTENT_TYPE_LABELS[data.contentType] || data.contentType || 'N/A';
    document.getElementById('moderationContentType').textContent = contentType;
    document.getElementById('moderationContentName').textContent = data.name || 'N/A';
    document.getElementById('moderationContentDesc').textContent = data.description || 'No description';

    // Clear comment
    document.getElementById('moderationComment').value = '';
  }

  async function handleModerationAction(action) {
    const requestId = document.getElementById('moderationReviewId')?.value || selectedModerationRequest?.id;
    if (!requestId || !currentUser) return;

    const comment = document.getElementById('moderationComment')?.value || null;

    let status;
    switch (action) {
      case 'approve':
        status = PrismBin.MODERATION_STATUS.APPROVED;
        break;
      case 'reject':
        status = PrismBin.MODERATION_STATUS.REJECTED;
        break;
      case 'revision':
        status = PrismBin.MODERATION_STATUS.REVISION_REQUESTED;
        break;
      default:
        return;
    }

    try {
      await PrismBin.reviewModerationRequest(requestId, currentUser.id, status, comment);

      const actionText = action === 'approve' ? 'одобрена' :
                         action === 'reject' ? 'отклонена' : 'отправлена на доработку';
      showToast('Успешно', `Заявка ${actionText}`);

      closeModal('moderationReviewModal');
      selectedModerationRequest = null;

      // Reload moderation list
      await loadModerationRequests(currentModerationFilter);
    } catch (error) {
      console.error('[Dashboard] Moderation action failed:', error);
      showToast('Ошибка', error.message || 'Failed to process request');
    }
  }

  async function handleQuickApprove(requestId) {
    if (!requestId || !currentUser) return;

    try {
      await PrismBin.reviewModerationRequest(requestId, currentUser.id, PrismBin.MODERATION_STATUS.APPROVED);
      showToast('Успешно', 'Заявка одобрена');
      await loadModerationRequests(currentModerationFilter);
    } catch (error) {
      console.error('[Dashboard] Quick approve failed:', error);
      showToast('Ошибка', error.message || 'Failed to approve');
    }
  }

  async function handleQuickReject(requestId) {
    if (!requestId || !currentUser) return;
    if (!confirm('Отклонить эту заявку?')) return;

    try {
      await PrismBin.reviewModerationRequest(requestId, currentUser.id, PrismBin.MODERATION_STATUS.REJECTED);
      showToast('Успешно', 'Заявка отклонена');
      await loadModerationRequests(currentModerationFilter);
    } catch (error) {
      console.error('[Dashboard] Quick reject failed:', error);
      showToast('Ошибка', error.message || 'Failed to reject');
    }
  }

  function handleModerationFilterChange(filter) {
    // Load based on current request type
    if (currentRequestType === 'nickname') {
      loadNicknameRequests(filter);
    } else {
      loadModerationRequests(filter);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // NICKNAME REQUESTS (Username Change Moderation)
  // ═══════════════════════════════════════════════════════════════════════════

  let currentNicknameFilter = 'pending';

  async function loadNicknameRequests(filter = 'pending') {
    currentNicknameFilter = filter;

    // Use shared moderation list element
    const requestsList = document.getElementById('moderationList');
    const requestsEmpty = document.getElementById('moderationEmpty');
    const pendingCount = document.getElementById('nicknameRequestsBadge');

    if (!requestsList) return;

    // Update filter buttons
    document.querySelectorAll('.moderation-filter').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.filter === filter);
    });

    // Show loading
    requestsList.innerHTML = `
      <div class="moderation-loading">
        <div class="loading-spinner"></div>
        <span>Loading nickname requests...</span>
      </div>
    `;
    if (requestsEmpty) requestsEmpty.style.display = 'none';

    try {
      // Use PrismDB if available, otherwise fallback
      let requests = [];
      if (window.PrismDB) {
        requests = await PrismDB.NicknameRequests.getAll(true);
      }

      // Update pending count
      const pending = requests.filter(r => r.status === 'pending');
      if (pendingCount) {
        pendingCount.textContent = pending.length;
      }

      // Filter requests
      if (filter !== 'all') {
        requests = requests.filter(r => {
          switch (filter) {
            case 'pending':
              return r.status === 'pending';
            case 'approved':
              return r.status === 'approved';
            case 'rejected':
              return r.status === 'rejected';
            default:
              return true;
          }
        });
      }

      // Sort by date (newest first)
      requests.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      if (requests.length === 0) {
        requestsList.innerHTML = '';
        if (requestsEmpty) requestsEmpty.style.display = 'flex';
        return;
      }

      if (requestsEmpty) requestsEmpty.style.display = 'none';

      // Get users for display
      const users = await PrismBin.getUsers();

      requestsList.innerHTML = requests.map(request => {
        const user = users.find(u => u.id === request.userId);
        const moderator = request.moderatorId ? users.find(u => u.id === request.moderatorId) : null;
        return renderNicknameRequestCard(request, user, moderator);
      }).join('');

    } catch (error) {
      console.error('[Dashboard] Failed to load nickname requests:', error);
      requestsList.innerHTML = `
        <div class="moderation-empty">
          <p>Failed to load nickname requests</p>
        </div>
      `;
    }
  }

  function renderNicknameRequestCard(request, user, moderator) {
    const statusClass = request.status === 'approved' ? 'moderation-card__status--approved' :
                        request.status === 'rejected' ? 'moderation-card__status--rejected' :
                        'moderation-card__status--pending';

    const statusText = request.status === 'approved' ? 'Approved' :
                       request.status === 'rejected' ? 'Rejected' :
                       'Pending';

    const createdDate = new Date(request.createdAt).toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const userName = user?.nickname || user?.email || 'Unknown User';
    const userEmail = user?.email || 'N/A';

    const isPending = request.status === 'pending';

    return `
      <div class="moderation-card nickname-request-card" data-request-id="${request.id}">
        <div class="moderation-card__header">
          <div class="moderation-card__type">
            <div class="moderation-card__type-icon moderation-card__type-icon--nickname">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </div>
            <span class="moderation-card__type-label">Nickname Change</span>
          </div>
          <span class="moderation-card__status ${statusClass}">${statusText}</span>
        </div>

        <div class="moderation-card__body">
          <div class="moderation-card__info">
            <div class="moderation-info">
              <span class="moderation-info__label">User</span>
              <span class="moderation-info__value">${escapeHtml(userName)}</span>
            </div>
            <div class="moderation-info">
              <span class="moderation-info__label">Email</span>
              <span class="moderation-info__value">${escapeHtml(userEmail)}</span>
            </div>
          </div>

          <div class="nickname-change-preview">
            <div class="nickname-change-from">
              <span class="nickname-change-label">Current</span>
              <span class="nickname-change-value">${escapeHtml(request.currentNickname)}</span>
            </div>
            <div class="nickname-change-arrow">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="5" y1="12" x2="19" y2="12"/>
                <polyline points="12 5 19 12 12 19"/>
              </svg>
            </div>
            <div class="nickname-change-to">
              <span class="nickname-change-label">Requested</span>
              <span class="nickname-change-value nickname-change-value--new">${escapeHtml(request.requestedNickname)}</span>
            </div>
          </div>

          ${request.reason ? `
          <div class="moderation-card__reason">
            <span class="moderation-card__reason-label">Moderator Note:</span>
            <span class="moderation-card__reason-text">${escapeHtml(request.reason)}</span>
          </div>
          ` : ''}

          ${moderator ? `
          <div class="moderation-info moderation-info--moderator">
            <span class="moderation-info__label">Reviewed by</span>
            <span class="moderation-info__value">${escapeHtml(moderator.nickname || moderator.email)}</span>
          </div>
          ` : ''}
        </div>

        <div class="moderation-card__footer">
          <span class="moderation-card__date">${createdDate}</span>
          ${isPending ? `
          <div class="moderation-card__actions">
            <button class="btn btn--sm btn--success" data-action="approve-nickname" data-request-id="${request.id}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Approve
            </button>
            <button class="btn btn--sm btn--danger" data-action="reject-nickname" data-request-id="${request.id}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
              Reject
            </button>
          </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  async function handleApproveNickname(requestId) {
    if (!requestId || !currentUser) return;

    try {
      if (window.PrismDB) {
        await PrismDB.NicknameRequests.approve(requestId, currentUser.id);
      }
      showToast('Approved', 'Nickname change approved successfully');
      await loadNicknameRequests(currentNicknameFilter);
    } catch (error) {
      console.error('[Dashboard] Nickname approve failed:', error);
      showToast('Error', error.message || 'Failed to approve nickname change');
    }
  }

  async function handleRejectNickname(requestId) {
    if (!requestId || !currentUser) return;

    const reason = prompt('Rejection reason (optional):');
    if (reason === null) return; // User cancelled

    try {
      if (window.PrismDB) {
        await PrismDB.NicknameRequests.reject(requestId, currentUser.id, reason);
      }
      showToast('Rejected', 'Nickname change rejected');
      await loadNicknameRequests(currentNicknameFilter);
    } catch (error) {
      console.error('[Dashboard] Nickname reject failed:', error);
      showToast('Error', error.message || 'Failed to reject nickname change');
    }
  }

  function handleNicknameFilterChange(filter) {
    loadNicknameRequests(filter);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UTILITIES
  // ═══════════════════════════════════════════════════════════════════════════

  const CATEGORY_DISPLAY_LABELS = {
    metro: 'Metro / Transit',
    rail: 'Railway',
    city: 'City Building',
    infrastructure: 'Infrastructure',
    creative: 'Creative / Other',
  };

  function formatCompanyCategories(company) {
    // Handle array of categories
    if (company.categories && Array.isArray(company.categories) && company.categories.length > 0) {
      return company.categories
        .map(cat => CATEGORY_DISPLAY_LABELS[cat] || cat)
        .join(', ');
    }
    // Fallback to single category
    if (company.category) {
      return CATEGORY_DISPLAY_LABELS[company.category] || company.category;
    }
    return 'Company';
  }

  function showToast(title, message, type = 'info') {
    if (window.PrismUI?.showToast) {
      window.PrismUI.showToast(title, message, type);
    } else {
      console.log(`[Toast] ${title}: ${message}`);
    }
  }

  function escapeHtml(text) {
    if (text == null) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TEXT FORMATTING (Markdown)
  // ═══════════════════════════════════════════════════════════════════════════

  function applyTextFormat(textarea, format) {
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end);
    let newText = '';
    let cursorOffset = 0;

    switch (format) {
      case 'bold':
        if (selectedText) {
          newText = `**${selectedText}**`;
          cursorOffset = newText.length;
        } else {
          newText = '**bold text**';
          cursorOffset = 2;
        }
        break;
      case 'italic':
        if (selectedText) {
          newText = `*${selectedText}*`;
          cursorOffset = newText.length;
        } else {
          newText = '*italic text*';
          cursorOffset = 1;
        }
        break;
      case 'link':
        if (selectedText) {
          newText = `[${selectedText}](url)`;
          cursorOffset = newText.length - 4; // Position before "url)"
        } else {
          newText = '[link text](url)';
          cursorOffset = 1;
        }
        break;
      case 'list':
        if (selectedText) {
          // Convert each line to bullet point
          const lines = selectedText.split('\n');
          newText = lines.map(line => `- ${line}`).join('\n');
          cursorOffset = newText.length;
        } else {
          newText = '- item';
          cursorOffset = 2;
        }
        break;
      default:
        return;
    }

    // Insert the formatted text
    textarea.value = textarea.value.substring(0, start) + newText + textarea.value.substring(end);
    
    // Set cursor position
    if (selectedText) {
      textarea.selectionStart = start + cursorOffset;
      textarea.selectionEnd = start + cursorOffset;
    } else {
      // Select the placeholder text
      textarea.selectionStart = start + cursorOffset;
      textarea.selectionEnd = start + newText.length - (format === 'bold' ? 2 : format === 'italic' ? 1 : 0);
    }
    
    textarea.focus();
    
    // Trigger input event for character counters
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CATEGORY CHECKBOX HANDLING
  // ═══════════════════════════════════════════════════════════════════════════

  function setupCategoryCheckboxes() {
    const checkboxContainer = document.getElementById('companyCategoryGrid');
    const hint = document.getElementById('categorySelectionHint');
    
    if (!checkboxContainer) return;
    
    const checkboxes = checkboxContainer.querySelectorAll('input[name="companyCategories"]');
    const isStaff = currentUser?.role === 'admin' || currentUser?.role === 'mod';
    
    // Staff (admin/mod) can select ALL categories, regular users limited to 3
    const MAX_CATEGORIES = isStaff ? 5 : 3;
    
    function updateCheckboxStates() {
      const checked = checkboxContainer.querySelectorAll('input[name="companyCategories"]:checked');
      const checkedCount = checked.length;
      
      // Update hint text
      if (hint) {
        if (isStaff) {
          // Staff can select all - show simpler hint
          if (checkedCount === 0) {
            hint.textContent = 'Select at least 1 category';
            hint.style.color = '';
          } else {
            hint.textContent = `${checkedCount} categories selected`;
            hint.style.color = 'var(--color-success)';
          }
        } else {
          // Regular users - limited to 3
          if (checkedCount === 0) {
            hint.textContent = 'Select at least 1 category (max 3)';
            hint.style.color = '';
          } else if (checkedCount >= MAX_CATEGORIES) {
            hint.textContent = `Maximum ${MAX_CATEGORIES} categories selected`;
            hint.style.color = 'var(--color-warning)';
          } else {
            hint.textContent = `${checkedCount} of ${MAX_CATEGORIES} categories selected`;
            hint.style.color = 'var(--color-success)';
          }
        }
      }
      
      // Disable/enable unchecked checkboxes based on limit
      checkboxes.forEach(cb => {
        if (!cb.checked) {
          cb.disabled = checkedCount >= MAX_CATEGORIES;
          const label = cb.closest('.category-card');
          if (label) {
            label.classList.toggle('category-card--disabled', checkedCount >= MAX_CATEGORIES);
          }
        } else {
          cb.disabled = false;
          const label = cb.closest('.category-card');
          if (label) {
            label.classList.remove('category-card--disabled');
          }
        }
      });

      // Update company wizard Next button state
      const step1NextBtn = document.getElementById('companyStep1Next');
      if (step1NextBtn) {
        step1NextBtn.disabled = checkedCount === 0;
      }
    }
    
    // Add change event listeners
    checkboxes.forEach(cb => {
      cb.addEventListener('change', updateCheckboxStates);
    });
    
    // Initial state
    updateCheckboxStates();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EVENT LISTENERS
  // ═══════════════════════════════════════════════════════════════════════════

  function setupEventListeners() {
    // Mobile sidebar toggle
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('dashboardSidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');

    if (sidebarToggle && sidebar) {
      sidebarToggle.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        sidebarOverlay?.classList.toggle('active');
      });
    }

    if (sidebarOverlay) {
      sidebarOverlay.addEventListener('click', () => {
        sidebar?.classList.remove('open');
        sidebarOverlay.classList.remove('active');
      });
    }

    // Sidebar navigation
    document.querySelectorAll('.sidebar-nav__item').forEach(item => {
      item.addEventListener('click', () => {
        const section = item.dataset.section;
        if (section) switchSection(section);
      });
    });

    // Action cards and buttons via data-action
    document.addEventListener('click', (e) => {
      const actionEl = e.target.closest('[data-action]');
      if (!actionEl) return;

      const action = actionEl.dataset.action;

      switch (action) {
        case 'open-create-post':
          resetPostForm();
          openModal('createPostModal');
          break;
        case 'open-create-project':
          resetProjectForm();
          openModal('createProjectModal');
          break;
        case 'close-post-modal':
          closeModal('createPostModal');
          break;
        case 'close-project-modal':
          closeModal('createProjectModal');
          break;
        // Post wizard navigation
        case 'post-wizard-next':
          goToPostStep(postWizardStep + 1);
          break;
        case 'post-wizard-back':
          goToPostStep(postWizardStep - 1);
          break;
        // Project wizard navigation
        case 'project-wizard-next':
          goToProjectStep(projectWizardStep + 1);
          break;
        case 'project-wizard-back':
          goToProjectStep(projectWizardStep - 1);
          break;
        // Company wizard navigation
        case 'company-wizard-next':
          goToCompanyStep(companyWizardStep + 1);
          break;
        case 'company-wizard-back':
          goToCompanyStep(companyWizardStep - 1);
          break;
        case 'goto-section':
          const target = actionEl.dataset.target;
          if (target) switchSection(target);
          break;
        case 'sidebar-logout':
          console.log('[Dashboard] Logout clicked');
          try {
            // Clear local state
            currentUser = null;
            
            // Use AuthManager (primary) or fallbacks
            if (typeof AuthManager !== 'undefined' && AuthManager.logout) {
              AuthManager.logout();
            } else if (window.PrismGuards?.handleLogout) {
              await window.PrismGuards.handleLogout();
            } else if (window.PrismAuth?.logout) {
              window.PrismAuth.logout();
            } else {
              // Last resort: just redirect
              console.warn('[Dashboard] No logout handler available');
              window.__session = null;
              window.__sessionChecked = false;
              window.location.replace('index.html?logout=1');
            }
          } catch (error) {
            console.error('[Dashboard] Logout error:', error);
            // Force redirect even on error
            window.location.replace('index.html?logout=1');
          }
          break;
        case 'create-company':
          // Check permission before opening modal
          if (!PrismBin.checkUserPermissionSync(currentUser, 'create_company')) {
            showToast('Error', 'You do not have permission to create companies');
            return;
          }
          resetCompanyWizard();
          openModal('createCompanyModal');
          break;
        case 'close-company-modal':
          closeModal('createCompanyModal');
          break;
        case 'close-invite-modal':
          closeModal('inviteMemberModal');
          break;
        case 'close-company-detail':
          closeModal('companyDetailModal');
          selectedCompany = null;
          break;
        case 'invite-member':
          if (selectedCompany) openInviteMemberModal(selectedCompany.id);
          break;
        case 'accept-invite':
          const acceptInvId = actionEl.dataset.invitationId;
          if (acceptInvId) handleAcceptInvitation(acceptInvId);
          break;
        case 'decline-invite':
          const declineInvId = actionEl.dataset.invitationId;
          if (declineInvId) handleDeclineInvitation(declineInvId);
          break;
        case 'cancel-invite':
          const cancelInvId = actionEl.dataset.invitationId;
          if (cancelInvId) handleCancelInvitation(cancelInvId);
          break;
        case 'set-trusted':
          const trustMemberId = actionEl.dataset.memberId;
          if (trustMemberId) handleSetTrustedMember(trustMemberId, true);
          break;
        case 'remove-trusted':
          const untrustMemberId = actionEl.dataset.memberId;
          if (untrustMemberId) handleSetTrustedMember(untrustMemberId, false);
          break;
        case 'remove-member':
          const removeMemberId = actionEl.dataset.memberId;
          if (removeMemberId) handleRemoveMember(removeMemberId);
          break;
        case 'change-nickname':
          window.dispatchEvent(new CustomEvent('show-mc-nickname-modal'));
          break;
        // Collaboration actions
        case 'request-collaboration':
          openRequestCollabModal();
          break;
        case 'close-collab-modal':
          closeModal('requestCollabModal');
          break;
        case 'clear-collab-selection':
          clearCollabSelection();
          break;
        case 'accept-collab':
          const acceptCollabId = actionEl.dataset.collabId;
          if (acceptCollabId) handleAcceptCollaboration(acceptCollabId);
          break;
        case 'decline-collab':
          const declineCollabId = actionEl.dataset.collabId;
          if (declineCollabId) handleDeclineCollaboration(declineCollabId);
          break;
        case 'cancel-collab':
          const cancelCollabId = actionEl.dataset.collabId;
          if (cancelCollabId) handleCancelCollaboration(cancelCollabId);
          break;
        case 'end-collab':
          const endCollabId = actionEl.dataset.collabId;
          if (endCollabId) handleEndCollaboration(endCollabId);
          break;
        // Content actions
        case 'add-content':
          openAddContentModal();
          break;
        case 'close-content-modal':
          closeModal('addContentModal');
          editingContentItem = null;
          break;
        case 'toggle-content-shared':
          const toggleContentId = actionEl.dataset.contentId;
          if (toggleContentId) handleToggleContentShared(toggleContentId);
          break;
        case 'edit-content':
          const editContentId = actionEl.dataset.contentId;
          if (editContentId) handleEditContent(editContentId);
          break;
        case 'delete-content':
          const deleteContentId = actionEl.dataset.contentId;
          if (deleteContentId) handleDeleteContent(deleteContentId);
          break;
        // Moderation actions
        case 'view-moderation':
          const viewRequestId = actionEl.dataset.requestId;
          if (viewRequestId) openModerationReviewModal(viewRequestId);
          break;
        case 'quick-approve':
          const approveRequestId = actionEl.dataset.requestId;
          if (approveRequestId) handleQuickApprove(approveRequestId);
          break;
        case 'quick-reject':
          const rejectRequestId = actionEl.dataset.requestId;
          if (rejectRequestId) handleQuickReject(rejectRequestId);
          break;
        case 'close-moderation-modal':
          closeModal('moderationReviewModal');
          selectedModerationRequest = null;
          break;
        case 'approve-moderation':
          handleModerationAction('approve');
          break;
        case 'reject-moderation':
          handleModerationAction('reject');
          break;
        case 'request-revision':
          handleModerationAction('revision');
          break;
        // Nickname request actions
        case 'approve-nickname':
          const approveNicknameId = actionEl.dataset.requestId;
          if (approveNicknameId) handleApproveNickname(approveNicknameId);
          break;
        case 'reject-nickname':
          const rejectNicknameId = actionEl.dataset.requestId;
          if (rejectNicknameId) handleRejectNickname(rejectNicknameId);
          break;
        // User Post actions
        case 'edit-post':
          const editPostId = actionEl.dataset.postId;
          if (editPostId) openEditPostModal(editPostId);
          break;
        case 'delete-post':
          const deletePostId = actionEl.dataset.postId;
          if (deletePostId) handleDeletePost(deletePostId);
          break;
        // User Project actions
        case 'edit-project':
          const editProjectId = actionEl.dataset.projectId;
          if (editProjectId) openEditProjectModal(editProjectId);
          break;
        case 'delete-project':
          const deleteProjectId = actionEl.dataset.projectId;
          if (deleteProjectId) handleDeleteProject(deleteProjectId);
          break;
        // Admin entity actions
        case 'admin-edit-project':
          const adminEditProjId = actionEl.dataset.projectId;
          if (adminEditProjId) openEditProjectModal(adminEditProjId, true);
          break;
        case 'admin-delete-project':
          const adminDelProjId = actionEl.dataset.projectId;
          if (adminDelProjId) handleDeleteProject(adminDelProjId, true);
          break;
        case 'admin-edit-post':
          const adminEditPostId = actionEl.dataset.postId;
          if (adminEditPostId) openEditPostModal(adminEditPostId, true);
          break;
        case 'admin-delete-post':
          const adminDelPostId = actionEl.dataset.postId;
          if (adminDelPostId) handleDeletePost(adminDelPostId, true);
          break;
        case 'admin-edit-company':
          const adminEditCompId = actionEl.dataset.companyId;
          if (adminEditCompId) openEditCompanyModal(adminEditCompId, true);
          break;
        case 'admin-delete-company':
          const adminDelCompId = actionEl.dataset.companyId;
          if (adminDelCompId) handleDeleteCompany(adminDelCompId, true);
          break;
        // User management actions
        case 'open-user-overlay':
          const overlayUserId = actionEl.dataset.userId;
          if (overlayUserId) openUserManagementOverlay(overlayUserId);
          break;
        case 'close-user-overlay':
          closeUserManagementOverlay();
          break;
        case 'admin-toggle-permission':
          const toggleUserId = actionEl.dataset.userId;
          const togglePerm = actionEl.dataset.permission;
          if (toggleUserId && togglePerm) handleToggleUserPermission(toggleUserId, togglePerm);
          break;
        case 'admin-change-username':
          const changeUsernameId = actionEl.dataset.userId;
          if (changeUsernameId) openChangeUsernameModal(changeUsernameId);
          break;
        case 'admin-delete-user':
          const deleteUserId = actionEl.dataset.userId;
          if (deleteUserId) handleDeleteUser(deleteUserId);
          break;
        case 'admin-change-role':
          const changeRoleUserId = actionEl.dataset.userId;
          const newRole = actionEl.dataset.role;
          if (changeRoleUserId && newRole) handleChangeUserRole(changeRoleUserId, newRole);
          break;
      }
    });

    // Company card click - navigate to company page
    document.getElementById('companiesList')?.addEventListener('click', (e) => {
      const card = e.target.closest('.company-card');
      if (card && !e.target.closest('button')) {
        const companyId = card.dataset.companyId;
        if (companyId) {
          // Navigate to company page
          window.location.href = `company.html?id=${companyId}`;
        }
      }
    });

    // Company detail tabs
    document.querySelectorAll('.company-detail__tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const tabName = tab.dataset.companyTab;
        if (tabName) {
          switchCompanyTab(tabName);
          // Load content when switching to that tab
          if (tabName === 'content' && selectedCompany) {
            renderCompanyContent(selectedCompany, currentContentFilter);
          }
          // Load collaborations when switching to that tab
          if (tabName === 'collaborations' && selectedCompany) {
            renderCompanyCollaborations(selectedCompany);
          }
        }
      });
    });

    // Content type filters
    document.querySelectorAll('.content-filter').forEach(btn => {
      btn.addEventListener('click', () => {
        const filter = btn.dataset.contentType;
        if (filter) handleContentFilterChange(filter);
      });
    });

    // ═══════════════════════════════════════════════════════════════════════
    // WIZARD EVENT LISTENERS
    // ═══════════════════════════════════════════════════════════════════════

    // Post category selection
    document.querySelectorAll('#postCategoryGrid input[name="postCategory"]').forEach(radio => {
      radio.addEventListener('change', () => {
        const nextBtn = document.getElementById('postStep1Next');
        if (nextBtn) nextBtn.disabled = false;
      });
    });

    // Post character counters
    const postTitleInput = document.getElementById('postTitle');
    const postContentInput = document.getElementById('postContent');

    if (postTitleInput) {
      postTitleInput.addEventListener('input', () => {
        const counter = document.getElementById('postTitleCount');
        if (counter) counter.textContent = postTitleInput.value.length;
      });
    }

    if (postContentInput) {
      postContentInput.addEventListener('input', () => {
        const counter = document.getElementById('postContentCount');
        if (counter) counter.textContent = postContentInput.value.length;
      });
    }

    // Project category selection
    document.querySelectorAll('#projectCategoryGrid input[name="projectCategory"]').forEach(radio => {
      radio.addEventListener('change', () => {
        const nextBtn = document.getElementById('projectStep1Next');
        if (nextBtn) nextBtn.disabled = false;
      });
    });

    // Project character counters
    const projectNameInput = document.getElementById('projectName');
    const projectDescInput = document.getElementById('projectDescription');

    if (projectNameInput) {
      projectNameInput.addEventListener('input', () => {
        const counter = document.getElementById('projectNameCount');
        if (counter) counter.textContent = projectNameInput.value.length;
      });
    }

    if (projectDescInput) {
      projectDescInput.addEventListener('input', () => {
        const counter = document.getElementById('projectDescCount');
        if (counter) counter.textContent = projectDescInput.value.length;
      });
    }

    // Company character counters
    const companyNameInput = document.getElementById('companyName');
    const companyDescInput = document.getElementById('companyDescription');

    if (companyNameInput) {
      companyNameInput.addEventListener('input', () => {
        const counter = document.getElementById('companyNameCount');
        if (counter) counter.textContent = companyNameInput.value.length;
      });
    }

    if (companyDescInput) {
      companyDescInput.addEventListener('input', () => {
        const counter = document.getElementById('companyDescCount');
        if (counter) counter.textContent = companyDescInput.value.length;
      });
    }

    // Project image remove button
    const projectImageRemove = document.getElementById('projectImageRemove');
    if (projectImageRemove) {
      projectImageRemove.addEventListener('click', (e) => {
        e.stopPropagation();
        projectImageData = null;
        if (elements.projectImagePreview) {
          elements.projectImagePreview.style.display = 'none';
          elements.projectImagePreview.src = '';
        }
        if (elements.projectImagePlaceholder) {
          elements.projectImagePlaceholder.style.display = 'flex';
        }
        projectImageRemove.style.display = 'none';
        if (elements.projectImageInput) {
          elements.projectImageInput.value = '';
        }
      });
    }

    // Form submissions for companies
    document.getElementById('createCompanyForm')?.addEventListener('submit', handleCreateCompany);
    document.getElementById('inviteMemberForm')?.addEventListener('submit', handleInviteMember);
    document.getElementById('requestCollabForm')?.addEventListener('submit', handleSubmitCollabRequest);
    document.getElementById('addContentForm')?.addEventListener('submit', handleSubmitContent);

    // Company category selection (limit to 3)
    setupCategoryCheckboxes();

    // Company logo upload handlers
    const companyLogoUpload = document.getElementById('companyLogoUpload');
    const companyLogoInput = document.getElementById('companyLogoInput');
    const companyLogoRemove = document.getElementById('companyLogoRemove');
    
    if (companyLogoUpload) {
      companyLogoUpload.addEventListener('click', () => {
        companyLogoInput?.click();
      });
    }
    
    if (companyLogoInput) {
      companyLogoInput.addEventListener('change', handleCompanyLogoChange);
    }
    
    if (companyLogoRemove) {
      companyLogoRemove.addEventListener('click', (e) => {
        e.stopPropagation();
        removeCompanyLogo();
      });
    }

    // Collaboration company search
    const collabSearchInput = document.getElementById('collabCompanySearch');
    if (collabSearchInput) {
      collabSearchInput.addEventListener('input', (e) => {
        clearTimeout(collabSearchTimeout);
        collabSearchTimeout = setTimeout(() => {
          handleCollabCompanySearch(e.target.value.trim());
        }, 300);
      });
    }

    // Collaboration search result click
    document.getElementById('collabSearchResults')?.addEventListener('click', (e) => {
      const result = e.target.closest('.collab-search-result');
      if (result) {
        const companyId = result.dataset.companyId;
        if (companyId) selectCollabCompany(companyId);
      }
    });

    // Admin user search
    const adminUserSearchInput = document.getElementById('adminUserSearch');
    if (adminUserSearchInput) {
      adminUserSearchInput.addEventListener('input', (e) => {
        clearTimeout(adminUserSearchTimeout);
        adminUserSearchTimeout = setTimeout(() => {
          try {
            filterAdminUsers(e.target.value.trim());
          } catch (err) {
            console.error('[Dashboard] Admin user search error:', err);
          }
        }, 300);
      });
    }

    // Admin tabs
    document.querySelectorAll('.admin-tabs__tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const tabName = tab.dataset.adminTab;
        if (tabName) {
          switchAdminTab(tabName);
          // Initialize notifications when switching to that tab
          if (tabName === 'notifications') {
            initAdminNotifications();
          }
          // Load moderation content when switching to that tab
          if (tabName === 'moderation') {
            loadModerationContent();
          }
        }
      });
    });

    // Moderation filters
    document.querySelectorAll('.moderation-filter').forEach(btn => {
      btn.addEventListener('click', () => {
        const filter = btn.dataset.filter;
        if (filter) handleModerationFilterChange(filter);
      });
    });

    // Nickname request filters
    document.querySelectorAll('.nickname-filter').forEach(btn => {
      btn.addEventListener('click', () => {
        const filter = btn.dataset.filter;
        if (filter) handleNicknameFilterChange(filter);
      });
    });

    // Permissions: Role permissions buttons
    document.getElementById('saveRolePermissionsBtn')?.addEventListener('click', saveRolePermissions);
    document.getElementById('resetRolePermissionsBtn')?.addEventListener('click', resetRolePermissions);

    // Permissions: User override search
    const userOverrideSearchInput = document.getElementById('userOverrideSearch');
    if (userOverrideSearchInput) {
      userOverrideSearchInput.addEventListener('input', (e) => {
        clearTimeout(userSearchTimeout);
        userSearchTimeout = setTimeout(() => {
          handleUserOverrideSearch(e.target.value.trim());
        }, 300);
      });
    }

    // Permissions: User result click (select user for override)
    document.getElementById('userOverrideResults')?.addEventListener('click', (e) => {
      const userResult = e.target.closest('.user-result');
      if (userResult) {
        const userId = userResult.dataset.userId;
        if (userId) selectUserForOverride(userId);
      }
    });

    // Permissions: Override toggle buttons
    document.getElementById('userOverrideList')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.override-toggle__btn');
      if (btn) {
        const permKey = btn.dataset.perm;
        const value = btn.dataset.value;
        handleOverrideToggle(permKey, value);
      }
    });

    // Permissions: User override panel buttons
    document.getElementById('saveUserOverridesBtn')?.addEventListener('click', saveUserOverrides);
    document.getElementById('clearUserOverridesBtn')?.addEventListener('click', clearUserOverrides);
    document.getElementById('closeUserOverrideBtn')?.addEventListener('click', closeUserOverridePanel);

    // Theme toggle
    if (elements.dashboardThemeToggle) {
      elements.dashboardThemeToggle.addEventListener('click', (e) => {
        const btn = e.target.closest('.theme-toggle__btn');
        if (btn) {
          handleThemeChange(btn.dataset.theme);
        }
      });
    }

    // Stars toggle
    if (elements.dashboardStarsToggle) {
      elements.dashboardStarsToggle.addEventListener('change', (e) => {
        handleStarsToggle(e.target.checked);
      });
    }

    // Team chip removal
    document.addEventListener('click', (e) => {
      const removeBtn = e.target.closest('.team-chip__remove');
      if (!removeBtn) return;

      const type = removeBtn.dataset.type;
      const index = parseInt(removeBtn.dataset.index, 10);
      removeTeamMember(type, index);
    });

    // Image upload
    elements.projectImageUpload?.addEventListener('click', handleImageUploadClick);
    elements.projectImageInput?.addEventListener('change', handleImageChange);

    // Editor toolbar buttons (Bold, Italic, Link, List)
    document.querySelectorAll('.editor-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const format = btn.dataset.format;
        const textarea = btn.closest('.form-group')?.querySelector('textarea');
        if (format && textarea) {
          applyTextFormat(textarea, format);
        }
      });
    });

    // Add team members
    elements.addProjectCoownerBtn?.addEventListener('click', () => addTeamMember('coowners'));
    elements.addProjectMemberBtn?.addEventListener('click', () => addTeamMember('members'));

    // Enter key in team inputs
    elements.projectCoownerInput?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addTeamMember('coowners');
      }
    });
    elements.projectMemberInput?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addTeamMember('members');
      }
    });

    // Form submissions
    elements.createPostForm?.addEventListener('submit', handlePostSubmit);
    elements.createProjectForm?.addEventListener('submit', handleProjectSubmit);
    
    // Direct click handlers for submit buttons (backup for form submit)
    document.getElementById('submitProjectBtn')?.addEventListener('click', (e) => {
      // Only handle if form submit doesn't work
      if (projectWizardStep === 4) {
        e.preventDefault();
        handleProjectSubmit(e);
      }
    });
    
    document.getElementById('submitCompanyBtn')?.addEventListener('click', async (e) => {
      console.log('[Dashboard] Submit company button clicked');
      console.log('[Dashboard] Current wizard step:', companyWizardStep);
      e.preventDefault();
      e.stopPropagation();
      
      const btn = e.target.closest('button');
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-small"></span> Creating...';
      }
      
      try {
        // Force step 3 since this button only appears on step 3
        companyWizardStep = 3;
        
        // Call handleCreateCompany directly
        console.log('[Dashboard] Calling handleCreateCompany...');
        await handleCreateCompany(e);
      } catch (error) {
        console.error('[Dashboard] Error in submit button handler:', error);
        showToast('Error', error.message || 'An unexpected error occurred');
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <span id="companySubmitText">Create Company</span>
          `;
        }
      }
    });

    // Auth state changes
    window.addEventListener('prism:auth:changed', (e) => {
      currentUser = e.detail?.user || window.__session || null;
      updateUserInfo();
    });

    window.addEventListener('prism:logout', () => {
      currentUser = null;
      window.__session = null;
    });

    // Nickname change modal
    window.addEventListener('show-mc-nickname-modal', () => {
      showNicknameChangeModal();
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // NICKNAME CHANGE MODAL
  // ═══════════════════════════════════════════════════════════════════════════

  async function showNicknameChangeModal() {
    if (!currentUser) return;

    const currentNickname = currentUser.mcNickname || '';
    const isChange = !!currentNickname;

    // Check for pending request
    if (isChange && window.PrismDB) {
      try {
        const hasPending = await PrismDB.NicknameRequests.hasPendingRequest(currentUser.id);
        if (hasPending) {
          const requests = await PrismDB.NicknameRequests.getByUser(currentUser.id);
          const pendingRequest = requests.find(r => r.status === 'pending');
          if (pendingRequest) {
            showPendingNicknameInfo(pendingRequest);
            return;
          }
        }
      } catch (e) {
        console.warn('[Dashboard] Could not check pending requests:', e);
      }
    }

    const title = isChange ? 'Change Your Nickname' : 'Set Your Nickname';
    const subtitle = isChange ? 'Request a new Minecraft username' : 'Enter your Minecraft username';
    const submitText = isChange ? 'Submit Request' : 'Save Nickname';
    const infoText = isChange
      ? 'Nickname changes require moderator approval.'
      : 'This nickname will be used to identify you.';

    const modal = document.createElement('div');
    modal.className = 'modal open';
    modal.id = 'nicknameChangeModal';
    modal.innerHTML = `
      <div class="modal__backdrop" data-action="close-nickname-modal"></div>
      <div class="modal__container modal__container--sm">
        <div class="modal__header">
          <h2 class="modal__title">${title}</h2>
          <button class="modal__close" data-action="close-nickname-modal">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div class="modal__body">
          <p class="modal__subtitle">${subtitle}</p>
          ${isChange ? `<p class="current-nickname">Current: <strong>${escapeHtml(currentNickname)}</strong></p>` : ''}
          <p class="modal__info">${infoText}</p>
          <div class="form-group">
            <label class="form-label" for="newNicknameInput">
              ${isChange ? 'New Nickname' : 'Nickname'}
            </label>
            <input type="text" class="form-input" id="newNicknameInput" 
                   placeholder="e.g. Steve_123" maxlength="16" 
                   pattern="[a-zA-Z0-9_]+" autocomplete="off">
            <span class="form-hint">3-16 characters, letters/numbers/underscores only</span>
            <p class="form-error" id="nicknameError" style="display:none;"></p>
          </div>
        </div>
        <div class="modal__footer">
          <button class="btn btn--ghost" data-action="close-nickname-modal">Cancel</button>
          <button class="btn btn--primary" id="submitNicknameBtn">${submitText}</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';

    const input = document.getElementById('newNicknameInput');
    const submitBtn = document.getElementById('submitNicknameBtn');
    const errorEl = document.getElementById('nicknameError');

    input.focus();

    // Close handlers
    modal.querySelectorAll('[data-action="close-nickname-modal"]').forEach(el => {
      el.addEventListener('click', () => {
        modal.remove();
        document.body.style.overflow = '';
      });
    });

    // Submit handler
    submitBtn.addEventListener('click', async () => {
      const nickname = input.value.trim();
      
      // Validation
      if (!nickname || nickname.length < 3 || nickname.length > 16) {
        errorEl.textContent = 'Nickname must be 3-16 characters';
        errorEl.style.display = 'block';
        return;
      }
      if (!/^[a-zA-Z0-9_]+$/.test(nickname)) {
        errorEl.textContent = 'Only letters, numbers, and underscores allowed';
        errorEl.style.display = 'block';
        return;
      }
      if (isChange && nickname.toLowerCase() === currentNickname.toLowerCase()) {
        errorEl.textContent = 'New nickname must be different';
        errorEl.style.display = 'block';
        return;
      }

      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner-small"></span> Saving...';
      errorEl.style.display = 'none';

      try {
        if (isChange && window.PrismDB) {
          // Create moderation request
          await PrismDB.NicknameRequests.create(currentUser.id, currentNickname, nickname);
          showToast('Request Submitted', 'Your nickname change is pending approval');
        } else {
          // Direct set for first-time
          await PrismAuth.setMcNickname(nickname);
          // Refresh from window.__session (updated by auth module)
          currentUser = window.__session || currentUser;
          updateUserInfo();
          showToast('Nickname Set', `Welcome, ${nickname}!`);
        }
        modal.remove();
        document.body.style.overflow = '';
      } catch (error) {
        errorEl.textContent = error.message || 'Failed to update nickname';
        errorEl.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.textContent = submitText;
      }
    });

    // Enter to submit
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submitBtn.click();
    });
  }

  function showPendingNicknameInfo(request) {
    showToast('Pending Request', `Your request to change nickname to "${request.requestedNickname}" is pending review.`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ADMIN NOTIFICATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  let adminNotifSelectedUsers = [];
  let adminNotifSearchTimeout = null;

  function initAdminNotifications() {
    const form = document.getElementById('adminNotificationForm');
    const targetsSelect = document.getElementById('notifTargets');
    const userSelectGroup = document.getElementById('notifUserSelectGroup');
    const userSearchInput = document.getElementById('notifUserSearch');
    
    if (!form) return;
    
    // Toggle user selection based on target
    targetsSelect?.addEventListener('change', (e) => {
      if (e.target.value === 'selected') {
        userSelectGroup.style.display = 'block';
      } else {
        userSelectGroup.style.display = 'none';
        adminNotifSelectedUsers = [];
        renderAdminNotifSelectedUsers();
      }
    });
    
    // User search for notifications
    userSearchInput?.addEventListener('input', (e) => {
      clearTimeout(adminNotifSearchTimeout);
      adminNotifSearchTimeout = setTimeout(() => {
        searchUsersForNotif(e.target.value.trim());
      }, 300);
    });
    
    // Form submit
    form.addEventListener('submit', handleAdminNotifSubmit);
  }

  async function searchUsersForNotif(query) {
    const resultsEl = document.getElementById('notifUserSearchResults');
    if (!resultsEl) return;
    
    if (!query || query.length < 2) {
      resultsEl.innerHTML = '';
      return;
    }
    
    try {
      const users = await PrismBin.getUsers();
      const filtered = users.filter(u => {
        const name = (u.mcNickname || u.nickname || '').toLowerCase();
        const email = (u.email || '').toLowerCase();
        return name.includes(query.toLowerCase()) || email.includes(query.toLowerCase());
      }).slice(0, 10);
      
      if (filtered.length === 0) {
        resultsEl.innerHTML = '<p class="search-no-results">No users found</p>';
        return;
      }
      
      resultsEl.innerHTML = filtered.map(user => {
        const isSelected = adminNotifSelectedUsers.some(u => u.id === user.id);
        return `
          <div class="user-search-result ${isSelected ? 'selected' : ''}" data-user-id="${user.id}" data-user-name="${escapeHtml(user.mcNickname || user.nickname || '')}">
            <span class="user-search-result__name">${escapeHtml(user.mcNickname || user.nickname || 'Unknown')}</span>
            <span class="user-search-result__email">${escapeHtml(user.email || '')}</span>
            ${isSelected ? '<span class="user-search-result__check">✓</span>' : ''}
          </div>
        `;
      }).join('');
      
      // Add click handlers
      resultsEl.querySelectorAll('.user-search-result').forEach(el => {
        el.addEventListener('click', () => {
          const userId = el.dataset.userId;
          const userName = el.dataset.userName;
          toggleNotifUser(userId, userName);
          searchUsersForNotif(document.getElementById('notifUserSearch')?.value || '');
        });
      });
    } catch (error) {
      console.error('[Dashboard] User search error:', error);
      resultsEl.innerHTML = '<p class="search-error">Failed to search users</p>';
    }
  }

  function toggleNotifUser(userId, userName) {
    const index = adminNotifSelectedUsers.findIndex(u => u.id === userId);
    if (index >= 0) {
      adminNotifSelectedUsers.splice(index, 1);
    } else {
      adminNotifSelectedUsers.push({ id: userId, name: userName });
    }
    renderAdminNotifSelectedUsers();
  }

  function renderAdminNotifSelectedUsers() {
    const container = document.getElementById('notifSelectedUsers');
    if (!container) return;
    
    if (adminNotifSelectedUsers.length === 0) {
      container.innerHTML = '<p class="no-selection">No users selected</p>';
      return;
    }
    
    container.innerHTML = adminNotifSelectedUsers.map(user => `
      <span class="selected-user-chip">
        ${escapeHtml(user.name || 'User')}
        <button type="button" class="chip-remove" data-user-id="${user.id}">&times;</button>
      </span>
    `).join('');
    
    container.querySelectorAll('.chip-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const userId = e.target.dataset.userId;
        toggleNotifUser(userId, '');
      });
    });
  }

  async function handleAdminNotifSubmit(e) {
    e.preventDefault();
    
    const title = document.getElementById('notifTitle')?.value?.trim();
    const message = document.getElementById('notifMessage')?.value?.trim();
    const targets = document.getElementById('notifTargets')?.value;
    const type = document.getElementById('notifType')?.value || 'admin_broadcast';
    
    if (!title || !message || !targets) {
      showToast('Error', 'Please fill in all required fields');
      return;
    }
    
    if (targets === 'selected' && adminNotifSelectedUsers.length === 0) {
      showToast('Error', 'Please select at least one user');
      return;
    }
    
    const submitBtn = document.getElementById('sendNotifBtn');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner-small"></span> Sending...';
    }
    
    try {
      const params = {
        title,
        message,
        type,
        targets: targets === 'selected' ? adminNotifSelectedUsers.map(u => u.id) : targets
      };
      
      const result = await PrismBin.sendBulkNotifications(params);
      showToast('Success', `Notification sent to ${result.count} user(s)`);
      
      // Reset form
      document.getElementById('adminNotificationForm')?.reset();
      adminNotifSelectedUsers = [];
      renderAdminNotifSelectedUsers();
      document.getElementById('notifUserSelectGroup').style.display = 'none';
      document.getElementById('notifUserSearchResults').innerHTML = '';
      
    } catch (error) {
      console.error('[Dashboard] Failed to send notification:', error);
      showToast('Error', error.message || 'Failed to send notification');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
          Send Notification
        `;
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════════

  function cacheElements() {
    // Sidebar
    elements.sidebarUserAvatar = document.getElementById('sidebarUserAvatar');
    elements.sidebarUserName = document.getElementById('sidebarUserName');
    elements.sidebarUserRole = document.getElementById('sidebarUserRole');
    elements.adminSection = document.getElementById('adminSection');

    // Settings
    elements.settingMcNickname = document.getElementById('settingMcNickname');
    elements.settingEmail = document.getElementById('settingEmail');
    elements.settingRole = document.getElementById('settingRole');
    elements.dashboardThemeToggle = document.getElementById('dashboardThemeToggle');
    elements.dashboardStarsToggle = document.getElementById('dashboardStarsToggle');
    elements.discordConnectionStatus = document.getElementById('discordConnectionStatus');

    // Post Modal
    elements.createPostModal = document.getElementById('createPostModal');
    elements.createPostForm = document.getElementById('createPostForm');
    elements.postTitle = document.getElementById('postTitle');
    elements.postContent = document.getElementById('postContent');
    elements.postCategory = document.getElementById('postCategory');
    elements.submitPostBtn = document.getElementById('submitPostBtn');

    // Project Modal
    elements.createProjectModal = document.getElementById('createProjectModal');
    elements.createProjectForm = document.getElementById('createProjectForm');
    elements.projectName = document.getElementById('projectName');
    elements.projectDescription = document.getElementById('projectDescription');
    elements.projectCategory = document.getElementById('projectCategory');
    elements.projectStatus = document.getElementById('projectStatus');
    elements.projectImageUpload = document.getElementById('projectImageUpload');
    elements.projectImageInput = document.getElementById('projectImageInput');
    elements.projectImagePlaceholder = document.getElementById('projectImagePlaceholder');
    elements.projectImagePreview = document.getElementById('projectImagePreview');
    elements.submitProjectBtn = document.getElementById('submitProjectBtn');

    // Team inputs
    elements.projectCoownerInput = document.getElementById('projectCoownerInput');
    elements.projectCoownersList = document.getElementById('projectCoownersList');
    elements.projectCoownersEmpty = document.getElementById('projectCoownersEmpty');
    elements.addProjectCoownerBtn = document.getElementById('addProjectCoownerBtn');
    elements.projectMemberInput = document.getElementById('projectMemberInput');
    elements.projectMembersList = document.getElementById('projectMembersList');
    elements.projectMembersEmpty = document.getElementById('projectMembersEmpty');
    elements.addProjectMemberBtn = document.getElementById('addProjectMemberBtn');
  }

  async function init() {
    if (document.body.dataset.page !== 'dashboard') return;

    console.log('[Dashboard] Initializing...');

    // Wait for guards.js to complete session check (sets window.__session)
    // Guards.js fetches /api/session and stores result in window.__session
    if (!window.__sessionChecked) {
      console.log('[Dashboard] Waiting for session check...');
      await new Promise(resolve => {
        const checkSession = setInterval(() => {
          if (window.__sessionChecked) {
            clearInterval(checkSession);
            resolve();
          }
        }, 50);
        // Timeout after 10 seconds
        setTimeout(() => {
          clearInterval(checkSession);
          resolve();
        }, 10000);
      });
    }

    // Get user from in-memory session (set by guards.js from /api/session)
    currentUser = window.__session || null;

    if (!currentUser) {
      console.log('[Dashboard] User not logged in, redirecting to index');
      window.location.href = 'index.html';
      return;
    }
    
    cacheElements();
    setupEventListeners();
    updateUserInfo();
    initSettings();

    // Prefetch is handled by guards.js after session check
    // No need to call prefetchFor here - SW already has/is loading data

    // Load user companies
    if (currentUser) {
      loadUserCompanies();
    }

    // Handle URL action params (from other pages redirecting here)
    handleUrlActions();

    console.log('[Dashboard] Page initialized');
  }

  /**
   * Handle URL action params for opening modals
   * e.g., ?action=create-project or ?action=create-post
   */
  function handleUrlActions() {
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    const projectId = params.get('projectId');
    const postId = params.get('postId');

    if (action === 'create-project') {
      // Clean URL
      params.delete('action');
      window.history.replaceState({}, '', params.toString() ? `?${params.toString()}` : window.location.pathname);
      
      // Open create project modal after a short delay
      setTimeout(() => {
        resetProjectForm();
        openModal('createProjectModal');
      }, 300);
    } else if (action === 'create-post') {
      // Clean URL
      params.delete('action');
      window.history.replaceState({}, '', params.toString() ? `?${params.toString()}` : window.location.pathname);
      
      // Open create post modal after a short delay
      setTimeout(() => {
        resetPostForm();
        openModal('createPostModal');
      }, 300);
    } else if (action === 'edit-project' && projectId) {
      // Clean URL
      params.delete('action');
      params.delete('projectId');
      window.history.replaceState({}, '', params.toString() ? `?${params.toString()}` : window.location.pathname);
      
      // Load and open edit modal for project
      setTimeout(() => loadAndEditProject(projectId), 300);
    } else if (action === 'edit-post' && postId) {
      // Clean URL
      params.delete('action');
      params.delete('postId');
      window.history.replaceState({}, '', params.toString() ? `?${params.toString()}` : window.location.pathname);
      
      // Load and open edit modal for post
      setTimeout(() => loadAndEditPost(postId), 300);
    }
  }

  // Placeholder functions for edit - can be expanded later
  async function loadAndEditProject(projectId) {
    console.log('[Dashboard] Loading project for edit:', projectId);
    // TODO: Load project data and populate edit form
    resetProjectForm();
    openModal('createProjectModal');
    // Set form to edit mode
  }

  async function loadAndEditPost(postId) {
    console.log('[Dashboard] Loading post for edit:', postId);
    // TODO: Load post data and populate edit form
    resetPostForm();
    openModal('createPostModal');
    // Set form to edit mode
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
