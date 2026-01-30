/**
 * PrismMTR Projects - JavaScript v2
 * 
 * FULLY INTEGRATED WITH SUPABASE
 * - All projects loaded from PrismBin.getProjects() (Supabase backend)
 * - All changes saved via Supabase proxy
 * - Categories: Building, Station, Line Section, Line
 * - Roles: Owner, Co-owner, Member
 * - Filters by category, role, and search
 */

(function() {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════════
  // DOM ELEMENTS
  // ═══════════════════════════════════════════════════════════════════════════

  const elements = {
    grid: document.getElementById('projectsGrid'),
    loading: document.getElementById('projectsLoading'),
    empty: document.getElementById('projectsEmpty'),
    search: document.getElementById('projectSearch'),
    filterCategory: document.getElementById('filterCategory'),
    filterRole: document.getElementById('filterRole'),
    createBtn: document.getElementById('createProjectBtn'),
    modal: document.getElementById('projectModal'),
    form: document.getElementById('projectFormEl'),
    submitBtn: document.getElementById('submitProjectBtn'),
    imageUpload: document.getElementById('imageUploadArea'),
    imageInput: document.getElementById('projectImage'),
    imagePlaceholder: document.getElementById('imagePlaceholder'),
    imagePreview: document.getElementById('imagePreview'),
    viewModal: document.getElementById('viewProjectModal'),
    viewContent: document.getElementById('projectView'),
    // Team members
    coownersList: document.getElementById('coownersList'),
    coownersEmpty: document.getElementById('coownersEmpty'),
    coownerInput: document.getElementById('coownerInput'),
    addCoownerBtn: document.getElementById('addCoownerBtn'),
    membersList: document.getElementById('membersList'),
    membersEmpty: document.getElementById('membersEmpty'),
    memberInput: document.getElementById('memberInput'),
    addMemberBtn: document.getElementById('addMemberBtn'),
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════════════════

  let projects = [];
  let currentImage = null;
  let currentUser = null;
  let isLoading = false;
  
  // Team members state for form
  let formCoowners = [];
  let formMembers = [];

  // Category labels for display
  const CATEGORY_LABELS = {
    building: 'Building',
    station: 'Station',
    line_section: 'Line Section',
    line: 'Line',
  };

  // Status labels
  const STATUS_LABELS = {
    active: 'Active',
    planning: 'Planning',
    completed: 'Completed',
    paused: 'Paused',
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // DATA LOADING (FROM JSONBIN)
  // ═══════════════════════════════════════════════════════════════════════════

  async function loadProjects() {
    if (isLoading) return;
    isLoading = true;

    try {
      showLoading(true);
      
      // Load from Supabase via PrismBin alias
      projects = await PrismBin.getProjects(true);
      
      console.log('[Projects] Loaded', projects.length, 'projects');
      
      render();
    } catch (error) {
      console.error('[Projects] Failed to load:', error);
      showError('Failed to load projects. Please try again.');
    } finally {
      isLoading = false;
      showLoading(false);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FILTERING & SEARCH
  // ═══════════════════════════════════════════════════════════════════════════

  function getFilteredProjects() {
    const query = elements.search?.value?.toLowerCase().trim() || '';
    const category = elements.filterCategory?.value || '';
    const roleFilter = elements.filterRole?.value || '';
    const userId = currentUser?.id;

    return projects.filter(p => {
      // Text search
      const matchesQuery = !query || 
        p.name?.toLowerCase().includes(query) || 
        p.description?.toLowerCase().includes(query) ||
        p.owner?.nickname?.toLowerCase().includes(query);
      
      // Category filter
      const matchesCategory = !category || p.category === category;
      
      // Role filter
      let matchesRole = true;
      if (roleFilter && userId) {
        switch (roleFilter) {
          case 'mine':
            matchesRole = 
              p.owner?.id === userId ||
              p.coowners?.some(c => c.id === userId) ||
              p.members?.some(m => m.id === userId);
            break;
          case 'owner':
            matchesRole = p.owner?.id === userId;
            break;
          case 'coowner':
            matchesRole = p.coowners?.some(c => c.id === userId);
            break;
          case 'member':
            matchesRole = p.members?.some(m => m.id === userId);
            break;
        }
      }
      
      return matchesQuery && matchesCategory && matchesRole;
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  function render() {
    const filtered = getFilteredProjects();

    // Remove existing cards
    elements.grid?.querySelectorAll('.project-card').forEach(el => el.remove());

    if (filtered.length === 0) {
      if (elements.empty) elements.empty.style.display = 'flex';
      return;
    }

    if (elements.empty) elements.empty.style.display = 'none';

    // Sort by date (newest first)
    filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    filtered.forEach(project => {
      elements.grid?.appendChild(createCard(project));
    });
  }

  function createCard(project) {
    const card = document.createElement('div');
    card.className = 'project-card';
    card.dataset.id = project.id;

    const initial = (project.owner?.nickname || 'U').charAt(0).toUpperCase();
    const memberCount = 1 + (project.coowners?.length || 0) + (project.members?.length || 0);
    const categoryLabel = CATEGORY_LABELS[project.category] || project.category;
    const statusClass = project.status || 'active';

    card.innerHTML = `
      <div class="project-card__image">
        ${project.image 
          ? `<img src="${project.image}" alt="${escapeHtml(project.name)}">`
          : `<svg class="project-card__image-placeholder" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>`
        }
        <span class="project-card__status project-card__status--${statusClass}">${STATUS_LABELS[project.status] || 'Active'}</span>
      </div>
      <div class="project-card__body">
        <span class="project-card__category">${categoryLabel}</span>
        <h3 class="project-card__title">${escapeHtml(project.name)}</h3>
        <p class="project-card__description">${escapeHtml(project.description || '')}</p>
        <div class="project-card__footer">
          <div class="project-card__author">
            <div class="project-card__avatar">${initial}</div>
            <span class="project-card__author-name">${escapeHtml(project.owner?.nickname || 'Unknown')}</span>
          </div>
          <div class="project-card__members">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            <span>${memberCount}</span>
          </div>
        </div>
      </div>
    `;

    card.addEventListener('click', () => openViewModal(project));

    return card;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VIEW MODAL
  // ═══════════════════════════════════════════════════════════════════════════

  function openViewModal(project) {
    if (!elements.viewContent) return;

    const initial = (project.owner?.nickname || 'U').charAt(0).toUpperCase();
    const categoryLabel = CATEGORY_LABELS[project.category] || project.category;
    const statusLabel = STATUS_LABELS[project.status] || 'Active';
    
    // Check if current user can edit
    const canEdit = currentUser && (
      project.owner?.id === currentUser.id ||
      project.coowners?.some(c => c.id === currentUser.id) ||
      PrismBin.hasPermission(currentUser.role, 'mod')
    );

    // Build members list
    const allMembers = [
      { ...project.owner, role: 'Owner' },
      ...(project.coowners || []).map(c => ({ ...c, role: 'Co-owner' })),
      ...(project.members || []).map(m => ({ ...m, role: 'Member' })),
    ];

    elements.viewContent.innerHTML = `
      <div class="project-view__image">
        ${project.image 
          ? `<img src="${project.image}" alt="${escapeHtml(project.name)}">`
          : `<div style="display:flex;align-items:center;justify-content:center;height:100%;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:48px;height:48px;color:var(--color-text-muted);opacity:0.5;">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
            </div>`
        }
      </div>
      
      <div class="project-view__header">
        <div class="project-view__badges">
          <span class="project-view__category">${categoryLabel}</span>
          <span class="project-view__status project-view__status--${project.status}">${statusLabel}</span>
        </div>
        <h2 class="project-view__title">${escapeHtml(project.name)}</h2>
        <div class="project-view__meta">
          <span class="project-view__meta-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
            Created ${formatDate(project.createdAt)}
          </span>
          ${project.updatedAt !== project.createdAt ? `
            <span class="project-view__meta-item">
              Updated ${formatDate(project.updatedAt)}
            </span>
          ` : ''}
        </div>
      </div>
      
      <p class="project-view__description">${escapeHtml(project.description || 'No description provided.')}</p>
      
      <div class="project-view__section">
        <h4 class="project-view__section-title">Team (${allMembers.length})</h4>
        <div class="project-view__members">
          ${allMembers.map(m => `
            <div class="project-view__member">
              <div class="project-view__member-avatar">${(m.nickname || 'U').charAt(0).toUpperCase()}</div>
              <div class="project-view__member-info">
                <span class="project-view__member-name">${escapeHtml(m.nickname || 'Unknown')}</span>
                <span class="project-view__member-role project-view__member-role--${m.role.toLowerCase().replace('-', '')}">${m.role}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
      
      ${canEdit ? `
        <div class="project-view__actions">
          <button class="btn btn--ghost" data-action="edit-project" data-id="${project.id}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Edit Project
          </button>
          ${project.owner?.id === currentUser?.id || PrismBin.hasPermission(currentUser?.role, 'admin') ? `
            <button class="btn btn--ghost btn--danger" data-action="delete-project" data-id="${project.id}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
              Delete
            </button>
          ` : ''}
        </div>
      ` : ''}
    `;

    elements.viewModal?.classList.add('open');
  }

  function closeViewModal() {
    elements.viewModal?.classList.remove('open');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CREATE/EDIT MODAL
  // ═══════════════════════════════════════════════════════════════════════════

  function openCreateModal(projectId = null) {
    resetForm();
    
    if (projectId) {
      // Edit mode
      const project = projects.find(p => p.id === projectId);
      if (project) {
        document.getElementById('projectId').value = project.id;
        document.getElementById('projectName').value = project.name || '';
        document.getElementById('projectDescription').value = project.description || '';
        document.getElementById('projectCategory').value = project.category || '';
        document.getElementById('projectStatus').value = project.status || 'active';
        
        if (project.image) {
          currentImage = project.image;
          if (elements.imagePreview) {
            elements.imagePreview.src = project.image;
            elements.imagePreview.style.display = 'block';
          }
          if (elements.imagePlaceholder) {
            elements.imagePlaceholder.style.display = 'none';
          }
        }
        
        // Load team members
        formCoowners = [...(project.coowners || [])];
        formMembers = [...(project.members || [])];
        renderTeamList('coowner');
        renderTeamList('member');
        
        if (elements.submitBtn) {
          elements.submitBtn.textContent = 'Save Changes';
        }
      }
    } else {
      if (elements.submitBtn) {
        elements.submitBtn.textContent = 'Create Project';
      }
    }
    
    elements.modal?.classList.add('open');
  }

  function closeCreateModal() {
    elements.modal?.classList.remove('open');
    resetForm();
  }

  function resetForm() {
    elements.form?.reset();
    document.getElementById('projectId').value = '';
    currentImage = null;
    if (elements.imagePlaceholder) elements.imagePlaceholder.style.display = 'flex';
    if (elements.imagePreview) elements.imagePreview.style.display = 'none';
    resetTeamLists();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // IMAGE HANDLING
  // ═══════════════════════════════════════════════════════════════════════════

  function handleImageUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Error', 'Please select an image file.', 'error');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      showToast('Error', 'Image must be under 2MB.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      currentImage = e.target.result;
      if (elements.imagePreview) {
        elements.imagePreview.src = currentImage;
        elements.imagePreview.style.display = 'block';
      }
      if (elements.imagePlaceholder) {
        elements.imagePlaceholder.style.display = 'none';
      }
    };
    reader.readAsDataURL(file);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TEAM MEMBERS MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  function addTeamMember(type) {
    const input = type === 'coowner' ? elements.coownerInput : elements.memberInput;
    const list = type === 'coowner' ? formCoowners : formMembers;
    const otherList = type === 'coowner' ? formMembers : formCoowners;
    
    const username = input?.value?.trim();
    if (!username) {
      showToast('Error', 'Please enter a username.', 'error');
      return;
    }
    
    // Validate: not the current user
    const currentNickname = currentUser?.nickname || currentUser?.mcNickname || '';
    if (username.toLowerCase() === currentNickname.toLowerCase()) {
      showToast('Error', 'You are already the owner of this project.', 'error');
      input.value = '';
      return;
    }
    
    // Validate: not already in this list
    if (list.some(m => m.nickname.toLowerCase() === username.toLowerCase())) {
      showToast('Error', `"${username}" is already a ${type === 'coowner' ? 'co-owner' : 'member'}.`, 'error');
      return;
    }
    
    // Validate: not in the other list
    if (otherList.some(m => m.nickname.toLowerCase() === username.toLowerCase())) {
      showToast('Error', `"${username}" is already in the other list.`, 'error');
      return;
    }
    
    // Add to list
    list.push({
      id: 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      nickname: username
    });
    
    input.value = '';
    renderTeamList(type);
    showToast('Added', `"${username}" added as ${type === 'coowner' ? 'co-owner' : 'member'}.`, 'success');
  }

  function removeTeamMember(type, nickname) {
    const list = type === 'coowner' ? formCoowners : formMembers;
    const index = list.findIndex(m => m.nickname === nickname);
    
    if (index !== -1) {
      list.splice(index, 1);
      renderTeamList(type);
      showToast('Removed', `"${nickname}" has been removed.`, 'info');
    }
  }

  function renderTeamList(type) {
    const list = type === 'coowner' ? formCoowners : formMembers;
    const container = type === 'coowner' ? elements.coownersList : elements.membersList;
    const emptyEl = type === 'coowner' ? elements.coownersEmpty : elements.membersEmpty;
    
    if (!container) return;
    
    // Remove all existing members (but keep the empty placeholder)
    container.querySelectorAll('.team-chip').forEach(el => el.remove());
    
    if (list.length === 0) {
      if (emptyEl) emptyEl.style.display = 'flex';
    } else {
      if (emptyEl) emptyEl.style.display = 'none';
      
      list.forEach(member => {
        const initial = (member.nickname || 'U').charAt(0).toUpperCase();
        const chipEl = document.createElement('div');
        chipEl.className = `team-chip${type === 'coowner' ? ' team-chip--coowner' : ''}`;
        chipEl.innerHTML = `
          <span class="team-chip__avatar">${initial}</span>
          <span class="team-chip__name">${escapeHtml(member.nickname)}</span>
          <button type="button" class="team-chip__remove" data-type="${type}" data-nickname="${escapeHtml(member.nickname)}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        `;
        container.appendChild(chipEl);
      });
    }
  }

  function resetTeamLists() {
    formCoowners = [];
    formMembers = [];
    renderTeamList('coowner');
    renderTeamList('member');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FORM SUBMISSION
  // ═══════════════════════════════════════════════════════════════════════════

  async function handleSubmit(e) {
    e.preventDefault();

    if (!currentUser) {
      showToast('Error', 'You must be logged in to create a project.', 'error');
      return;
    }

    const projectId = document.getElementById('projectId')?.value;
    const name = document.getElementById('projectName')?.value?.trim();
    const description = document.getElementById('projectDescription')?.value?.trim();
    const category = document.getElementById('projectCategory')?.value;
    const status = document.getElementById('projectStatus')?.value || 'active';

    if (!name || !description || !category) {
      showToast('Error', 'Please fill in all required fields.', 'error');
      return;
    }

    // Validate category
    if (!Object.keys(CATEGORY_LABELS).includes(category)) {
      showToast('Error', 'Invalid category selected.', 'error');
      return;
    }

    try {
      elements.submitBtn.disabled = true;
      elements.submitBtn.textContent = projectId ? 'Saving...' : 'Creating...';

      if (projectId) {
        // Update existing project
        await PrismBin.updateProject(projectId, {
          name,
          description,
          category,
          status,
          image: currentImage,
          coowners: formCoowners,
          members: formMembers,
        });
        
        showToast('Success', `"${name}" has been updated!`, 'success');
      } else {
        // Create new project
        await PrismBin.createProject({
          name,
          description,
          category,
          status,
          image: currentImage,
          owner: {
            id: currentUser.id,
            nickname: currentUser.nickname || currentUser.mcNickname || currentUser.email || 'User',
          },
          coowners: formCoowners,
          members: formMembers,
        });
        
        showToast('Success', `"${name}" has been created!`, 'success');
      }

      closeCreateModal();
      await loadProjects();

    } catch (error) {
      console.error('[Projects] Save failed:', error);
      showToast('Error', error.message || 'Failed to save project.', 'error');
    } finally {
      elements.submitBtn.disabled = false;
      elements.submitBtn.textContent = projectId ? 'Save Changes' : 'Create Project';
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DELETE PROJECT
  // ═══════════════════════════════════════════════════════════════════════════

  async function handleDeleteProject(projectId) {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const confirmed = await PrismUI.showConfirm(
      'Delete Project',
      `Are you sure you want to delete "${project.name}"? This action cannot be undone.`,
      { confirmText: 'Delete', danger: true }
    );
    if (!confirmed) return;

    try {
      await PrismBin.deleteProject(projectId);
      showToast('Deleted', `"${project.name}" has been deleted.`, 'success');
      closeViewModal();
      await loadProjects();
    } catch (error) {
      console.error('[Projects] Delete failed:', error);
      showToast('Error', 'Failed to delete project.', 'error');
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

  function formatDate(dateStr) {
    if (!dateStr) return 'Unknown';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function showLoading(show) {
    if (elements.loading) {
      elements.loading.style.display = show ? 'flex' : 'none';
    }
  }

  function showError(message) {
    if (elements.empty) {
      elements.empty.innerHTML = `
        <div class="projects-empty__icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
        <h3>Error</h3>
        <p>${escapeHtml(message)}</p>
        <button class="btn btn--primary" onclick="location.reload()">Retry</button>
      `;
      elements.empty.style.display = 'flex';
    }
  }

  function showToast(title, message, type = 'info') {
    if (window.PrismUI?.showToast) {
      window.PrismUI.showToast(title, message, type);
    } else {
      console.log(`[${type.toUpperCase()}] ${title}: ${message}`);
    }
  }

  function debounce(fn, delay) {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn(...args), delay);
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EVENT LISTENERS
  // ═══════════════════════════════════════════════════════════════════════════

  function setupEventListeners() {
    // Search & filter (debounced)
    elements.search?.addEventListener('input', debounce(render, 300));
    elements.filterCategory?.addEventListener('change', render);
    elements.filterRole?.addEventListener('change', render);

    // Create button
    elements.createBtn?.addEventListener('click', () => openCreateModal());

    // Image upload
    elements.imageUpload?.addEventListener('click', () => elements.imageInput?.click());
    elements.imageInput?.addEventListener('change', handleImageUpload);

    // Form
    elements.form?.addEventListener('submit', handleSubmit);

    // Team members
    elements.addCoownerBtn?.addEventListener('click', () => addTeamMember('coowner'));
    elements.addMemberBtn?.addEventListener('click', () => addTeamMember('member'));
    
    // Enter key on team input
    elements.coownerInput?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addTeamMember('coowner');
      }
    });
    elements.memberInput?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addTeamMember('member');
      }
    });

    // Modal close actions & project actions
    document.addEventListener('click', (e) => {
      if (e.target.matches('[data-action="close-project-modal"]')) {
        closeCreateModal();
      }
      if (e.target.matches('[data-action="close-view-modal"]')) {
        closeViewModal();
      }
      if (e.target.matches('[data-action="edit-project"]') || e.target.closest('[data-action="edit-project"]')) {
        const btn = e.target.closest('[data-action="edit-project"]');
        const projectId = btn?.dataset.id;
        if (projectId) {
          closeViewModal();
          setTimeout(() => openCreateModal(projectId), 200);
        }
      }
      if (e.target.matches('[data-action="delete-project"]') || e.target.closest('[data-action="delete-project"]')) {
        const btn = e.target.closest('[data-action="delete-project"]');
        const projectId = btn?.dataset.id;
        if (projectId) {
          handleDeleteProject(projectId);
        }
      }
      
      // Team chip remove button
      if (e.target.matches('.team-chip__remove') || e.target.closest('.team-chip__remove')) {
        const btn = e.target.closest('.team-chip__remove');
        const type = btn?.dataset.type;
        const nickname = btn?.dataset.nickname;
        if (type && nickname) {
          removeTeamMember(type, nickname);
        }
      }
    });

    // Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeCreateModal();
        closeViewModal();
      }
    });

    // Auth state changes
    window.addEventListener('prism:auth:changed', (e) => {
      currentUser = e.detail?.user || PrismAuth?.getUser();
      updateAuthUI();
    });

    window.addEventListener('prism:logout', () => {
      currentUser = null;
      updateAuthUI();
    });
  }

  function updateAuthUI() {
    const isLoggedIn = !!currentUser;

    // Hide "New Project" button for ALL users (both logged in and logged out)
    // Users should use Dashboard to create projects instead
    if (elements.createBtn) {
      elements.createBtn.style.display = 'none';
    }

    // Re-render to update edit buttons
    render();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════════

  async function init() {
    if (document.body.dataset.page !== 'projects') return;

    console.log('[Projects] Initializing...');

    // Get current user
    currentUser = PrismAuth?.getUser?.() || null;

    setupEventListeners();
    updateAuthUI();

    // Load projects from JSONBin
    await loadProjects();

    // Check for ?action=create parameter (from Dashboard)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('action') === 'create' && currentUser) {
      // Clear the URL parameter without reload
      window.history.replaceState({}, '', window.location.pathname);
      // Open the create modal
      setTimeout(() => openCreateModal(), 300);
    }

    console.log('[Projects] Page initialized');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 100));
  } else {
    setTimeout(init, 100);
  }

})();
