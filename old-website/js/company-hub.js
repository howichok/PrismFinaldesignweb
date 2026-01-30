/* ═══════════════════════════════════════════════════════════════════════════
   Company Hub - Full company management with sidebar navigation
   ═══════════════════════════════════════════════════════════════════════════ */

(function() {
  'use strict';

  // State
  let currentUser = null;
  let currentCompany = null;
  let userRole = null;
  let companyMembers = [];
  let searchTimeout = null;
  let transferTarget = null;
  let transferCountdownInterval = null;

  // Role hierarchy
  const ROLES = ['member', 'trusted', 'coowner', 'owner'];
  const ROLE_LABELS = {
    owner: 'Owner',
    coowner: 'Co-owner',
    trusted: 'Trusted Member',
    member: 'Member'
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════════

  // Timeout for loading - prevent eternal loading
  const LOAD_TIMEOUT_MS = 15000;
  let loadingTimeoutId = null;

  async function init() {
    if (document.body.dataset.page !== 'company') return;

    console.log('[CompanyHub] Initializing...');

    // Wait for auth to be ready (max 5s)
    await waitForAuth();

    currentUser = typeof PrismAuth !== 'undefined' ? PrismAuth.getUser() : null;

    if (!currentUser) {
      console.log('[CompanyHub] No user logged in');
      window.location.href = 'index.html';
      return;
    }

    setupEventListeners();
    
    // Set loading timeout
    loadingTimeoutId = setTimeout(() => {
      console.error('[CompanyHub] Loading timed out');
      showError('Loading timed out. Please try again.');
    }, LOAD_TIMEOUT_MS);

    await loadCompany();

    console.log('[CompanyHub] Initialized');
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
        if ((typeof PrismAuth !== 'undefined' && PrismAuth.getUser()) || attempts > 50) {
          clearInterval(check);
          resolve();
        }
      }, 100);
    });
  }

  async function loadCompany() {
    const urlParams = new URLSearchParams(window.location.search);
    const companyId = urlParams.get('id');
    const companySlug = urlParams.get('slug');

    if (!companyId && !companySlug) {
      clearTimeout(loadingTimeoutId);
      showError('No company specified');
      return;
    }

    try {
      let company;
      if (typeof PrismBin !== 'undefined') {
        if (companyId) {
          company = await PrismBin.getCompanyById(companyId);
        } else if (companySlug) {
          company = await PrismBin.getCompanyBySlug(companySlug);
        }
      }

      // Clear loading timeout on success
      clearTimeout(loadingTimeoutId);

      if (!company) {
        showError('Company not found');
        return;
      }

      currentCompany = company;
      console.log('[CompanyHub] Loaded company:', company.name);

      // Get user's role
      if (typeof PrismBin !== 'undefined' && PrismBin.getUserCompanyRole) {
        userRole = await PrismBin.getUserCompanyRole(company.id, currentUser.id);
      }

      // Check if user is owner
      if (company.ownerId === currentUser.id || company.owner_id === currentUser.id) {
        userRole = 'owner';
      }

      if (!userRole) {
        // Check if user is a member
        const isMember = company.members?.some(m => m.id === currentUser.id);
        if (!isMember && company.ownerId !== currentUser.id && company.owner_id !== currentUser.id) {
          showError('You are not a member of this company');
          return;
        }
        userRole = 'member';
      }

      console.log('[CompanyHub] User role:', userRole);

      // Update UI
      updateSidebar();
      updateWelcome();
      showPanel('welcome');

      // Hide loading
      document.getElementById('companyLoading').style.display = 'none';

    } catch (error) {
      clearTimeout(loadingTimeoutId);
      console.error('[CompanyHub] Failed to load company:', error);
      
      // Handle specific error types
      if (error.status === 401 || error.status === 403) {
        showError('Access denied. You may not have permission to view this company.');
      } else if (error.status === 404) {
        showError('Company not found.');
      } else {
        showError(error.message || 'Failed to load company. Please try again.');
      }
    }
  }

  function showError(message) {
    document.getElementById('companyLoading').style.display = 'none';
    const errorEl = document.getElementById('companyError');
    errorEl.style.display = 'flex';
    document.getElementById('companyErrorMessage').textContent = message;
    
    // Add retry button functionality
    const retryBtn = errorEl.querySelector('.btn--primary');
    if (retryBtn && !retryBtn.dataset.hasRetry) {
      retryBtn.dataset.hasRetry = 'true';
      retryBtn.addEventListener('click', (e) => {
        e.preventDefault();
        location.reload();
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UI UPDATES
  // ═══════════════════════════════════════════════════════════════════════════

  function updateSidebar() {
    const company = currentCompany;
    if (!company) return;

    // Logo
    const logoEl = document.getElementById('sidebarCompanyLogo');
    const logoUrl = company.logoUrl || company.logo_url;
    if (logoUrl) {
      logoEl.innerHTML = `<img src="${logoUrl}" alt="${company.name}">`;
    }

    // Name
    document.getElementById('sidebarCompanyName').textContent = company.name;

    // Role badge
    const roleEl = document.getElementById('sidebarUserRole');
    roleEl.textContent = ROLE_LABELS[userRole] || 'Member';
    roleEl.className = `company-sidebar__role company-sidebar__role--${userRole}`;

    // Show settings for owners/coowners
    const settingsSection = document.getElementById('settingsSection');
    if (settingsSection) {
      const canManage = userRole === 'owner' || userRole === 'coowner';
      settingsSection.style.display = canManage ? 'block' : 'none';
    }
  }

  function updateWelcome() {
    const company = currentCompany;
    if (!company) return;

    document.getElementById('welcomeCompanyName').textContent = company.name;
    document.getElementById('postCompanyName').textContent = company.name;
    document.getElementById('projectCompanyName').textContent = company.name;

    // Stats
    document.getElementById('statPosts').textContent = company.postsCount || company.posts_count || 0;
    document.getElementById('statProjects').textContent = company.projectsCount || company.projects_count || 0;
    document.getElementById('statMembers').textContent = (company.members?.length || 0) + 1;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PANEL NAVIGATION
  // ═══════════════════════════════════════════════════════════════════════════

  function showPanel(panelName) {
    // Hide all panels
    document.querySelectorAll('.company-panel').forEach(panel => {
      panel.style.display = 'none';
      panel.classList.remove('active');
    });

    // Show selected panel
    const panelId = `panel${panelName.charAt(0).toUpperCase() + panelName.slice(1).replace(/-([a-z])/g, g => g[1].toUpperCase())}`;
    const panel = document.getElementById(panelId);
    if (panel) {
      panel.style.display = 'block';
      panel.classList.add('active');
    }

    // Update nav active state
    document.querySelectorAll('.company-sidebar__item').forEach(item => {
      item.classList.remove('active');
      if (item.dataset.panel === panelName) {
        item.classList.add('active');
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SETTINGS OVERLAY
  // ═══════════════════════════════════════════════════════════════════════════

  function openSettings() {
    const overlay = document.getElementById('settingsOverlay');
    if (!overlay) return;

    overlay.classList.add('active');
    // Block scroll on body and html for mobile compatibility
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    // Populate settings
    populateSettings();
    loadMembers();
  }

  function closeSettings() {
    const overlay = document.getElementById('settingsOverlay');
    if (overlay) {
      overlay.classList.remove('active');
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    }
  }

  function switchSettingsTab(tabName) {
    document.querySelectorAll('.settings-overlay__tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.settingsTab === tabName);
    });

    document.querySelectorAll('.settings-tab-panel').forEach(panel => {
      panel.classList.toggle('active', panel.dataset.settingsPanel === tabName);
    });
  }

  function populateSettings() {
    const company = currentCompany;
    if (!company) return;

    // Logo
    const logoPreview = document.getElementById('settingsLogoPreview');
    const logoUrl = company.logoUrl || company.logo_url;
    if (logoUrl) {
      logoPreview.innerHTML = `<img src="${logoUrl}" alt="${company.name}">`;
    }

    // Name
    document.getElementById('settingsName').value = company.name || '';

    // Description
    document.getElementById('settingsDescription').value = company.description || '';

    // Categories
    const categories = company.categories || [];
    document.querySelectorAll('#settingsCategories input').forEach(input => {
      input.checked = categories.includes(input.value);
    });
  }

  async function saveSettings() {
    if (!currentCompany) return;

    const name = document.getElementById('settingsName').value.trim();
    const description = document.getElementById('settingsDescription').value.trim();
    const categories = Array.from(document.querySelectorAll('#settingsCategories input:checked')).map(i => i.value);
    const logoUrl = currentCompany.logoUrl || currentCompany.logo_url;

    if (!name) {
      showToast('Error', 'Company name is required');
      return;
    }

    const btn = document.getElementById('saveSettingsBtn');
    btn.disabled = true;
    btn.textContent = 'Saving...';

    try {
      const updateData = { name, description, categories };
      if (logoUrl) {
        updateData.logoUrl = logoUrl;
      }

      if (typeof PrismBin !== 'undefined' && PrismBin.updateCompany) {
        await PrismBin.updateCompany(currentCompany.id, updateData);
      }

      currentCompany.name = name;
      currentCompany.description = description;
      currentCompany.categories = categories;
      if (logoUrl) {
        currentCompany.logoUrl = logoUrl;
        currentCompany.logo_url = logoUrl;
      }

      updateSidebar();
      updateWelcome();
      showToast('Success', 'Settings saved');
    } catch (error) {
      console.error('[CompanyHub] Failed to save settings:', error);
      showToast('Error', 'Failed to save settings');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Save Changes';
    }
  }

  async function deleteCompany() {
    if (!currentCompany || userRole !== 'owner') {
      showToast('Error', 'Only the owner can delete this company');
      return;
    }

    if (!confirm(`Are you sure you want to delete "${currentCompany.name}"? This action cannot be undone.`)) return;
    if (!confirm('This will permanently delete all posts, projects, and member associations. Continue?')) return;

    try {
      if (typeof PrismBin !== 'undefined' && PrismBin.deleteCompany) {
        await PrismBin.deleteCompany(currentCompany.id);
      }
      showToast('Success', 'Company deleted');
      window.location.href = 'dashboard.html';
    } catch (error) {
      console.error('[CompanyHub] Failed to delete company:', error);
      showToast('Error', 'Failed to delete company');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MEMBERS MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  async function loadMembers() {
    const listEl = document.getElementById('membersList');
    const transferSelectEl = document.getElementById('transferSelect');

    if (!listEl || !currentCompany) return;

    listEl.innerHTML = '<p class="text-muted">Loading members...</p>';

    try {
      // Build members list
      companyMembers = [];

      // Add owner first
      const owner = currentCompany.owner || await fetchUser(currentCompany.ownerId || currentCompany.owner_id);
      if (owner) {
        companyMembers.push({ ...owner, role: 'owner' });
      }

      // Add other members
      if (currentCompany.members) {
        for (const m of currentCompany.members) {
          if (m.id !== (currentCompany.ownerId || currentCompany.owner_id)) {
            companyMembers.push(m);
          }
        }
      }

      renderMembersList();

      // Transfer ownership tab and dropdown (owner only)
      const transferTab = document.getElementById('transferTab');
      if (userRole === 'owner') {
        if (transferTab) transferTab.style.display = 'block';
        if (transferSelectEl) {
          transferSelectEl.innerHTML = '<option value="">Select a member...</option>' +
            companyMembers
              .filter(m => m.role !== 'owner')
              .map(m => `<option value="${m.id}">${escapeHtml(m.nickname || m.mcNickname || m.email)}</option>`)
              .join('');
        }
      } else {
        if (transferTab) transferTab.style.display = 'none';
      }
    } catch (error) {
      console.error('[CompanyHub] Failed to load members:', error);
      listEl.innerHTML = '<p class="text-danger">Failed to load members</p>';
    }
  }

  async function fetchUser(userId) {
    if (typeof PrismBin !== 'undefined' && PrismBin.getUserById) {
      return await PrismBin.getUserById(userId);
    }
    return null;
  }

  function renderMembersList() {
    const listEl = document.getElementById('membersList');
    if (!listEl) return;

    const canManage = userRole === 'owner' || userRole === 'coowner';
    const canPromoteToCo = userRole === 'owner'; // Only owner can promote to co-owner

    listEl.innerHTML = companyMembers.map(member => {
      const name = member.nickname || member.mcNickname || member.email?.split('@')[0] || 'Unknown';
      const initials = name.slice(0, 2).toUpperCase();
      const isOwner = member.role === 'owner';
      const isCoowner = member.role === 'coowner';
      const isSelf = member.id === currentUser.id;
      const memberRole = member.role || 'member';

      // Determine available role actions
      const canPromote = canManage && !isOwner && !isSelf && memberRole !== 'coowner';
      const canDemote = canManage && !isOwner && !isSelf && memberRole !== 'member';
      const canKick = canManage && !isOwner && !isSelf;

      // Next role for promote
      const nextRole = memberRole === 'member' ? 'trusted' : (memberRole === 'trusted' && canPromoteToCo ? 'coowner' : null);
      // Prev role for demote
      const prevRole = memberRole === 'coowner' ? 'trusted' : (memberRole === 'trusted' ? 'member' : null);

      return `
        <div class="member-row" data-member-id="${member.id}">
          <div class="member-row__avatar" data-action="show-user-profile" data-user-id="${member.id}">
            ${member.avatar ? `<img src="${member.avatar}" alt="${name}">` : initials}
          </div>
          <div class="member-row__info">
            <span class="member-row__name" data-action="show-user-profile" data-user-id="${member.id}">${escapeHtml(name)}</span>
            <span class="member-row__role-badge member-row__role-badge--${memberRole}">${ROLE_LABELS[memberRole] || 'Member'}</span>
          </div>
          ${canManage && !isOwner && !isSelf ? `
            <div class="member-row__actions">
              ${canPromote && nextRole ? `
                <button class="btn btn--sm btn--ghost btn--success" onclick="promoteMember('${member.id}', '${nextRole}')" title="Promote to ${ROLE_LABELS[nextRole]}">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                    <polyline points="18 15 12 9 6 15"/>
                  </svg>
                </button>
              ` : ''}
              ${canDemote && prevRole ? `
                <button class="btn btn--sm btn--ghost btn--warning" onclick="demoteMember('${member.id}', '${prevRole}')" title="Demote to ${ROLE_LABELS[prevRole]}">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>
              ` : ''}
              ${canKick ? `
                <button class="btn btn--sm btn--ghost btn--danger" onclick="removeMember('${member.id}')" title="Remove member">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              ` : ''}
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

    // Add click handlers for user profiles
    listEl.querySelectorAll('[data-action="show-user-profile"]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const userId = el.dataset.userId;
        if (userId && typeof showUserProfile === 'function') {
          showUserProfile(userId);
        }
      });
    });
  }

  // Promote member to higher role
  window.promoteMember = async function(memberId, newRole) {
    await changeMemberRole(memberId, newRole);
  };

  // Demote member to lower role
  window.demoteMember = async function(memberId, newRole) {
    await changeMemberRole(memberId, newRole);
  };

  window.changeMemberRole = async function(memberId, newRole) {
    if (!currentCompany) return;

    // Check permissions
    if (userRole !== 'owner' && userRole !== 'coowner') {
      showToast('Error', 'You do not have permission to change roles');
      return;
    }

    // Owner can't be demoted
    const member = companyMembers.find(m => m.id === memberId);
    if (member && member.role === 'owner') {
      showToast('Error', 'Cannot change owner role');
      return;
    }

    // Only owner can promote to co-owner
    if (newRole === 'coowner' && userRole !== 'owner') {
      showToast('Error', 'Only owner can promote to Co-owner');
      return;
    }

    try {
      if (typeof PrismBin !== 'undefined' && PrismBin.updateCompanyMemberRole) {
        await PrismBin.updateCompanyMemberRole(currentCompany.id, memberId, newRole);
      }

      // Update local state
      if (member) {
        member.role = newRole;
      }

      // Reload members to refresh UI
      await loadMembers();
      showToast('Success', 'Member role updated');
    } catch (error) {
      console.error('[CompanyHub] Failed to change role:', error);
      showToast('Error', 'Failed to update role');
      await loadMembers(); // Reload to reset
    }
  };

  window.removeMember = async function(memberId) {
    if (!currentCompany) return;

    // Check permissions
    if (userRole !== 'owner' && userRole !== 'coowner') {
      showToast('Error', 'You do not have permission to remove members');
      return;
    }

    const member = companyMembers.find(m => m.id === memberId);
    if (member && member.role === 'owner') {
      showToast('Error', 'Cannot remove owner');
      return;
    }

    if (!confirm('Are you sure you want to remove this member?')) return;

    try {
      if (typeof PrismBin !== 'undefined' && PrismBin.removeCompanyMember) {
        await PrismBin.removeCompanyMember(currentCompany.id, memberId);
      }

      companyMembers = companyMembers.filter(m => m.id !== memberId);
      await loadMembers(); // Reload to refresh UI
      showToast('Success', 'Member removed');
    } catch (error) {
      console.error('[CompanyHub] Failed to remove member:', error);
      showToast('Error', 'Failed to remove member');
      await loadMembers(); // Reload to reset
    }
  };

  // Member search
  async function searchMembers(query) {
    const resultsEl = document.getElementById('memberSearchResults');
    if (!resultsEl) return;

    if (!query || query.length < 2) {
      resultsEl.classList.remove('active');
      return;
    }

    try {
      let users = [];
      if (typeof PrismBin !== 'undefined' && PrismBin.searchUsers) {
        users = await PrismBin.searchUsers(query) || [];
      }

      // Filter out existing members
      const existingIds = companyMembers.map(m => m.id);
      users = users.filter(u => !existingIds.includes(u.id));

      if (users.length === 0) {
        resultsEl.innerHTML = '<div class="member-search__result"><span class="text-muted">No users found</span></div>';
      } else {
        resultsEl.innerHTML = users.slice(0, 5).map(user => {
          const name = user.nickname || user.mcNickname || user.email?.split('@')[0] || 'Unknown';
          const initials = name.slice(0, 2).toUpperCase();

          return `
            <div class="member-search__result" onclick="addMember('${user.id}')">
              <div class="user-chip">
                <div class="user-chip__avatar" data-action="show-user-profile" data-user-id="${user.id}">
                  ${user.avatar ? `<img src="${user.avatar}" alt="${name}">` : initials}
                </div>
                <div class="user-chip__info">
                  <span class="user-chip__name" data-action="show-user-profile" data-user-id="${user.id}">${escapeHtml(name)}</span>
                  ${user.email ? `<span class="user-chip__email">${escapeHtml(user.email)}</span>` : ''}
                </div>
              </div>
            </div>
          `;
        }).join('');

        // Add click handlers for user profiles in search results
        resultsEl.querySelectorAll('[data-action="show-user-profile"]').forEach(el => {
          el.addEventListener('click', (e) => {
            e.stopPropagation();
            const userId = el.dataset.userId;
            if (userId && typeof showUserProfile === 'function') {
              showUserProfile(userId);
            }
          });
        });
      }

      resultsEl.classList.add('active');
    } catch (error) {
      console.error('[CompanyHub] Search failed:', error);
    }
  }

  window.addMember = async function(userId) {
    if (!currentCompany) return;

    const resultsEl = document.getElementById('memberSearchResults');
    const inputEl = document.getElementById('memberSearchInput');

    try {
      if (typeof PrismBin !== 'undefined' && PrismBin.addCompanyMember) {
        await PrismBin.addCompanyMember(currentCompany.id, userId, 'member');
      }

      if (resultsEl) resultsEl.classList.remove('active');
      if (inputEl) inputEl.value = '';

      await loadMembers();
      showToast('Success', 'Member added');
    } catch (error) {
      console.error('[CompanyHub] Failed to add member:', error);
      showToast('Error', 'Failed to add member');
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // TRANSFER OWNERSHIP
  // ═══════════════════════════════════════════════════════════════════════════

  function openTransferModal() {
    const selectEl = document.getElementById('transferSelect');
    if (!selectEl || !selectEl.value) return;

    transferTarget = companyMembers.find(m => m.id === selectEl.value);
    if (!transferTarget) return;

    const modal = document.getElementById('transferModal');
    const nameEl = document.getElementById('transferTargetName');
    const confirmBtn = document.getElementById('confirmTransferBtn');
    const countdownEl = document.getElementById('transferCountdown');

    if (nameEl) nameEl.textContent = transferTarget.nickname || transferTarget.email;

    // Reset countdown
    let countdown = 5;
    if (confirmBtn) {
      confirmBtn.disabled = true;
    }

    if (modal) {
      modal.classList.add('active');
      document.body.style.overflow = 'hidden';
    }

    // Update countdown display function
    const updateCountdown = () => {
      if (countdownEl) countdownEl.textContent = countdown;
      if (confirmBtn && countdown > 0) {
        confirmBtn.innerHTML = `Confirm Transfer (<span id="transferCountdown">${countdown}</span>s)`;
        // Re-get countdownEl after innerHTML update
        const newCountdownEl = document.getElementById('transferCountdown');
        if (newCountdownEl) countdownEl = newCountdownEl;
      }
    };

    updateCountdown();

    // Start countdown
    if (transferCountdownInterval) clearInterval(transferCountdownInterval);
    transferCountdownInterval = setInterval(() => {
      countdown--;
      updateCountdown();
      if (countdown <= 0) {
        clearInterval(transferCountdownInterval);
        transferCountdownInterval = null;
        if (confirmBtn) {
          confirmBtn.disabled = false;
          confirmBtn.innerHTML = 'Confirm Transfer';
        }
      }
    }, 1000);
  }

  function closeTransferModal() {
    const modal = document.getElementById('transferModal');
    if (modal) {
      modal.classList.remove('active');
    }
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
    if (transferCountdownInterval) {
      clearInterval(transferCountdownInterval);
      transferCountdownInterval = null;
    }
    transferTarget = null;
  }

  async function confirmTransfer() {
    if (!transferTarget || !currentCompany || userRole !== 'owner') return;

    try {
      if (typeof PrismBin !== 'undefined' && PrismBin.transferCompanyOwnership) {
        await PrismBin.transferCompanyOwnership(currentCompany.id, transferTarget.id);
      }

      showToast('Success', 'Ownership transferred');
      closeTransferModal();
      closeSettings();

      // Reload page to reflect changes
      setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      console.error('[CompanyHub] Transfer failed:', error);
      showToast('Error', 'Failed to transfer ownership');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CREATE CONTENT
  // ═══════════════════════════════════════════════════════════════════════════

  async function createPost(e) {
    e.preventDefault();

    const title = document.getElementById('postTitle').value.trim();
    const content = document.getElementById('postContent').value.trim();
    const tags = document.getElementById('postTags').value.split(',').map(t => t.trim()).filter(Boolean);

    if (!title || !content) {
      showToast('Error', 'Title and content are required');
      return;
    }

    const btn = document.getElementById('publishPostBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner spinner--sm"></span> Publishing...';

    try {
      if (typeof PrismBin !== 'undefined' && PrismBin.createPost) {
        await PrismBin.createPost({
          title,
          content,
          tags,
          companyId: currentCompany.id,
          published: true
        });
      }

      showToast('Success', 'Post published');
      document.getElementById('createPostForm').reset();
      showPanel('welcome');

      // Update stats
      const statEl = document.getElementById('statPosts');
      if (statEl) statEl.textContent = parseInt(statEl.textContent) + 1;
    } catch (error) {
      console.error('[CompanyHub] Failed to create post:', error);
      showToast('Error', 'Failed to publish post');
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
        <line x1="22" y1="2" x2="11" y2="13"/>
        <polygon points="22 2 15 22 11 13 2 9 22 2"/>
      </svg> Publish Post`;
    }
  }

  async function createProject(e) {
    e.preventDefault();

    const name = document.getElementById('projectName').value.trim();
    const category = document.getElementById('projectCategory').value;
    const description = document.getElementById('projectDescription').value.trim();
    const coverUrl = document.getElementById('projectCover').value.trim();

    if (!name || !category || !description) {
      showToast('Error', 'Please fill all required fields');
      return;
    }

    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner spinner--sm"></span> Creating...';

    try {
      if (typeof PrismBin !== 'undefined' && PrismBin.createProject) {
        await PrismBin.createProject({
          name,
          category,
          description,
          coverUrl,
          companyId: currentCompany.id
        });
      }

      showToast('Success', 'Project created');
      document.getElementById('createProjectForm').reset();
      showPanel('welcome');

      // Update stats
      const statEl = document.getElementById('statProjects');
      if (statEl) statEl.textContent = parseInt(statEl.textContent) + 1;
    } catch (error) {
      console.error('[CompanyHub] Failed to create project:', error);
      showToast('Error', 'Failed to create project');
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
      </svg> Create Project`;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LOGO UPLOAD
  // ═══════════════════════════════════════════════════════════════════════════

  async function handleLogoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file
    if (!file.type.startsWith('image/')) {
      showToast('Error', 'Please select an image file');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      showToast('Error', 'File size must be less than 2MB');
      return;
    }

    const previewEl = document.getElementById('settingsLogoPreview');
    if (!previewEl) return;

    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => {
      previewEl.innerHTML = `<img src="${e.target.result}" alt="Logo preview">`;
    };
    reader.readAsDataURL(file);

    // Upload to Supabase Storage
    try {
      let logoUrl = null;
      
      // Try PrismImageUpload first (preferred)
      if (typeof PrismImageUpload !== 'undefined' && PrismImageUpload.upload) {
        logoUrl = await PrismImageUpload.upload(file, 'company-logos', `${currentCompany.id}/logo`);
      } 
      // Fallback to PrismBin methods
      else if (typeof PrismBin !== 'undefined' && PrismBin.uploadCompanyLogo) {
        logoUrl = await PrismBin.uploadCompanyLogo(currentCompany.id, file);
      } else if (typeof PrismBin !== 'undefined' && PrismBin.uploadFile) {
        logoUrl = await PrismBin.uploadFile(file, `companies/${currentCompany.id}/logo`);
      }

      if (logoUrl) {
        // Update company logo URL
        if (typeof PrismBin !== 'undefined' && PrismBin.updateCompany) {
          await PrismBin.updateCompany(currentCompany.id, { logoUrl });
        }
        currentCompany.logoUrl = logoUrl;
        currentCompany.logo_url = logoUrl;
        updateSidebar();
        showToast('Success', 'Logo uploaded successfully');
      } else {
        throw new Error('Upload failed: no URL returned');
      }
    } catch (error) {
      console.error('[CompanyHub] Failed to upload logo:', error);
      showToast('Error', error.message || 'Failed to upload logo');
      // Reset preview on error
      const logoUrl = currentCompany.logoUrl || currentCompany.logo_url;
      if (logoUrl) {
        previewEl.innerHTML = `<img src="${logoUrl}" alt="Logo preview">`;
      } else {
        previewEl.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/>
          </svg>
        `;
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UTILITIES
  // ═══════════════════════════════════════════════════════════════════════════

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }

  function showToast(title, message) {
    const toast = document.getElementById('toast');
    if (toast) {
      toast.querySelector('.toast__title').textContent = title;
      toast.querySelector('.toast__message').textContent = message;
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 3000);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EVENT LISTENERS
  // ═══════════════════════════════════════════════════════════════════════════

  function setupEventListeners() {
    // Sidebar toggle (mobile)
    const toggle = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('companySidebar');
    const overlay = document.getElementById('sidebarOverlay');

    if (toggle && sidebar) {
      toggle.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        overlay?.classList.toggle('active');
      });
    }

    if (overlay) {
      overlay.addEventListener('click', () => {
        sidebar?.classList.remove('open');
        overlay.classList.remove('active');
      });
    }

    // Panel navigation
    document.addEventListener('click', (e) => {
      const target = e.target.closest('[data-panel]');
      if (target) {
        e.preventDefault();
        const panelName = target.dataset.panel;
        showPanel(panelName);
        sidebar?.classList.remove('open');
        overlay?.classList.remove('active');
      }

      // Actions
      const actionEl = e.target.closest('[data-action]');
      const action = actionEl?.dataset.action;
      if (action) {
        switch (action) {
          case 'open-settings':
            openSettings();
            break;
          case 'close-settings':
            closeSettings();
            break;
          case 'close-transfer-modal':
            closeTransferModal();
            break;
          case 'show-user-profile':
            e.stopPropagation();
            const userId = actionEl.dataset.userId;
            if (userId && typeof showUserProfile === 'function') {
              showUserProfile(userId);
            }
            break;
        }
      }
    });

    // Settings tabs
    document.querySelectorAll('.settings-overlay__tab').forEach(tab => {
      tab.addEventListener('click', () => switchSettingsTab(tab.dataset.settingsTab));
    });

    // Save settings
    document.getElementById('saveSettingsBtn')?.addEventListener('click', saveSettings);
    document.getElementById('deleteCompanyBtn')?.addEventListener('click', deleteCompany);

    // Member search
    const searchInput = document.getElementById('memberSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => searchMembers(e.target.value), 300);
      });

      searchInput.addEventListener('blur', () => {
        setTimeout(() => {
          document.getElementById('memberSearchResults')?.classList.remove('active');
        }, 200);
      });
    }

    // Transfer ownership
    const transferSelect = document.getElementById('transferSelect');
    const transferBtn = document.getElementById('transferBtn');
    if (transferSelect && transferBtn) {
      transferSelect.addEventListener('change', () => {
        transferBtn.disabled = !transferSelect.value;
      });
      transferBtn.addEventListener('click', openTransferModal);
    }

    document.getElementById('confirmTransferBtn')?.addEventListener('click', confirmTransfer);

    // Logo upload
    const logoInput = document.getElementById('settingsLogoInput');
    if (logoInput) {
      logoInput.addEventListener('change', handleLogoUpload);
    }

    // ESC to close settings
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const overlay = document.getElementById('settingsOverlay');
        if (overlay && overlay.classList.contains('active')) {
          closeSettings();
        }
        const modal = document.getElementById('transferModal');
        if (modal && modal.classList.contains('active')) {
          closeTransferModal();
        }
      }
    });

    // Forms
    document.getElementById('createPostForm')?.addEventListener('submit', createPost);
    document.getElementById('createProjectForm')?.addEventListener('submit', createProject);

    // Logo upload
    const logoInput = document.getElementById('settingsLogoInput');
    if (logoInput) {
      logoInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) {
          showToast('Error', 'File size must be less than 2MB');
          return;
        }

        // Preview
        const reader = new FileReader();
        reader.onload = (e) => {
          document.getElementById('settingsLogoPreview').innerHTML = `<img src="${e.target.result}" alt="Preview">`;
        };
        reader.readAsDataURL(file);

        // TODO: Upload to server
        showToast('Info', 'Logo upload requires server integration');
      });
    }
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
