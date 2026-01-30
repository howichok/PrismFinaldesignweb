/**
 * PrismMTR Company Hub - JavaScript
 * 
 * Handles:
 * - Company page loading and display
 * - Tab navigation
 * - Projects/Posts/Members display
 * - Settings management (owner/admin only)
 */

(function() {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════════════════

  let currentUser = null;
  let currentCompany = null;
  let userRole = null;
  let currentTab = 'overview';

  // ═══════════════════════════════════════════════════════════════════════════
  // UTILITIES
  // ═══════════════════════════════════════════════════════════════════════════

  function showToast(title, message, type = 'info') {
    if (window.showToast) {
      window.showToast(title, message, type);
    } else {
      console.log(`[Toast] ${title}: ${message}`);
    }
  }

  function formatDate(dateStr) {
    if (!dateStr) return 'Unknown';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
  }

  function getInitials(name) {
    if (!name) return '?';
    return name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPANY LOADING
  // ═══════════════════════════════════════════════════════════════════════════

  async function loadCompany() {
    const urlParams = new URLSearchParams(window.location.search);
    const companyId = urlParams.get('id');
    const companySlug = urlParams.get('slug');

    if (!companyId && !companySlug) {
      showError('No company specified');
      return;
    }

    try {
      // Fetch company
      let company;
      if (companyId) {
        company = await PrismBin.getCompanyById(companyId);
      } else {
        company = await PrismBin.getCompanyBySlug(companySlug);
      }

      if (!company) {
        showError('Company not found');
        return;
      }

      currentCompany = company;
      console.log('[Company] Loaded company:', company.name, company.id);

      // Get user's role in this company
      if (currentUser) {
        userRole = await PrismBin.getUserCompanyRole(company.id, currentUser.id);
        console.log('[Company] User role:', userRole);
      }

      // Render company page
      renderCompanyHeader();
      renderCompanyTabs();
      await loadCompanyContent();
      renderSettingsMembers();

      // Initialize description counter
      const descInput = document.getElementById('settingCompanyDescription');
      const descCount = document.getElementById('descriptionCount');
      if (descInput && descCount) {
        descCount.textContent = descInput.value?.length || 0;
      }

      // Show content
      document.getElementById('companyLoading').style.display = 'none';
      document.getElementById('companyContent').style.display = 'block';

    } catch (error) {
      console.error('[Company] Failed to load company:', error);
      showError(error.message || 'Failed to load company');
    }
  }

  function showError(message) {
    document.getElementById('companyLoading').style.display = 'none';
    document.getElementById('companyError').style.display = 'block';
    document.getElementById('companyErrorMessage').textContent = message;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDERING
  // ═══════════════════════════════════════════════════════════════════════════

  function renderCompanyHeader() {
    const company = currentCompany;

    // Logo
    const logoEl = document.getElementById('companyLogo');
    if (company.logoUrl || company.logo_url) {
      logoEl.innerHTML = `<img src="${company.logoUrl || company.logo_url}" alt="${company.name}">`;
    }

    // Name
    document.getElementById('companyName').textContent = company.name;
    document.title = `${company.name} - PrismMTR`;

    // Categories
    const categoriesEl = document.getElementById('companyCategories');
    const categoryLabels = {
      metro: 'Metro / Transit',
      rail: 'Railway',
      city: 'City Building',
      infrastructure: 'Infrastructure',
      creative: 'Creative / Other'
    };

    const categories = company.categories || (company.category ? [company.category] : []);
    categoriesEl.innerHTML = categories.map(cat => 
      `<span class="company-category-badge">${categoryLabels[cat] || cat}</span>`
    ).join('');

    // Description
    document.getElementById('companyDescription').textContent = company.description || 'No description provided';

    // Owner
    const ownerName = company.owner?.nickname || company.owner?.email?.split('@')[0] || 'Unknown';
    document.getElementById('companyOwner').querySelector('span').textContent = `Owner: ${ownerName}`;

    // Member count
    const memberCount = (company.members?.length || 0) + 1; // +1 for owner
    document.getElementById('companyMemberCount').querySelector('span').textContent = `${memberCount} member${memberCount !== 1 ? 's' : ''}`;

    // Created date
    document.getElementById('companyCreatedAt').querySelector('span').textContent = `Created ${formatDate(company.createdAt || company.created_at)}`;

    // Actions
    renderCompanyActions();
  }

  function renderCompanyActions() {
    const actionsEl = document.getElementById('companyActions');
    let html = '';

    // If user is logged in
    if (currentUser) {
      if (userRole === 'owner' || userRole === 'admin') {
        // Show edit button for owner/admin
        html += `
          <button class="btn btn--ghost" onclick="goToTab('settings')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4"/>
            </svg>
            Settings
          </button>
        `;
      } else if (!userRole) {
        // Not a member - could add join request button here
      }
    }

    actionsEl.innerHTML = html;
  }

  function renderCompanyTabs() {
    // Show settings tab only for owner/admin
    const settingsTab = document.getElementById('settingsTab');
    if (settingsTab) {
      settingsTab.style.display = (userRole === 'owner' || userRole === 'admin') ? 'flex' : 'none';
    }
  }

  async function loadCompanyContent() {
    const company = currentCompany;

    // Load projects
    try {
      const allProjects = await PrismBin.getProjects();
      const companyProjects = allProjects.filter(p => 
        p.companyId === company.id || p.company_id === company.id || p.company?.id === company.id
      );
      
      document.getElementById('projectsCount').textContent = companyProjects.length;
      renderProjects(companyProjects);
    } catch (error) {
      console.error('[Company] Failed to load projects:', error);
    }

    // Load posts
    try {
      const allPosts = await PrismBin.getPosts();
      const companyPosts = allPosts.filter(p => 
        p.companyId === company.id || p.company_id === company.id || p.company?.id === company.id
      );
      
      document.getElementById('postsCount').textContent = companyPosts.length;
      renderPosts(companyPosts);
    } catch (error) {
      console.error('[Company] Failed to load posts:', error);
    }

    // Render members
    renderMembers();

    // Load settings if owner/admin
    if (userRole === 'owner' || userRole === 'admin') {
      document.getElementById('settingCompanyName').value = company.name || '';
      document.getElementById('settingCompanyDescription').value = company.description || '';
    }
  }

  function renderProjects(projects) {
    const recentEl = document.getElementById('recentProjects');
    const allEl = document.getElementById('allProjects');

    if (projects.length === 0) {
      const emptyHtml = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
          <h3>No Projects Yet</h3>
          <p>This company hasn't created any projects.</p>
        </div>
      `;
      recentEl.innerHTML = emptyHtml;
      allEl.innerHTML = emptyHtml;
      return;
    }

    const renderProject = (project) => `
      <div class="project-card" onclick="window.location.href='projects.html?id=${project.id}'">
        <div class="project-card__image">
          ${project.image || project.imageUrl || project.image_url 
            ? `<img src="${project.image || project.imageUrl || project.image_url}" alt="${project.name}">`
            : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`
          }
        </div>
        <div class="project-card__body">
          <span class="project-card__category">${project.category || 'Project'}</span>
          <h3 class="project-card__title">${project.name}</h3>
          <p class="project-card__desc">${project.description?.substring(0, 100) || 'No description'}${project.description?.length > 100 ? '...' : ''}</p>
        </div>
      </div>
    `;

    // Recent (max 3)
    recentEl.innerHTML = projects.slice(0, 3).map(renderProject).join('');

    // All projects
    allEl.innerHTML = projects.map(renderProject).join('');
  }

  function renderPosts(posts) {
    const recentEl = document.getElementById('recentPosts');
    const allEl = document.getElementById('allPosts');

    if (posts.length === 0) {
      const emptyHtml = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          <h3>No Posts Yet</h3>
          <p>This company hasn't published any posts.</p>
        </div>
      `;
      recentEl.innerHTML = emptyHtml;
      allEl.innerHTML = emptyHtml;
      return;
    }

    const renderPost = (post) => `
      <div class="post-card" onclick="window.location.href='posts.html?id=${post.id}'">
        <div class="post-card__header">
          <span class="post-card__category">${post.category || 'Post'}</span>
          <span class="post-card__date">${formatDate(post.createdAt || post.created_at)}</span>
        </div>
        <h3 class="post-card__title">${post.title}</h3>
        <p class="post-card__excerpt">${post.excerpt || post.content?.substring(0, 150) || 'No content'}${(post.content?.length || 0) > 150 ? '...' : ''}</p>
      </div>
    `;

    // Recent (max 3)
    recentEl.innerHTML = posts.slice(0, 3).map(renderPost).join('');

    // All posts
    allEl.innerHTML = posts.map(renderPost).join('');
  }

  function renderMembers() {
    const company = currentCompany;
    const members = [];

    // Add owner first
    if (company.owner) {
      members.push({
        ...company.owner,
        role: 'owner'
      });
    }

    // Add other members
    if (company.members && Array.isArray(company.members)) {
      company.members.forEach(m => {
        // Don't duplicate owner
        if (m.id !== company.owner?.id) {
          members.push(m);
        }
      });
    }

    document.getElementById('membersCount').textContent = members.length;

    const renderMember = (member) => {
      const name = member.nickname || member.email?.split('@')[0] || 'Unknown';
      const roleClass = member.role === 'owner' ? 'member-card__role--owner' : 
                       member.role === 'admin' ? 'member-card__role--admin' : '';
      
      return `
        <div class="member-card">
          <div class="member-card__avatar">
            ${member.avatar || member.avatar_url
              ? `<img src="${member.avatar || member.avatar_url}" alt="${name}">`
              : getInitials(name)
            }
          </div>
          <div class="member-card__info">
            <h4 class="member-card__name">${name}</h4>
            <span class="member-card__role ${roleClass}">${member.role || 'Member'}</span>
          </div>
        </div>
      `;
    };

    // Team preview (sidebar - max 5)
    const teamPreviewEl = document.getElementById('teamPreview');
    if (members.length === 0) {
      teamPreviewEl.innerHTML = '<div class="empty-state"><p>No members</p></div>';
    } else {
      teamPreviewEl.innerHTML = members.slice(0, 5).map(renderMember).join('');
      if (members.length > 5) {
        teamPreviewEl.innerHTML += `<p style="text-align: center; color: var(--text-muted); margin-top: 0.5rem;">+${members.length - 5} more</p>`;
      }
    }

    // All members
    const allMembersEl = document.getElementById('allMembers');
    if (members.length === 0) {
      allMembersEl.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
          </svg>
          <h3>No Members</h3>
          <p>This company has no members yet.</p>
        </div>
      `;
    } else {
      allMembersEl.innerHTML = members.map(renderMember).join('');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TAB NAVIGATION
  // ═══════════════════════════════════════════════════════════════════════════

  function goToTab(tabName) {
    currentTab = tabName;

    // Update tab buttons
    document.querySelectorAll('.company-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    // Update panels
    document.querySelectorAll('.company-panel').forEach(panel => {
      panel.classList.remove('active');
    });

    const panel = document.getElementById(`panel${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`);
    if (panel) {
      panel.classList.add('active');
    }
  }

  // Make it available globally
  window.goToTab = goToTab;

  // ═══════════════════════════════════════════════════════════════════════════
  // SETTINGS
  // ═══════════════════════════════════════════════════════════════════════════

  async function saveCompanySettings() {
    if (!currentCompany || !userRole || (userRole !== 'owner' && userRole !== 'admin')) {
      showToast('Error', 'You do not have permission to edit this company');
      return;
    }

    const name = document.getElementById('settingCompanyName').value.trim();
    const description = document.getElementById('settingCompanyDescription').value.trim();

    if (!name) {
      showToast('Error', 'Company name is required');
      return;
    }

    const saveBtn = document.getElementById('saveCompanySettings');
    const originalText = saveBtn.textContent;
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
      await PrismBin.updateCompany(currentCompany.id, {
        name,
        description
      });

      currentCompany.name = name;
      currentCompany.description = description;
      
      renderCompanyHeader();
      showToast('Success', 'Company settings saved');
    } catch (error) {
      console.error('[Company] Failed to save settings:', error);
      showToast('Error', error.message || 'Failed to save settings');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = originalText;
    }
  }

  async function deleteCompany() {
    if (!currentCompany || userRole !== 'owner') {
      showToast('Error', 'Only the owner can delete this company');
      return;
    }

    const confirmed = confirm(`Are you sure you want to delete "${currentCompany.name}"? This action cannot be undone.`);
    if (!confirmed) return;

    const doubleConfirmed = confirm('This will permanently delete the company and all associated data. Are you absolutely sure?');
    if (!doubleConfirmed) return;

    try {
      await PrismBin.deleteCompany(currentCompany.id);
      showToast('Success', 'Company deleted');
      window.location.href = 'dashboard.html';
    } catch (error) {
      console.error('[Company] Failed to delete company:', error);
      showToast('Error', error.message || 'Failed to delete company');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SETTINGS MEMBERS
  // ═══════════════════════════════════════════════════════════════════════════

  function renderSettingsMembers() {
    const listEl = document.getElementById('settingsMembersList');
    if (!listEl || !currentCompany) return;

    const members = [];
    
    // Add owner first
    if (currentCompany.owner) {
      members.push({ ...currentCompany.owner, role: 'owner' });
    }
    
    // Add other members
    if (currentCompany.members && Array.isArray(currentCompany.members)) {
      currentCompany.members.forEach(m => {
        if (m.id !== currentCompany.owner?.id) {
          members.push(m);
        }
      });
    }

    if (members.length === 0) {
      listEl.innerHTML = '<p class="text-muted text-center">No members</p>';
      return;
    }

    const roleLabels = { owner: 'Owner', coowner: 'Co-owner', trusted: 'Trusted', member: 'Member' };
    const canManage = userRole === 'owner' || userRole === 'coowner';

    listEl.innerHTML = members.map(member => {
      const name = member.nickname || member.email?.split('@')[0] || 'Unknown';
      const initials = name.slice(0, 2).toUpperCase();
      const isOwner = member.role === 'owner';

      return `
        <div class="settings-member-item">
          <div class="settings-member-item__avatar">
            ${member.avatar ? `<img src="${member.avatar}" alt="${name}">` : initials}
          </div>
          <div class="settings-member-item__info">
            <span class="settings-member-item__name">${escapeHtml(name)}</span>
            <span class="settings-member-item__role">${roleLabels[member.role] || 'Member'}</span>
          </div>
          ${canManage && !isOwner ? `
            <div class="settings-member-item__actions">
              <button class="btn btn--sm btn--ghost" onclick="editMemberRole('${member.id}')" title="Edit role">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CONTENT CREATION
  // ═══════════════════════════════════════════════════════════════════════════

  function createCompanyPost() {
    // Redirect to dashboard with company context
    const companyId = currentCompany?.id;
    if (companyId) {
      window.location.href = `dashboard.html?action=create-post&companyId=${companyId}`;
    }
  }

  function createCompanyProject() {
    const companyId = currentCompany?.id;
    if (companyId) {
      window.location.href = `dashboard.html?action=create-project&companyId=${companyId}`;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EVENT LISTENERS
  // ═══════════════════════════════════════════════════════════════════════════

  function setupEventListeners() {
    // Tab navigation
    document.querySelectorAll('.company-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const tabName = tab.dataset.tab;
        if (tabName) goToTab(tabName);
      });
    });

    // Settings
    document.getElementById('saveCompanySettings')?.addEventListener('click', saveCompanySettings);
    document.getElementById('deleteCompanyBtn')?.addEventListener('click', deleteCompany);

    // Create content buttons
    document.getElementById('createCompanyPostBtn')?.addEventListener('click', createCompanyPost);
    document.getElementById('createCompanyProjectBtn')?.addEventListener('click', createCompanyProject);

    // Description character counter
    const descriptionInput = document.getElementById('settingCompanyDescription');
    const descriptionCount = document.getElementById('descriptionCount');
    if (descriptionInput && descriptionCount) {
      descriptionInput.addEventListener('input', () => {
        descriptionCount.textContent = descriptionInput.value.length;
      });
    }

    // Auth state changes
    window.addEventListener('prism:auth:changed', async (e) => {
      currentUser = e.detail?.user || PrismAuth?.getUser?.();
      if (currentCompany) {
        userRole = currentUser ? await PrismBin.getUserCompanyRole(currentCompany.id, currentUser.id) : null;
        renderCompanyActions();
        renderCompanyTabs();
        renderSettingsMembers();
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════════

  async function init() {
    if (document.body.dataset.page !== 'company') return;

    console.log('[Company] Initializing company hub...');

    currentUser = PrismAuth?.getUser?.() || null;

    setupEventListeners();
    await loadCompany();

    console.log('[Company] Company hub initialized');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
