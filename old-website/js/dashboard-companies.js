/**
 * PrismMTR Dashboard - Companies
 * 
 * Handles:
 * - Companies list display
 * - Create company
 * - Manage company members
 * - Member roles (Owner, Co-owner, Trusted Member, Member)
 */

(function() {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════════════════

  let currentUser = null;
  let companies = [];
  let selectedCompany = null;
  let companyLogoData = null;

  // Role hierarchy
  const ROLES = {
    owner: { label: 'Owner', level: 4, color: '#f59e0b' },
    coowner: { label: 'Co-owner', level: 3, color: '#8b5cf6' },
    trusted: { label: 'Trusted Member', level: 2, color: '#10b981' },
    member: { label: 'Member', level: 1, color: '#6b7280' }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // UTILITIES
  // ═══════════════════════════════════════════════════════════════════════════

  function showToast(title, message, type = 'success') {
    if (window.PrismUI && window.PrismUI.showToast) {
      window.PrismUI.showToast(title, message);
    } else {
      console.log(`[Toast] ${title}: ${message}`);
    }
  }

  function getInitials(name) {
    if (!name) return '?';
    return name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
  }

  function formatDate(dateStr) {
    if (!dateStr) return 'Unknown';
    return new Date(dateStr).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short',
      day: 'numeric'
    });
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SIDEBAR
  // ═══════════════════════════════════════════════════════════════════════════

  function initSidebar() {
    const toggle = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('dashboardSidebar');
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

    // Update user info in sidebar
    updateSidebarUser();
  }

  function updateSidebarUser() {
    if (!currentUser) return;

    const nameEl = document.getElementById('sidebarUserName');
    const roleEl = document.getElementById('sidebarUserRole');
    const avatarEl = document.getElementById('sidebarUserAvatar');
    const adminSection = document.getElementById('adminSection');

    const displayName = currentUser.mcNickname || currentUser.nickname || 'User';
    
    if (nameEl) nameEl.textContent = displayName;
    if (roleEl) {
      const roleLabels = { user: 'Member', mod: 'Moderator', admin: 'Administrator' };
      roleEl.textContent = roleLabels[currentUser.role] || 'Member';
    }

    if (avatarEl) {
      const avatarUrl = currentUser.avatar || currentUser.avatar_url;
      if (avatarUrl) {
        avatarEl.innerHTML = `<img src="${avatarUrl}" alt="${displayName}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
      } else {
        avatarEl.textContent = getInitials(displayName);
      }
    }

    // Show admin section for mod/admin
    if (adminSection) {
      const isStaff = currentUser.role === 'mod' || currentUser.role === 'admin';
      adminSection.style.display = isStaff ? 'block' : 'none';
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPANIES LIST
  // ═══════════════════════════════════════════════════════════════════════════

  async function loadCompanies() {
    const loadingEl = document.getElementById('companiesLoading');
    const emptyEl = document.getElementById('companiesEmpty');
    const gridEl = document.getElementById('companiesGrid');

    try {
      loadingEl.style.display = 'flex';
      emptyEl.style.display = 'none';
      gridEl.style.display = 'none';

      // Get all companies
      const allCompanies = await PrismBin.getCompanies();
      
      // Filter companies where user is owner or member
      companies = allCompanies.filter(company => {
        if (company.ownerId === currentUser.id || company.owner_id === currentUser.id) return true;
        if (company.members?.some(m => m.id === currentUser.id || m.userId === currentUser.id)) return true;
        return false;
      });

      loadingEl.style.display = 'none';

      if (companies.length === 0) {
        emptyEl.style.display = 'block';
        gridEl.style.display = 'none';
      } else {
        emptyEl.style.display = 'none';
        gridEl.style.display = 'grid';
        renderCompanies();
      }
    } catch (error) {
      console.error('[Companies] Failed to load companies:', error);
      loadingEl.style.display = 'none';
      showToast('Error', 'Failed to load companies');
    }
  }

  function renderCompanies() {
    const gridEl = document.getElementById('companiesGrid');
    if (!gridEl) return;

    gridEl.innerHTML = companies.map(company => {
      const isOwner = company.ownerId === currentUser.id || company.owner_id === currentUser.id;
      const memberCount = (company.members?.length || 0) + 1;
      const categories = company.categories || (company.category ? [company.category] : []);
      const logoUrl = company.logoUrl || company.logo_url;

      const categoryLabels = {
        metro: 'Metro',
        rail: 'Railway',
        city: 'City',
        infrastructure: 'Infra',
        creative: 'Creative'
      };

      return `
        <div class="company-card" data-company-id="${company.id}">
          <div class="company-card__header">
            <div class="company-card__logo">
              ${logoUrl 
                ? `<img src="${logoUrl}" alt="${escapeHtml(company.name)}">`
                : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/>
                  </svg>`
              }
            </div>
            <div class="company-card__info">
              <h3 class="company-card__name">${escapeHtml(company.name)}</h3>
              <div class="company-card__categories">
                ${categories.map(cat => 
                  `<span class="company-card__category">${categoryLabels[cat] || cat}</span>`
                ).join('')}
              </div>
            </div>
            ${isOwner ? '<span class="company-card__badge company-card__badge--owner">Owner</span>' : ''}
          </div>
          
          <p class="company-card__description">${escapeHtml(company.description) || 'No description'}</p>
          
          <div class="company-card__meta">
            <span class="company-card__meta-item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
              </svg>
              ${memberCount} member${memberCount !== 1 ? 's' : ''}
            </span>
            <span class="company-card__meta-item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
              </svg>
              ${formatDate(company.createdAt || company.created_at)}
            </span>
          </div>
          
          <div class="company-card__actions">
            <button class="btn btn--sm btn--ghost" onclick="viewCompany('${company.id}')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              View
            </button>
            ${isOwner || getUserRole(company) === 'coowner' ? `
              <button class="btn btn--sm btn--outline" onclick="manageMembers('${company.id}')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <line x1="19" y1="8" x2="19" y2="14"/>
                  <line x1="22" y1="11" x2="16" y2="11"/>
                </svg>
                Members
              </button>
            ` : ''}
            <a href="company.html?id=${company.id}" class="btn btn--sm btn--primary">
              Open Hub
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </a>
          </div>
        </div>
      `;
    }).join('');
  }

  function getUserRole(company) {
    if (company.ownerId === currentUser.id || company.owner_id === currentUser.id) return 'owner';
    const member = company.members?.find(m => m.id === currentUser.id || m.userId === currentUser.id);
    return member?.role || 'member';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CREATE COMPANY
  // ═══════════════════════════════════════════════════════════════════════════

  function openCreateCompanyModal() {
    const modal = document.getElementById('createCompanyModal');
    if (modal) {
      modal.classList.add('open');
      document.body.style.overflow = 'hidden';
      
      // Reset form
      document.getElementById('createCompanyForm')?.reset();
      document.getElementById('companyLogoPreview').innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/>
        </svg>
      `;
      companyLogoData = null;
    }
  }

  function closeCreateCompanyModal() {
    const modal = document.getElementById('createCompanyModal');
    if (modal) {
      modal.classList.remove('open');
      document.body.style.overflow = '';
    }
  }

  async function handleCreateCompany(e) {
    e.preventDefault();

    const name = document.getElementById('companyName').value.trim();
    const description = document.getElementById('companyDescription').value.trim();
    const categoryInputs = document.querySelectorAll('input[name="companyCategory"]:checked');
    const categories = Array.from(categoryInputs).map(input => input.value);

    if (!name) {
      showToast('Error', 'Company name is required');
      return;
    }

    if (categories.length === 0) {
      showToast('Error', 'Please select at least one category');
      return;
    }

    const submitBtn = document.getElementById('submitCompanyBtn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<div class="spinner spinner--sm"></div> Creating...';

    try {
      const companyData = {
        name,
        description,
        categories,
        ownerId: currentUser.id,
        owner: {
          id: currentUser.id,
          nickname: currentUser.mcNickname || currentUser.nickname,
          avatar: currentUser.avatar
        },
        members: [],
        logoUrl: companyLogoData || null,
        createdAt: new Date().toISOString()
      };

      await PrismBin.createCompany(companyData);
      
      closeCreateCompanyModal();
      showToast('Success', 'Company created successfully');
      await loadCompanies();
    } catch (error) {
      console.error('[Companies] Failed to create company:', error);
      showToast('Error', error.message || 'Failed to create company');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        Create Company
      `;
    }
  }

  function handleLogoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      showToast('Error', 'File size must be less than 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      companyLogoData = event.target.result;
      document.getElementById('companyLogoPreview').innerHTML = 
        `<img src="${companyLogoData}" alt="Company Logo">`;
    };
    reader.readAsDataURL(file);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VIEW COMPANY
  // ═══════════════════════════════════════════════════════════════════════════

  window.viewCompany = async function(companyId) {
    selectedCompany = companies.find(c => c.id === companyId);
    if (!selectedCompany) return;

    const modal = document.getElementById('companyDetailsModal');
    const content = document.getElementById('companyDetailsContent');

    if (!modal || !content) return;

    const isOwner = selectedCompany.ownerId === currentUser.id || selectedCompany.owner_id === currentUser.id;
    const userRole = getUserRole(selectedCompany);
    const canManage = isOwner || userRole === 'coowner';
    const logoUrl = selectedCompany.logoUrl || selectedCompany.logo_url;
    const categories = selectedCompany.categories || (selectedCompany.category ? [selectedCompany.category] : []);

    const categoryLabels = {
      metro: 'Metro / Transit',
      rail: 'Railway',
      city: 'City Building',
      infrastructure: 'Infrastructure',
      creative: 'Creative / Other'
    };

    content.innerHTML = `
      <div class="company-details__header">
        <div class="company-details__logo">
          ${logoUrl 
            ? `<img src="${logoUrl}" alt="${escapeHtml(selectedCompany.name)}">`
            : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/>
              </svg>`
          }
        </div>
        <div class="company-details__info">
          <h2 class="company-details__name">${escapeHtml(selectedCompany.name)}</h2>
          <div class="company-details__categories">
            ${categories.map(cat => 
              `<span class="badge badge--accent">${categoryLabels[cat] || cat}</span>`
            ).join('')}
          </div>
          <p class="company-details__description">${escapeHtml(selectedCompany.description) || 'No description provided.'}</p>
        </div>
      </div>

      <div class="company-details__stats">
        <div class="stat-card">
          <div class="stat-card__value">${(selectedCompany.members?.length || 0) + 1}</div>
          <div class="stat-card__label">Members</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__value">${selectedCompany.projectCount || 0}</div>
          <div class="stat-card__label">Projects</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__value">${selectedCompany.postCount || 0}</div>
          <div class="stat-card__label">Posts</div>
        </div>
      </div>

      <div class="company-details__members">
        <h3 class="section-subtitle">Team Members</h3>
        <div class="members-preview">
          <div class="member-item member-item--owner">
            <div class="member-item__avatar" style="background: ${ROLES.owner.color};">
              ${selectedCompany.owner?.avatar 
                ? `<img src="${selectedCompany.owner.avatar}" alt="">` 
                : getInitials(selectedCompany.owner?.nickname || 'Owner')
              }
            </div>
            <div class="member-item__info">
              <span class="member-item__name">${escapeHtml(selectedCompany.owner?.nickname || 'Owner')}</span>
              <span class="member-item__role" style="color: ${ROLES.owner.color};">Owner</span>
            </div>
          </div>
          ${(selectedCompany.members || []).slice(0, 5).map(member => `
            <div class="member-item">
              <div class="member-item__avatar">
                ${member.avatar 
                  ? `<img src="${member.avatar}" alt="">` 
                  : getInitials(member.nickname || 'Member')
                }
              </div>
              <div class="member-item__info">
                <span class="member-item__name">${escapeHtml(member.nickname || 'Member')}</span>
                <span class="member-item__role" style="color: ${ROLES[member.role]?.color || ROLES.member.color};">
                  ${ROLES[member.role]?.label || 'Member'}
                </span>
              </div>
            </div>
          `).join('')}
          ${(selectedCompany.members?.length || 0) > 5 ? `
            <div class="members-preview__more">+${selectedCompany.members.length - 5} more</div>
          ` : ''}
        </div>
      </div>

      <div class="company-details__actions">
        <a href="company.html?id=${selectedCompany.id}" class="btn btn--primary">
          Open Company Hub
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            <polyline points="15 3 21 3 21 9"/>
            <line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
        </a>
        ${canManage ? `
          <button class="btn btn--outline" onclick="manageMembers('${selectedCompany.id}'); closeDetailsModal();">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <line x1="19" y1="8" x2="19" y2="14"/>
              <line x1="22" y1="11" x2="16" y2="11"/>
            </svg>
            Manage Members
          </button>
        ` : ''}
      </div>
    `;

    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  };

  window.closeDetailsModal = function() {
    const modal = document.getElementById('companyDetailsModal');
    if (modal) {
      modal.classList.remove('open');
      document.body.style.overflow = '';
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // MANAGE MEMBERS
  // ═══════════════════════════════════════════════════════════════════════════

  window.manageMembers = async function(companyId) {
    selectedCompany = companies.find(c => c.id === companyId);
    if (!selectedCompany) return;

    const modal = document.getElementById('manageMembersModal');
    const companyNameEl = document.getElementById('manageMembersCompanyName');
    const membersListEl = document.getElementById('currentMembersList');

    if (!modal) return;

    if (companyNameEl) {
      companyNameEl.textContent = selectedCompany.name;
    }

    // Render current members
    renderMembersList();

    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  };

  function renderMembersList() {
    const membersListEl = document.getElementById('currentMembersList');
    if (!membersListEl || !selectedCompany) return;

    const isOwner = selectedCompany.ownerId === currentUser.id || selectedCompany.owner_id === currentUser.id;
    const userRole = getUserRole(selectedCompany);
    const canManageRoles = isOwner || userRole === 'coowner';

    // Build members array with owner first
    const allMembers = [
      {
        ...selectedCompany.owner,
        role: 'owner',
        isOwner: true
      },
      ...(selectedCompany.members || []).map(m => ({
        ...m,
        isOwner: false
      }))
    ];

    membersListEl.innerHTML = allMembers.map(member => {
      const roleInfo = ROLES[member.role] || ROLES.member;
      const canModify = canManageRoles && !member.isOwner && member.id !== currentUser.id;

      return `
        <div class="member-row" data-member-id="${member.id || member.userId}">
          <div class="member-row__user">
            <div class="member-row__avatar" style="${member.isOwner ? `background: ${ROLES.owner.color};` : ''}">
              ${member.avatar 
                ? `<img src="${member.avatar}" alt="">` 
                : getInitials(member.nickname || 'Member')
              }
            </div>
            <div class="member-row__info">
              <span class="member-row__name">${escapeHtml(member.nickname || 'Unknown')}</span>
              <span class="member-row__email">${escapeHtml(member.email || '')}</span>
            </div>
          </div>
          <div class="member-row__role">
            ${canModify ? `
              <select class="form-select form-select--sm" onchange="updateMemberRole('${member.id || member.userId}', this.value)">
                <option value="member" ${member.role === 'member' ? 'selected' : ''}>Member</option>
                <option value="trusted" ${member.role === 'trusted' ? 'selected' : ''}>Trusted Member</option>
                ${isOwner ? `<option value="coowner" ${member.role === 'coowner' ? 'selected' : ''}>Co-owner</option>` : ''}
              </select>
            ` : `
              <span class="role-tag" style="background: ${roleInfo.color}20; color: ${roleInfo.color};">
                ${roleInfo.label}
              </span>
            `}
          </div>
          <div class="member-row__actions">
            ${canModify ? `
              <button class="btn btn--sm btn--ghost btn--danger" onclick="removeMember('${member.id || member.userId}')" title="Remove member">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                  <path d="M3 6h18"/>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
              </button>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  window.updateMemberRole = async function(memberId, newRole) {
    if (!selectedCompany) return;

    try {
      const members = selectedCompany.members || [];
      const memberIndex = members.findIndex(m => (m.id || m.userId) === memberId);
      
      if (memberIndex !== -1) {
        members[memberIndex].role = newRole;
        await PrismBin.updateCompany(selectedCompany.id, { members });
        selectedCompany.members = members;
        showToast('Success', 'Member role updated');
      }
    } catch (error) {
      console.error('[Companies] Failed to update member role:', error);
      showToast('Error', 'Failed to update member role');
      renderMembersList(); // Reset UI
    }
  };

  window.removeMember = async function(memberId) {
    if (!selectedCompany) return;

    const confirmed = await PrismUI?.showConfirm?.(
      'Remove Member',
      'Are you sure you want to remove this member from the company?',
      { confirmText: 'Remove', danger: true }
    );

    if (!confirmed) return;

    try {
      const members = (selectedCompany.members || []).filter(m => (m.id || m.userId) !== memberId);
      await PrismBin.updateCompany(selectedCompany.id, { members });
      selectedCompany.members = members;
      renderMembersList();
      showToast('Success', 'Member removed from company');
      
      // Update companies list
      const companyIndex = companies.findIndex(c => c.id === selectedCompany.id);
      if (companyIndex !== -1) {
        companies[companyIndex].members = members;
        renderCompanies();
      }
    } catch (error) {
      console.error('[Companies] Failed to remove member:', error);
      showToast('Error', 'Failed to remove member');
    }
  };

  // Member search
  let searchTimeout = null;
  function initMemberSearch() {
    const searchInput = document.getElementById('memberSearchInput');
    const resultsEl = document.getElementById('memberSearchResults');

    if (!searchInput) return;

    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.trim();
      
      clearTimeout(searchTimeout);
      
      if (query.length < 2) {
        resultsEl.innerHTML = '';
        return;
      }

      searchTimeout = setTimeout(async () => {
        try {
          const users = await PrismBin.getUsers();
          const existingMemberIds = [
            selectedCompany.ownerId,
            selectedCompany.owner_id,
            ...(selectedCompany.members || []).map(m => m.id || m.userId)
          ].filter(Boolean);

          const filteredUsers = users.filter(user => {
            if (existingMemberIds.includes(user.id)) return false;
            const nickname = (user.mcNickname || user.nickname || '').toLowerCase();
            const email = (user.email || '').toLowerCase();
            return nickname.includes(query.toLowerCase()) || email.includes(query.toLowerCase());
          }).slice(0, 5);

          if (filteredUsers.length === 0) {
            resultsEl.innerHTML = '<div class="search-empty">No users found</div>';
          } else {
            resultsEl.innerHTML = filteredUsers.map(user => `
              <div class="search-result" onclick="addMember('${user.id}', '${escapeHtml(user.mcNickname || user.nickname || 'User')}', '${escapeHtml(user.avatar || '')}', '${escapeHtml(user.email || '')}')">
                <div class="search-result__avatar">
                  ${user.avatar 
                    ? `<img src="${user.avatar}" alt="">` 
                    : getInitials(user.mcNickname || user.nickname)
                  }
                </div>
                <div class="search-result__info">
                  <span class="search-result__name">${escapeHtml(user.mcNickname || user.nickname || 'User')}</span>
                  <span class="search-result__email">${escapeHtml(user.email || '')}</span>
                </div>
                <button class="btn btn--sm btn--primary">Add</button>
              </div>
            `).join('');
          }
        } catch (error) {
          console.error('[Companies] Failed to search users:', error);
          resultsEl.innerHTML = '<div class="search-error">Failed to search users</div>';
        }
      }, 300);
    });
  }

  window.addMember = async function(userId, nickname, avatar, email) {
    if (!selectedCompany) return;

    try {
      const members = selectedCompany.members || [];
      members.push({
        id: userId,
        userId: userId,
        nickname: nickname,
        avatar: avatar || null,
        email: email || null,
        role: 'member',
        joinedAt: new Date().toISOString()
      });

      await PrismBin.updateCompany(selectedCompany.id, { members });
      selectedCompany.members = members;
      
      // Clear search
      document.getElementById('memberSearchInput').value = '';
      document.getElementById('memberSearchResults').innerHTML = '';
      
      renderMembersList();
      showToast('Success', `${nickname} added to company`);

      // Update companies list
      const companyIndex = companies.findIndex(c => c.id === selectedCompany.id);
      if (companyIndex !== -1) {
        companies[companyIndex].members = members;
        renderCompanies();
      }
    } catch (error) {
      console.error('[Companies] Failed to add member:', error);
      showToast('Error', 'Failed to add member');
    }
  };

  function closeMembersModal() {
    const modal = document.getElementById('manageMembersModal');
    if (modal) {
      modal.classList.remove('open');
      document.body.style.overflow = '';
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EVENT LISTENERS
  // ═══════════════════════════════════════════════════════════════════════════

  function setupEventListeners() {
    // Create company buttons
    document.getElementById('createCompanyBtn')?.addEventListener('click', openCreateCompanyModal);
    document.getElementById('createCompanyEmptyBtn')?.addEventListener('click', openCreateCompanyModal);

    // Create company form
    document.getElementById('createCompanyForm')?.addEventListener('submit', handleCreateCompany);

    // Logo upload
    document.getElementById('uploadLogoBtn')?.addEventListener('click', () => {
      document.getElementById('companyLogoInput')?.click();
    });
    document.getElementById('companyLogoInput')?.addEventListener('change', handleLogoUpload);

    // Modal close actions
    document.querySelectorAll('[data-action="close-company-modal"]').forEach(el => {
      el.addEventListener('click', closeCreateCompanyModal);
    });
    document.querySelectorAll('[data-action="close-details-modal"]').forEach(el => {
      el.addEventListener('click', closeDetailsModal);
    });
    document.querySelectorAll('[data-action="close-members-modal"]').forEach(el => {
      el.addEventListener('click', closeMembersModal);
    });

    // Logout
    document.querySelector('[data-action="sidebar-logout"]')?.addEventListener('click', () => {
      if (typeof AuthManager !== 'undefined' && AuthManager.logout) {
        AuthManager.logout();
      } else if (typeof PrismAuth !== 'undefined') {
        PrismAuth.logout();
      }
    });

    // Init member search
    initMemberSearch();

    // Escape key to close modals
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeCreateCompanyModal();
        closeDetailsModal();
        closeMembersModal();
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════════

  async function init() {
    console.log('[Companies] Initializing...');

    // Check auth
    if (typeof PrismAuth === 'undefined') {
      console.error('[Companies] PrismAuth not available');
      window.location.href = 'index.html';
      return;
    }

    currentUser = PrismAuth.getUser();
    if (!currentUser) {
      console.log('[Companies] Not logged in, redirecting...');
      window.location.href = 'index.html';
      return;
    }

    initSidebar();
    setupEventListeners();
    await loadCompanies();

    console.log('[Companies] Initialized');
  }

  // Wait for DOM and dependencies
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      // Wait a bit for PrismBin to be ready
      setTimeout(init, 100);
    });
  } else {
    setTimeout(init, 100);
  }
})();
