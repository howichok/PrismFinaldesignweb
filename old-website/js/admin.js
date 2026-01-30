/**
 * PrismMTR Admin Panel - JavaScript v3 (SECURE)
 * 
 * FULLY INTEGRATED WITH SECURE ADMIN API
 * - All role changes go through /.netlify/functions/admin-api
 * - Server-side role hierarchy enforcement
 * - Full project management with member editing
 * - Nickname request approval/rejection with notifications
 * 
 * Access Control (enforced SERVER-SIDE):
 * - Mod: Can edit users (not admins), manage nickname requests, manage projects
 * - Admin: Full access to everything including role assignment
 */

(function() {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════════
  // DOM ELEMENTS - Updated for new architecture
  // ═══════════════════════════════════════════════════════════════════════════

  const elements = {
    // Security Gate (replaces old denied screen)
    securityGate: document.getElementById('securityGate'),
    securityStatus: document.getElementById('securityStatus'),
    statusTitle: document.getElementById('statusTitle'),
    statusDesc: document.getElementById('statusDesc'),
    securityActionBtn: document.getElementById('securityActionBtn'),
    
    // Admin Console (replaces old content)
    adminConsole: document.getElementById('adminConsole'),
    userRoleBadge: document.getElementById('userRoleBadge'),
    userAvatarConsole: document.getElementById('userAvatarConsole'),
    
    // Stats
    statUsers: document.getElementById('statUsers'),
    statProjects: document.getElementById('statProjects'),
    statPending: document.getElementById('statPending'),
    requestsBadge: document.getElementById('requestsBadge'),
    
    // Console Navigation
    consoleTabs: document.querySelectorAll('.console-nav__tab'),
    consoleSections: document.querySelectorAll('.console-section'),
    
    // Tables
    usersTableBody: document.getElementById('usersTableBody'),
    projectsTableBody: document.getElementById('projectsTableBody'),
    requestsTableBody: document.getElementById('requestsTableBody'),
    
    // Search inputs
    userSearch: document.getElementById('userSearch'),
    projectSearch: document.getElementById('projectSearch'),
    
    // Create Project button
    createProjectBtn: document.getElementById('createProjectBtn'),
    
    // Edit User Modal
    editUserModal: document.getElementById('editUserModal'),
    editUserForm: document.getElementById('editUserForm'),
    editUserId: document.getElementById('editUserId'),
    editUserNickname: document.getElementById('editUserNickname'),
    editUserMcNickname: document.getElementById('editUserMcNickname'),
    editUserRole: document.getElementById('editUserRole'),
    
    // Notification Form
    sendNotificationForm: document.getElementById('sendNotificationForm'),
    notifTarget: document.getElementById('notifTarget'),
    notifUsersGroup: document.getElementById('notifUsersGroup'),
    notifUserSelect: document.getElementById('notifUserSelect'),
    notifUserChips: document.getElementById('notifUserChips'),
    addNotifUserBtn: document.getElementById('addNotifUserBtn'),
    notifType: document.getElementById('notifType'),
    notifTitle: document.getElementById('notifTitle'),
    notifMessage: document.getElementById('notifMessage'),
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════════════════

  let users = [];
  let projects = [];
  let nicknameRequests = [];
  let currentUser = null;
  let selectedNotifUsers = []; // For notification recipients
  let editingProject = null;

  // Category labels
  const CATEGORY_LABELS = {
    building: 'Building',
    station: 'Station',
    line_section: 'Line Section',
    line: 'Line',
  };

  const STATUS_LABELS = {
    active: 'Active',
    planning: 'Planning',
    completed: 'Completed',
    paused: 'Paused',
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // ACCESS CONTROL (Client hints - real enforcement is server-side)
  // ═══════════════════════════════════════════════════════════════════════════

  function hasAdminAccess() {
    if (!currentUser) return false;
    return currentUser.role === 'mod' || currentUser.role === 'admin';
  }

  function isAdmin() {
    return currentUser?.role === 'admin';
  }

  function isMod() {
    return currentUser?.role === 'mod' || currentUser?.role === 'admin';
  }

  /**
   * Update Security Gate to show access denied with specific reason
   * @param {string} reason - 'not-logged-in' | 'insufficient-role' | 'error'
   */
  function showAccessDenied(reason = 'not-logged-in') {
    if (elements.securityGate) elements.securityGate.style.display = 'flex';
    if (elements.adminConsole) elements.adminConsole.style.display = 'none';
    
    // Get requirement indicators
    const authReq = document.querySelector('[data-check="auth"]');
    const roleReq = document.querySelector('[data-check="role"]');
    
    // Reset requirement icons
    const resetReq = (el, status) => {
      if (!el) return;
      const icon = el.querySelector('.requirement-icon');
      if (!icon) return;
      icon.className = `requirement-icon requirement-icon--${status}`;
      icon.innerHTML = status === 'success' 
        ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>`
        : status === 'failed'
        ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>`
        : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>`;
    };
    
    // Update status icon
    const statusIcon = elements.securityStatus?.querySelector('.security-card__status-icon');
    
    switch (reason) {
      case 'not-logged-in':
        resetReq(authReq, 'failed');
        resetReq(roleReq, 'pending');
        if (elements.statusTitle) elements.statusTitle.textContent = 'Authentication Required';
        if (elements.statusDesc) elements.statusDesc.textContent = 'Please sign in to verify access permissions';
        if (statusIcon) {
          statusIcon.className = 'security-card__status-icon security-card__status-icon--denied';
          statusIcon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
        }
        if (elements.securityActionBtn) {
          elements.securityActionBtn.dataset.action = 'open-login';
          elements.securityActionBtn.querySelector('span').textContent = 'Authenticate';
          elements.securityActionBtn.onclick = () => {
            if (window.PrismUI?.openModal) window.PrismUI.openModal('loginModal');
          };
        }
        break;
        
      case 'insufficient-role':
        const userRole = currentUser?.role || 'user';
        resetReq(authReq, 'success');
        resetReq(roleReq, 'failed');
        if (elements.statusTitle) elements.statusTitle.textContent = 'Access Denied';
        if (elements.statusDesc) elements.statusDesc.textContent = `Your role "${userRole}" lacks required permissions`;
        if (statusIcon) {
          statusIcon.className = 'security-card__status-icon security-card__status-icon--denied';
          statusIcon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
        }
        if (elements.securityActionBtn) {
          elements.securityActionBtn.dataset.action = '';
          elements.securityActionBtn.querySelector('span').textContent = 'Request Access';
          elements.securityActionBtn.onclick = () => {
            showToast('Info', 'Contact a server administrator to request elevated permissions.');
          };
        }
        break;
        
      case 'error':
        resetReq(authReq, 'pending');
        resetReq(roleReq, 'pending');
        if (elements.statusTitle) elements.statusTitle.textContent = 'Verification Failed';
        if (elements.statusDesc) elements.statusDesc.textContent = 'Unable to verify access permissions';
        if (statusIcon) {
          statusIcon.className = 'security-card__status-icon security-card__status-icon--denied';
          statusIcon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
        }
        if (elements.securityActionBtn) {
          elements.securityActionBtn.dataset.action = '';
          elements.securityActionBtn.querySelector('span').textContent = 'Retry';
          elements.securityActionBtn.onclick = () => window.location.reload();
        }
        break;
    }
  }

  function showAdminContent() {
    if (elements.securityGate) elements.securityGate.style.display = 'none';
    if (elements.adminConsole) elements.adminConsole.style.display = 'block';
    
    // Update user role badge in console header
    if (elements.userRoleBadge && currentUser) {
      const role = currentUser.role || 'user';
      const roleText = elements.userRoleBadge.querySelector('.role-text');
      if (roleText) roleText.textContent = role.charAt(0).toUpperCase() + role.slice(1);
      if (role === 'admin') {
        elements.userRoleBadge.classList.add('console-header__role--admin');
      }
    }
    
    // Update avatar
    if (elements.userAvatarConsole && currentUser) {
      const initials = (currentUser.nickname || currentUser.email || 'U').slice(0, 2).toUpperCase();
      elements.userAvatarConsole.textContent = initials;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DATA LOADING (FROM JSONBIN via proxy - read only)
  // ═══════════════════════════════════════════════════════════════════════════

  async function loadAllData() {
    try {
      showLoading(true);
      console.log('[Admin] Loading all data...');
      
      const [usersData, projectsData, nicknameData] = await Promise.all([
        PrismBin.getUsers(true),
        PrismBin.getProjects(true),
        PrismBin.getNicknameRequests(true),
      ]);
      
      users = usersData || [];
      projects = projectsData || [];
      nicknameRequests = nicknameData || [];
      
      console.log('[Admin] Loaded:', {
        users: users.length,
        projects: projects.length,
        nicknameRequests: nicknameRequests.length,
      });
      
      updateStats();
      renderUsers();
      renderProjects();
      renderNicknameRequests();
      populateUserSelect();
      
    } catch (error) {
      console.error('[Admin] Failed to load data:', error);
      showToast('Error', 'Failed to load data', 'error');
    } finally {
      showLoading(false);
    }
  }

  function showLoading(show) {
    const loading = document.getElementById('adminLoading');
    if (loading) loading.style.display = show ? 'flex' : 'none';
  }

  function updateStats() {
    if (elements.statUsers) elements.statUsers.textContent = users.length;
    if (elements.statProjects) elements.statProjects.textContent = projects.length;
    
    const pendingCount = nicknameRequests.filter(r => r.status === 'pending').length;
    if (elements.statPending) elements.statPending.textContent = pendingCount;
    
    // Update badge on requests tab
    if (elements.requestsBadge) {
      if (pendingCount > 0) {
        elements.requestsBadge.textContent = pendingCount;
        elements.requestsBadge.style.display = 'flex';
      } else {
        elements.requestsBadge.style.display = 'none';
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // USERS TABLE
  // ═══════════════════════════════════════════════════════════════════════════

  function renderUsers() {
    if (!elements.usersTableBody) return;
    
    const searchTerm = elements.userSearch?.value?.toLowerCase() || '';
    
    let filtered = users;
    if (searchTerm) {
      filtered = users.filter(u => 
        (u.nickname || '').toLowerCase().includes(searchTerm) ||
        (u.email || '').toLowerCase().includes(searchTerm) ||
        (u.mcNickname || '').toLowerCase().includes(searchTerm)
      );
    }
    
    if (filtered.length === 0) {
      elements.usersTableBody.innerHTML = `
        <tr>
          <td colspan="6">
            <div class="empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"/>
                <path d="M21 21l-4.35-4.35"/>
              </svg>
              <span class="empty-state__text">No users found</span>
            </div>
          </td>
        </tr>`;
      return;
    }
    
    filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    elements.usersTableBody.innerHTML = filtered.map(user => {
      const initials = (user.nickname || user.email || 'U').slice(0, 2).toUpperCase();
      const role = user.role || 'user';
      const createdAt = user.createdAt ? formatDate(user.createdAt) : 'Unknown';
      
      const canEdit = isAdmin() || (isMod() && role === 'user');
      const canDelete = isAdmin() && user.id !== currentUser.id;
      
      return `
        <tr data-user-id="${user.id}">
          <td>
            <div class="user-cell">
              <div class="user-cell__avatar">${initials}</div>
              <span class="user-cell__name">${escapeHtml(user.nickname || 'No name')}</span>
              ${user.id === currentUser?.id ? '<span style="color:var(--admin-accent);font-size:12px;margin-left:6px">(You)</span>' : ''}
            </div>
          </td>
          <td>${escapeHtml(user.email || '-')}</td>
          <td>${escapeHtml(user.mcNickname || '-')}</td>
          <td><span class="role-badge role-badge--${role}">${role.charAt(0).toUpperCase() + role.slice(1)}</span></td>
          <td>${createdAt}</td>
          <td>
            <div class="action-buttons">
              ${canEdit ? `
                <button class="action-btn" title="Edit User" data-action="edit-user" data-id="${user.id}">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
                  </svg>
                </button>
              ` : ''}
              ${canDelete ? `
                <button class="action-btn action-btn--reject" title="Delete User" data-action="delete-user" data-id="${user.id}">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                  </svg>
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EDIT USER MODAL
  // ═══════════════════════════════════════════════════════════════════════════

  function openEditUserModal(userId) {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    
    if (elements.editUserId) elements.editUserId.value = user.id;
    if (elements.editUserNickname) elements.editUserNickname.value = user.nickname || '';
    if (elements.editUserMcNickname) elements.editUserMcNickname.value = user.mcNickname || '';
    
    if (elements.editUserRole) {
      elements.editUserRole.value = user.role || 'user';
      
      const options = elements.editUserRole.querySelectorAll('option');
      options.forEach(opt => {
        const roleValue = opt.value;
        if (roleValue === 'admin' || roleValue === 'mod') {
          opt.disabled = !isAdmin();
        } else {
          opt.disabled = false;
        }
      });
    }
    
    elements.editUserModal?.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeEditUserModal() {
    elements.editUserModal?.classList.remove('open');
    document.body.style.overflow = '';
  }

  async function handleEditUserSubmit(e) {
    e.preventDefault();
    
    const userId = elements.editUserId?.value;
    const nickname = elements.editUserNickname?.value?.trim();
    const mcNickname = elements.editUserMcNickname?.value?.trim();
    const newRole = elements.editUserRole?.value;
    
    if (!userId) return;
    
    const targetUser = users.find(u => u.id === userId);
    if (!targetUser) {
      showToast('Error', 'User not found', 'error');
      return;
    }
    
    const oldRole = targetUser.role || 'user';
    const roleChanged = oldRole !== newRole;
    
    try {
      const submitBtn = elements.editUserForm?.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving...';
      }
      
      // Update non-role fields via secure admin API
      await PrismAdmin.updateUser(userId, { nickname, mcNickname });
      
      // If role changed, update via secure role endpoint
      if (roleChanged) {
        await PrismAdmin.updateUserRole(userId, newRole);
      }
      
      showToast('Success', 'User updated successfully', 'success');
      closeEditUserModal();
      await loadAllData();
      
    } catch (error) {
      console.error('[Admin] Failed to update user:', error);
      showToast('Error', error.message || 'Failed to update user', 'error');
    } finally {
      const submitBtn = elements.editUserForm?.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save Changes';
      }
    }
  }

  async function handleDeleteUser(userId) {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    
    if (user.id === currentUser.id) {
      showToast('Error', 'You cannot delete yourself', 'error');
      return;
    }
    
    const confirmed = await PrismUI.showConfirm(
      'Delete User',
      `Are you sure you want to delete "${user.nickname || user.email}"? This will also delete all their projects. This cannot be undone.`,
      { confirmText: 'Delete', danger: true }
    );
    
    if (!confirmed) return;
    
    try {
      await PrismAdmin.deleteUser(userId);
      showToast('Success', 'User deleted', 'success');
      await loadAllData();
    } catch (error) {
      console.error('[Admin] Failed to delete user:', error);
      showToast('Error', error.message || 'Failed to delete user', 'error');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PROJECTS TABLE
  // ═══════════════════════════════════════════════════════════════════════════

  function renderProjects() {
    if (!elements.projectsTableBody) return;
    
    const searchTerm = elements.projectSearch?.value?.toLowerCase() || '';
    
    let filtered = projects;
    if (searchTerm) {
      filtered = projects.filter(p => 
        p.name?.toLowerCase().includes(searchTerm) ||
        p.owner?.nickname?.toLowerCase().includes(searchTerm) ||
        p.category?.toLowerCase().includes(searchTerm)
      );
    }
    
    if (filtered.length === 0) {
      elements.projectsTableBody.innerHTML = `
        <tr>
          <td colspan="6">
            <div class="empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>
              <span class="empty-state__text">No projects found</span>
            </div>
          </td>
        </tr>`;
      return;
    }
    
    filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    elements.projectsTableBody.innerHTML = filtered.map(project => {
      const ownerName = project.owner?.nickname || 'Unknown';
      const ownerInitials = ownerName.slice(0, 2).toUpperCase();
      const categoryLabel = CATEGORY_LABELS[project.category] || project.category || '-';
      const status = project.status || 'active';
      const memberCount = 1 + (project.coowners?.length || 0) + (project.members?.length || 0);
      
      return `
        <tr data-project-id="${project.id}">
          <td>
            <span style="font-weight:600;color:var(--color-text)">${escapeHtml(project.name)}</span>
          </td>
          <td>
            <div class="user-cell">
              <div class="user-cell__avatar">${ownerInitials}</div>
              <span class="user-cell__name">${escapeHtml(ownerName)}</span>
            </div>
          </td>
          <td><span class="category-badge">${categoryLabel}</span></td>
          <td><span class="status-badge status-badge--${status}">${STATUS_LABELS[status] || 'Active'}</span></td>
          <td>${memberCount}</td>
          <td>
            <div class="action-buttons">
              <button class="action-btn" title="Edit Project" data-action="edit-project" data-id="${project.id}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
                </svg>
              </button>
              <button class="action-btn action-btn--reject" title="Delete Project" data-action="delete-project" data-id="${project.id}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EDIT PROJECT (uses unified projectModal)
  // ═══════════════════════════════════════════════════════════════════════════

  function openEditProjectModal(projectId) {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    
    editingProject = project;
    
    // Set modal title for edit mode
    document.getElementById('projectModalTitle').textContent = 'Edit Project';
    document.getElementById('projectModalSubtitle').textContent = 'Update project details and team';
    document.getElementById('projectSubmitBtn').textContent = 'Save Changes';
    
    // Populate fields
    document.getElementById('projectId').value = project.id;
    document.getElementById('projectName').value = project.name || '';
    document.getElementById('projectDescription').value = project.description || '';
    document.getElementById('projectCategory').value = project.category || '';
    document.getElementById('projectStatus').value = project.status || 'active';
    
    // Populate owner dropdown
    const ownerSelect = document.getElementById('projectOwner');
    if (ownerSelect) {
      ownerSelect.innerHTML = users.map(u => 
        `<option value="${u.id}" ${u.id === project.owner?.id ? 'selected' : ''}>${escapeHtml(u.nickname || u.email)}</option>`
      ).join('');
      ownerSelect.disabled = !isAdmin();
    }
    
    renderProjectMembers(project);
    populateAddMemberDropdown();
    
    document.getElementById('projectModal')?.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function populateAddMemberDropdown() {
    const select = document.getElementById('addMemberSelect');
    if (!select) return;
    
    // Get IDs of users already in project (if editing)
    const existingIds = new Set();
    if (editingProject) {
      existingIds.add(editingProject.owner?.id);
      (editingProject.coowners || []).forEach(c => existingIds.add(c.id));
      (editingProject.members || []).forEach(m => existingIds.add(m.id));
    }
    
    // Filter to users not already in project
    const availableUsers = users.filter(u => !existingIds.has(u.id));
    
    select.innerHTML = availableUsers.length === 0
      ? '<option value="">No users available</option>'
      : `<option value="">Select user...</option>` + availableUsers.map(u => `<option value="${u.id}">${escapeHtml(u.nickname || u.email)}</option>`).join('');
  }

  function renderProjectMembers(project) {
    const teamList = document.getElementById('teamList');
    if (!teamList) return;
    
    const allMembers = [
      ...(project.coowners || []).map(c => ({ ...c, role: 'coowner' })),
      ...(project.members || []).map(m => ({ ...m, role: 'member' })),
    ];
    
    if (allMembers.length === 0) {
      teamList.innerHTML = `
        <div class="team-list__empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <line x1="19" y1="8" x2="19" y2="14"/>
            <line x1="22" y1="11" x2="16" y2="11"/>
          </svg>
          <span>No team members yet</span>
        </div>`;
      return;
    }
    
    teamList.innerHTML = allMembers.map(member => {
      const initials = (member.nickname || 'U').charAt(0).toUpperCase();
      const roleBadge = member.role === 'coowner' ? 'Co-owner' : 'Member';
      return `
        <div class="team-member" data-id="${member.id}">
          <div class="team-member__info">
            <div class="team-member__avatar">${initials}</div>
            <span class="team-member__name">${escapeHtml(member.nickname || 'Unknown')}</span>
          </div>
          <button class="team-member__remove" data-action="remove-member" data-user-id="${member.id}" title="Remove member">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      `;
    }).join('');
  }

  function closeEditProjectModal() {
    closeProjectModal();
  }

  // handleEditProjectSubmit is now handled by handleCreateProjectSubmit (unified)

  async function handleDeleteProject(projectId) {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    
    const confirmed = await PrismUI.showConfirm(
      'Delete Project',
      `Are you sure you want to delete "${project.name}"? This cannot be undone.`,
      { confirmText: 'Delete', danger: true }
    );
    if (!confirmed) return;
    
    try {
      await PrismAdmin.deleteProject(projectId);
      showToast('Success', 'Project deleted', 'success');
      closeEditProjectModal();
      await loadAllData();
    } catch (error) {
      console.error('[Admin] Failed to delete project:', error);
      showToast('Error', error.message || 'Failed to delete project', 'error');
    }
  }

  async function handleAddMember() {
    if (!editingProject) return;
    
    const selector = document.getElementById('addMemberSelect');
    const userId = selector?.value;
    if (!userId) {
      showToast('Info', 'Select a user to add', 'info');
      return;
    }
    
    const role = 'member'; // Default role for new members
    
    try {
      await PrismAdmin.addProjectMember(editingProject.id, userId, role);
      showToast('Success', 'Member added', 'success');
      
      await loadAllData();
      const updatedProject = projects.find(p => p.id === editingProject.id);
      if (updatedProject) {
        editingProject = updatedProject;
        renderProjectMembers(updatedProject);
        populateAddMemberDropdown();
      }
    } catch (error) {
      showToast('Error', error.message || 'Failed to add member', 'error');
    }
  }

  async function handleRemoveMember(userId) {
    if (!editingProject) return;
    
    try {
      await PrismAdmin.removeProjectMember(editingProject.id, userId);
      showToast('Success', 'Member removed', 'success');
      
      await loadAllData();
      const updatedProject = projects.find(p => p.id === editingProject.id);
      if (updatedProject) {
        editingProject = updatedProject;
        renderProjectMembers(updatedProject);
        populateAddMemberDropdown();
      }
    } catch (error) {
      showToast('Error', error.message || 'Failed to remove member', 'error');
    }
  }

  async function handleChangeMemberRole(userId, newRole) {
    if (!editingProject) return;
    
    try {
      await PrismAdmin.changeProjectMemberRole(editingProject.id, userId, newRole);
      showToast('Success', 'Member role updated', 'success');
      
      await loadAllData();
      const updatedProject = projects.find(p => p.id === editingProject.id);
      if (updatedProject) {
        editingProject = updatedProject;
        renderProjectMembers(updatedProject);
      }
    } catch (error) {
      showToast('Error', error.message || 'Failed to change role', 'error');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PROJECT MODAL (Unified for create/edit)
  // ═══════════════════════════════════════════════════════════════════════════

  function openCreateProjectModal() {
    editingProject = null;
    
    // Reset form
    document.getElementById('projectForm')?.reset();
    document.getElementById('projectId').value = '';
    
    // Set modal title for create mode
    document.getElementById('projectModalTitle').textContent = 'Create Project';
    document.getElementById('projectModalSubtitle').textContent = 'Define a new community project';
    document.getElementById('projectSubmitBtn').textContent = 'Create Project';
    
    // Populate owner dropdown
    const ownerSelect = document.getElementById('projectOwner');
    if (ownerSelect) {
      ownerSelect.innerHTML = users.map(u => 
        `<option value="${u.id}" ${u.id === currentUser?.id ? 'selected' : ''}>${escapeHtml(u.nickname || u.email)}</option>`
      ).join('');
    }
    
    // Clear team list
    document.getElementById('teamList').innerHTML = `
      <div class="team-list__empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <line x1="19" y1="8" x2="19" y2="14"/>
          <line x1="22" y1="11" x2="16" y2="11"/>
        </svg>
        <span>No team members yet</span>
      </div>`;
    
    // Populate add member dropdown
    populateAddMemberDropdown();
    
    document.getElementById('projectModal')?.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeProjectModal() {
    document.getElementById('projectModal')?.classList.remove('open');
    document.body.style.overflow = '';
    document.getElementById('projectForm')?.reset();
    editingProject = null;
  }

  async function handleCreateProjectSubmit(e) {
    e.preventDefault();
    
    const name = document.getElementById('projectName')?.value?.trim();
    const description = document.getElementById('projectDescription')?.value?.trim();
    const category = document.getElementById('projectCategory')?.value;
    const status = document.getElementById('projectStatus')?.value || 'planning';
    const ownerId = document.getElementById('projectOwner')?.value;
    
    if (!name || !category) {
      showToast('Error', 'Name and category are required', 'error');
      return;
    }
    
    const owner = users.find(u => u.id === ownerId) || currentUser;
    const projectId = document.getElementById('projectId')?.value;
    const isEditing = !!projectId;
    
    try {
      const submitBtn = document.getElementById('projectSubmitBtn');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = isEditing ? 'Saving...' : 'Creating...';
      }
      
      if (isEditing) {
        await PrismAdmin.updateProject(projectId, {
          name, description, category, status,
          owner: { id: owner.id, nickname: owner.nickname || owner.email },
          members: editingProject?.members || [],
          coowners: editingProject?.coowners || [],
        });
        showToast('Success', 'Project updated', 'success');
      } else {
        await PrismAdmin.createProject({
          name, description, category, status,
          owner: { id: owner.id, nickname: owner.nickname || owner.email },
        });
        showToast('Success', 'Project created', 'success');
      }
      
      closeProjectModal();
      await loadAllData();
      
    } catch (error) {
      console.error('[Admin] Failed to save project:', error);
      showToast('Error', error.message || 'Failed to save project', 'error');
    } finally {
      const submitBtn = document.getElementById('projectSubmitBtn');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = isEditing ? 'Save Changes' : 'Create Project';
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // NICKNAME REQUESTS TABLE
  // ═══════════════════════════════════════════════════════════════════════════

  function renderNicknameRequests() {
    if (!elements.requestsTableBody) return;
    
    const sorted = [...nicknameRequests].sort((a, b) => {
      if (a.status === 'pending' && b.status !== 'pending') return -1;
      if (a.status !== 'pending' && b.status === 'pending') return 1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
    
    if (sorted.length === 0) {
      elements.requestsTableBody.innerHTML = `
        <tr>
          <td colspan="6">
            <div class="empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
              <span class="empty-state__text">No nickname requests</span>
            </div>
          </td>
        </tr>`;
      return;
    }
    
    elements.requestsTableBody.innerHTML = sorted.map(request => {
      const user = users.find(u => u.id === request.userId);
      const userName = user?.nickname || user?.email || 'Unknown User';
      const userInitials = userName.slice(0, 2).toUpperCase();
      const currentNickname = user?.mcNickname || '-';
      const createdAt = request.createdAt ? formatDate(request.createdAt) : 'Unknown';
      const isPending = request.status === 'pending';
      
      return `
        <tr data-request-id="${request.id}">
          <td>
            <div class="user-cell">
              <div class="user-cell__avatar">${userInitials}</div>
              <span class="user-cell__name">${escapeHtml(userName)}</span>
            </div>
          </td>
          <td><code style="background:var(--color-border);padding:4px 8px;border-radius:4px;font-family:var(--font-mono)">${escapeHtml(request.nickname)}</code></td>
          <td>${escapeHtml(currentNickname)}</td>
          <td><span class="status-badge status-badge--${request.status}">${request.status.charAt(0).toUpperCase() + request.status.slice(1)}</span></td>
          <td>${createdAt}</td>
          <td>
            <div class="action-buttons">
              ${isPending ? `
                <button class="action-btn action-btn--approve" title="Approve" data-action="approve-nickname" data-id="${request.id}">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </button>
                <button class="action-btn action-btn--reject" title="Reject" data-action="reject-nickname" data-id="${request.id}">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  async function handleNicknameAction(requestId, status) {
    try {
      const request = nicknameRequests.find(r => r.id === requestId);
      if (!request) return;
      
      await PrismBin.reviewNicknameRequest(requestId, status, currentUser.id);
      
      if (status === 'approved') {
        await PrismAdmin.updateUser(request.userId, { mcNickname: request.nickname });
        
        await PrismBin.createNotification(
          request.userId, 'success', 'Nickname Approved',
          `Your Minecraft nickname "${request.nickname}" has been approved!`
        );
      } else {
        await PrismBin.createNotification(
          request.userId, 'error', 'Nickname Rejected',
          `Your Minecraft nickname request "${request.nickname}" was rejected.`
        );
      }
      
      showToast('Success', `Nickname request ${status}`, 'success');
      await loadAllData();
      
    } catch (error) {
      console.error('[Admin] Failed to process nickname request:', error);
      showToast('Error', error.message || 'Failed to process request', 'error');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SEND NOTIFICATION - Admin can send notifications to users
  // ═══════════════════════════════════════════════════════════════════════════

  function populateUserSelect() {
    if (!elements.notifUserSelect) return;
    
    // Clear existing options (keep first placeholder)
    elements.notifUserSelect.innerHTML = '<option value="">Add a user...</option>';
    
    // Add all users (exclude already selected)
    users.forEach(user => {
      if (!selectedNotifUsers.find(u => u.id === user.id)) {
        const option = document.createElement('option');
        option.value = user.id;
        option.textContent = `${user.nickname || user.email} (${user.role || 'user'})`;
        elements.notifUserSelect.appendChild(option);
      }
    });
  }

  function renderNotifUserChips() {
    if (!elements.notifUserChips) return;
    
    if (selectedNotifUsers.length === 0) {
      elements.notifUserChips.innerHTML = '<span class="team-chips__empty">No users selected</span>';
      return;
    }
    
    elements.notifUserChips.innerHTML = selectedNotifUsers.map(user => `
      <span class="team-chip">
        <span class="team-chip__name">${escapeHtml(user.nickname || user.email)}</span>
        <button type="button" class="team-chip__remove" data-user-id="${user.id}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </span>
    `).join('');
  }

  function addNotifUser() {
    const userId = elements.notifUserSelect?.value;
    if (!userId) return;
    
    const user = users.find(u => u.id === userId);
    if (!user || selectedNotifUsers.find(u => u.id === userId)) return;
    
    selectedNotifUsers.push(user);
    renderNotifUserChips();
    populateUserSelect();
    elements.notifUserSelect.value = '';
  }

  function removeNotifUser(userId) {
    selectedNotifUsers = selectedNotifUsers.filter(u => u.id !== userId);
    renderNotifUserChips();
    populateUserSelect();
  }

  function handleTargetChange() {
    const target = elements.notifTarget?.value;
    if (elements.notifUsersGroup) {
      elements.notifUsersGroup.style.display = target === 'specific' ? 'block' : 'none';
    }
  }

  async function handleSendNotification(e) {
    e.preventDefault();
    
    const target = elements.notifTarget?.value || 'all';
    const type = elements.notifType?.value;
    const title = elements.notifTitle?.value?.trim();
    const message = elements.notifMessage?.value?.trim();
    
    if (!type || !title || !message) {
      showToast('Error', 'Please fill in all fields', 'error');
      return;
    }
    
    // Validate recipients for specific target
    if (target === 'specific' && selectedNotifUsers.length === 0) {
      showToast('Error', 'Please select at least one recipient', 'error');
      return;
    }
    
    try {
      const submitBtn = elements.sendNotificationForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span>Sending...</span>';
      
      if (target === 'all') {
        // Broadcast to all users
        await PrismBin.broadcastNotification(type, title, message);
        showToast('Success', 'Notification sent to all users!', 'success');
      } else {
        // Send to specific users
        const userIds = selectedNotifUsers.map(u => u.id);
        await PrismBin.broadcastNotification(type, title, message, userIds);
        showToast('Success', `Notification sent to ${userIds.length} user(s)!`, 'success');
      }
      
      // Reset form
      elements.sendNotificationForm.reset();
      selectedNotifUsers = [];
      renderNotifUserChips();
      populateUserSelect();
      handleTargetChange();
      
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
      
    } catch (error) {
      console.error('[Admin] Failed to send notification:', error);
      showToast('Error', error.message || 'Failed to send notification', 'error');
      
      const submitBtn = elements.sendNotificationForm.querySelector('button[type="submit"]');
      submitBtn.disabled = false;
      submitBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 2L11 13"/>
          <path d="M22 2L15 22L11 13L2 9L22 2Z"/>
        </svg>
        <span>Send Notification</span>
      `;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TAB SWITCHING - Console Navigation
  // ═══════════════════════════════════════════════════════════════════════════

  function switchTab(tabName) {
    // Update tab buttons
    elements.consoleTabs.forEach(tab => {
      tab.classList.toggle('active', tab.dataset.section === tabName);
    });
    // Update content sections
    elements.consoleSections.forEach(section => {
      section.classList.toggle('active', section.dataset.section === tabName);
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UTILITIES
  // ═══════════════════════════════════════════════════════════════════════════

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }

  function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  }

  function debounce(func, wait) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  }

  function showToast(title, message, type = 'info') {
    if (window.PrismUI?.showToast) {
      window.PrismUI.showToast(title, message, type);
    } else {
      console.log(`[${type.toUpperCase()}] ${title}: ${message}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EVENT LISTENERS
  // ═══════════════════════════════════════════════════════════════════════════

  function setupEventListeners() {
    // Console navigation tabs
    elements.consoleTabs.forEach(tab => {
      tab.addEventListener('click', () => switchTab(tab.dataset.section));
    });
    
    // Search inputs
    elements.userSearch?.addEventListener('input', debounce(renderUsers, 300));
    elements.projectSearch?.addEventListener('input', debounce(renderProjects, 300));
    
    // Forms
    elements.editUserForm?.addEventListener('submit', handleEditUserSubmit);
    document.getElementById('projectForm')?.addEventListener('submit', handleCreateProjectSubmit);
    elements.sendNotificationForm?.addEventListener('submit', handleSendNotification);
    
    // Notification form - target change
    elements.notifTarget?.addEventListener('change', handleTargetChange);
    elements.addNotifUserBtn?.addEventListener('click', addNotifUser);
    
    // Notification user chips - delegated remove
    elements.notifUserChips?.addEventListener('click', (e) => {
      const removeBtn = e.target.closest('.team-chip__remove');
      if (removeBtn) {
        removeNotifUser(removeBtn.dataset.userId);
      }
    });
    
    // Create project button
    elements.createProjectBtn?.addEventListener('click', openCreateProjectModal);
    
    // Add member button
    document.getElementById('addMemberBtn')?.addEventListener('click', handleAddMember);
    
    // Delegated click handlers
    document.addEventListener('click', (e) => {
      const actionEl = e.target.closest('[data-action]');
      const action = actionEl?.dataset?.action;
      const id = actionEl?.dataset?.id || actionEl?.dataset?.userId;
      
      if (!action) return;
      
      switch (action) {
        case 'close-modal': closeProjectModal(); closeEditUserModal(); break;
        case 'close-user-modal': closeEditUserModal(); break;
        case 'close-project-modal': closeEditProjectModal(); break;
        case 'close-create-project-modal': closeCreateProjectModal(); break;
        case 'edit-user': if (id) openEditUserModal(id); break;
        case 'delete-user': if (id) handleDeleteUser(id); break;
        case 'edit-project': if (id) openEditProjectModal(id); break;
        case 'delete-project': if (id) handleDeleteProject(id); break;
        case 'create-project': openCreateProjectModal(); break;
        case 'approve-nickname': if (id) handleNicknameAction(id, 'approved'); break;
        case 'reject-nickname': if (id) handleNicknameAction(id, 'rejected'); break;
        case 'remove-member': if (id) handleRemoveMember(id); break;
      }
    });
    
    document.addEventListener('change', (e) => {
      if (e.target.dataset?.action === 'change-member-role') {
        const userId = e.target.dataset.userId;
        const newRole = e.target.value;
        if (userId && newRole) handleChangeMemberRole(userId, newRole);
      }
    });
    
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeEditUserModal();
        closeEditProjectModal();
        closeCreateProjectModal();
      }
    });
    
    window.addEventListener('prism:auth:changed', async (e) => {
      currentUser = e.detail?.user || PrismAuth?.getUser?.();
      await initAdminPanel();
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════════

  async function initAdminPanel() {
    console.log('[Admin] Initializing admin panel...');
    
    currentUser = PrismAuth?.getUser?.() || PrismAuth?.currentUser;
    
    // Check if user is logged in
    if (!currentUser) {
      console.log('[Admin] Access denied - user not logged in');
      showAccessDenied('not-logged-in');
      return;
    }
    
    // Check if user has sufficient permissions
    if (!hasAdminAccess()) {
      console.log('[Admin] Access denied - insufficient role:', currentUser.role);
      showAccessDenied('insufficient-role');
      return;
    }
    
    console.log('[Admin] Access granted:', currentUser.role);
    showAdminContent();
    await loadAllData();
  }

  function init() {
    if (document.body.dataset.page !== 'admin') return;
    
    setupEventListeners();
    
    if (typeof PrismAuth !== 'undefined' && (PrismAuth.getUser?.() || PrismAuth.currentUser)) {
      initAdminPanel();
    } else {
      window.addEventListener('prism:auth:ready', initAdminPanel);
      setTimeout(initAdminPanel, 1500);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
