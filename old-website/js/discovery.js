/* ═══════════════════════════════════════════════════════════════════════════
   PrismMTR Discovery Page JavaScript

   Unified content exploration for lines, stations, buildings, projects, and companies
   ═══════════════════════════════════════════════════════════════════════════ */

(function() {
  'use strict';

  // ─────────────────────────────────────────────────────────────────────────
  // State
  // ─────────────────────────────────────────────────────────────────────────
  let allContent = [];
  let filteredContent = [];
  let currentTab = 'all';
  let currentSort = 'newest';
  let currentView = 'grid';
  let searchQuery = '';
  let currentPage = 1;
  const ITEMS_PER_PAGE = 12;

  // Content type configuration
  const CONTENT_TYPES = {
    line: {
      label: 'Line',
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
        <line x1="4" y1="22" x2="4" y2="15"/>
      </svg>`,
      color: '#8b5cf6'
    },
    station: {
      label: 'Station',
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>`,
      color: '#06b6d4'
    },
    building: {
      label: 'Building',
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M3 21h18"/>
        <path d="M5 21V7l8-4v18"/>
        <path d="M19 21V11l-6-4"/>
      </svg>`,
      color: '#f59e0b'
    },
    project: {
      label: 'Project',
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
      </svg>`,
      color: '#10b981'
    },
    company: {
      label: 'Company',
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M3 21h18"/>
        <path d="M9 21v-8H5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2h-4v8"/>
        <path d="M5 11V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v4"/>
        <circle cx="12" cy="3" r="1"/>
      </svg>`,
      color: '#ec4899'
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // DOM Elements
  // ─────────────────────────────────────────────────────────────────────────
  const elements = {
    globalSearch: document.getElementById('globalSearch'),
    sortSelect: document.getElementById('sortSelect'),
    discoveryGrid: document.getElementById('discoveryGrid'),
    discoveryLoading: document.getElementById('discoveryLoading'),
    discoveryEmpty: document.getElementById('discoveryEmpty'),
    emptyMessage: document.getElementById('emptyMessage'),
    resultsText: document.getElementById('resultsText'),
    loadMoreSection: document.getElementById('loadMoreSection'),
    loadMoreBtn: document.getElementById('loadMoreBtn'),
    detailModal: document.getElementById('detailModal'),
    detailView: document.getElementById('detailView'),
    // Tab counts
    linesCount: document.getElementById('linesCount'),
    stationsCount: document.getElementById('stationsCount'),
    buildingsCount: document.getElementById('buildingsCount'),
    projectsCount: document.getElementById('projectsCount'),
    companiesCount: document.getElementById('companiesCount'),
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Initialize
  // ─────────────────────────────────────────────────────────────────────────
  async function init() {
    console.log('[Discovery] Initializing...');

    setupEventListeners();
    await loadAllContent();

    console.log('[Discovery] Ready');
  }

  function setupEventListeners() {
    // Tab switching
    document.querySelectorAll('.discovery-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.discovery-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentTab = tab.dataset.tab;
        currentPage = 1;
        filterAndRender();
      });
    });

    // Search
    if (elements.globalSearch) {
      elements.globalSearch.addEventListener('input', debounce((e) => {
        searchQuery = e.target.value.trim().toLowerCase();
        currentPage = 1;
        filterAndRender();
      }, 300));

      // Keyboard shortcut for search
      document.addEventListener('keydown', (e) => {
        if (e.key === '/' && document.activeElement !== elements.globalSearch) {
          e.preventDefault();
          elements.globalSearch.focus();
        }
        if (e.key === 'Escape' && document.activeElement === elements.globalSearch) {
          elements.globalSearch.blur();
        }
      });
    }

    // Sort
    if (elements.sortSelect) {
      elements.sortSelect.addEventListener('change', (e) => {
        currentSort = e.target.value;
        currentPage = 1;
        filterAndRender();
      });
    }

    // View toggle
    document.querySelectorAll('.view-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentView = btn.dataset.view;
        updateGridView();
      });
    });

    // Load more
    if (elements.loadMoreBtn) {
      elements.loadMoreBtn.addEventListener('click', () => {
        currentPage++;
        renderContent(true);
      });
    }

    // Detail modal close
    document.querySelectorAll('[data-action="close-detail-modal"]').forEach(el => {
      el.addEventListener('click', closeDetailModal);
    });

    // Escape to close modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && elements.detailModal?.classList.contains('active')) {
        closeDetailModal();
      }
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Data Loading
  // ─────────────────────────────────────────────────────────────────────────
  async function loadAllContent() {
    showLoading(true);

    try {
      // Load all content types in parallel
      const [companyContent, projects, companies, users] = await Promise.all([
        PrismBin.getCompanyContent(),
        PrismBin.getProjects(),
        PrismBin.getCompanies(),
        PrismBin.getUsers()
      ]);

      // Create user lookup map
      const userMap = {};
      users.forEach(u => userMap[u.id] = u);

      // Create company lookup map
      const companyMap = {};
      companies.forEach(c => companyMap[c.id] = c);

      allContent = [];

      // Process lines
      const lines = companyContent.lines || [];
      lines.forEach(line => {
        allContent.push({
          ...line,
          type: 'line',
          searchText: `${line.name} ${line.description || ''} ${line.color || ''}`.toLowerCase(),
          createdAt: line.createdAt || Date.now(),
          company: companyMap[line.companyId],
          creator: userMap[line.createdBy]
        });
      });

      // Process stations
      const stations = companyContent.stations || [];
      stations.forEach(station => {
        allContent.push({
          ...station,
          type: 'station',
          searchText: `${station.name} ${station.description || ''} ${station.address || ''}`.toLowerCase(),
          createdAt: station.createdAt || Date.now(),
          company: companyMap[station.companyId],
          creator: userMap[station.createdBy]
        });
      });

      // Process buildings
      const buildings = companyContent.buildings || [];
      buildings.forEach(building => {
        allContent.push({
          ...building,
          type: 'building',
          searchText: `${building.name} ${building.description || ''} ${building.address || ''}`.toLowerCase(),
          createdAt: building.createdAt || Date.now(),
          company: companyMap[building.companyId],
          creator: userMap[building.createdBy]
        });
      });

      // Process projects
      projects.forEach(project => {
        allContent.push({
          ...project,
          type: 'project',
          searchText: `${project.name} ${project.description || ''} ${project.category || ''}`.toLowerCase(),
          createdAt: project.createdAt || Date.now(),
          creator: userMap[project.ownerId]
        });
      });

      // Process companies (visible ones only)
      companies.filter(c => c.visibility !== 'private').forEach(company => {
        allContent.push({
          ...company,
          type: 'company',
          searchText: `${company.name} ${company.description || ''} ${company.industry || ''}`.toLowerCase(),
          createdAt: company.createdAt || Date.now(),
          creator: userMap[company.ownerId]
        });
      });

      console.log(`[Discovery] Loaded ${allContent.length} total items`);

      updateCounts();
      filterAndRender();

    } catch (error) {
      console.error('[Discovery] Failed to load content:', error);
      showEmpty('Failed to load content. Please try again.');
    } finally {
      showLoading(false);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Filtering & Sorting
  // ─────────────────────────────────────────────────────────────────────────
  function filterAndRender() {
    // Filter by tab
    if (currentTab === 'all') {
      filteredContent = [...allContent];
    } else {
      const typeMap = {
        lines: 'line',
        stations: 'station',
        buildings: 'building',
        projects: 'project',
        companies: 'company'
      };
      const filterType = typeMap[currentTab];
      filteredContent = allContent.filter(item => item.type === filterType);
    }

    // Filter by search
    if (searchQuery) {
      filteredContent = filteredContent.filter(item =>
        item.searchText.includes(searchQuery)
      );
    }

    // Sort
    filteredContent.sort((a, b) => {
      switch (currentSort) {
        case 'newest':
          return (b.createdAt || 0) - (a.createdAt || 0);
        case 'oldest':
          return (a.createdAt || 0) - (b.createdAt || 0);
        case 'name':
          return (a.name || '').localeCompare(b.name || '');
        case 'name_desc':
          return (b.name || '').localeCompare(a.name || '');
        default:
          return 0;
      }
    });

    renderContent();
    updateResultsText();
  }

  function updateCounts() {
    const counts = {
      lines: 0,
      stations: 0,
      buildings: 0,
      projects: 0,
      companies: 0
    };

    allContent.forEach(item => {
      if (item.type === 'line') counts.lines++;
      else if (item.type === 'station') counts.stations++;
      else if (item.type === 'building') counts.buildings++;
      else if (item.type === 'project') counts.projects++;
      else if (item.type === 'company') counts.companies++;
    });

    if (elements.linesCount) elements.linesCount.textContent = counts.lines;
    if (elements.stationsCount) elements.stationsCount.textContent = counts.stations;
    if (elements.buildingsCount) elements.buildingsCount.textContent = counts.buildings;
    if (elements.projectsCount) elements.projectsCount.textContent = counts.projects;
    if (elements.companiesCount) elements.companiesCount.textContent = counts.companies;
  }

  function updateResultsText() {
    if (!elements.resultsText) return;

    const total = filteredContent.length;
    const showing = Math.min(currentPage * ITEMS_PER_PAGE, total);

    if (total === 0) {
      elements.resultsText.textContent = 'No results found';
    } else if (searchQuery) {
      elements.resultsText.textContent = `Found ${total} result${total !== 1 ? 's' : ''} for "${searchQuery}"`;
    } else {
      elements.resultsText.textContent = `Showing ${showing} of ${total} item${total !== 1 ? 's' : ''}`;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Rendering
  // ─────────────────────────────────────────────────────────────────────────
  function renderContent(append = false) {
    if (!elements.discoveryGrid) return;

    const startIndex = append ? (currentPage - 1) * ITEMS_PER_PAGE : 0;
    const endIndex = currentPage * ITEMS_PER_PAGE;
    const itemsToShow = filteredContent.slice(startIndex, endIndex);

    if (!append) {
      // Clear existing content (except loading element)
      const cards = elements.discoveryGrid.querySelectorAll('.discovery-card');
      cards.forEach(card => card.remove());
    }

    if (filteredContent.length === 0) {
      showEmpty(searchQuery ? `No results found for "${searchQuery}"` : 'No content available yet');
      return;
    }

    hideEmpty();

    // Render cards
    itemsToShow.forEach(item => {
      const card = createDiscoveryCard(item);
      elements.discoveryGrid.appendChild(card);
    });

    // Update load more button visibility
    const hasMore = endIndex < filteredContent.length;
    if (elements.loadMoreSection) {
      elements.loadMoreSection.style.display = hasMore ? 'flex' : 'none';
    }

    updateGridView();
  }

  function createDiscoveryCard(item) {
    const config = CONTENT_TYPES[item.type];
    const card = document.createElement('div');
    card.className = 'discovery-card';
    card.dataset.type = item.type;
    card.dataset.id = item.id;

    // Get image or placeholder
    const imageUrl = item.imageUrl || item.coverImage || item.logo || null;
    const imageHtml = imageUrl
      ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(item.name)}" class="discovery-card__image">`
      : `<div class="discovery-card__placeholder">${config.icon}</div>`;

    // Get subtitle based on type
    let subtitle = '';
    if (item.type === 'line' && item.color) {
      subtitle = `<span class="discovery-card__color" style="background: ${item.color}"></span>`;
    } else if (item.type === 'station' && item.address) {
      subtitle = escapeHtml(item.address);
    } else if (item.type === 'building' && item.address) {
      subtitle = escapeHtml(item.address);
    } else if (item.type === 'project' && item.category) {
      subtitle = capitalizeFirst(item.category.replace('_', ' '));
    } else if (item.type === 'company' && item.industry) {
      subtitle = escapeHtml(item.industry);
    }

    // Get meta info
    const creatorName = item.creator?.nickname || item.creator?.username || 'Unknown';
    const companyName = item.company?.name || '';
    const date = item.createdAt ? formatRelativeTime(item.createdAt) : '';

    card.innerHTML = `
      <div class="discovery-card__media">
        ${imageHtml}
        <span class="discovery-card__type" style="--type-color: ${config.color}">
          ${config.icon}
          ${config.label}
        </span>
      </div>
      <div class="discovery-card__content">
        <h3 class="discovery-card__title">${escapeHtml(item.name)}</h3>
        ${subtitle ? `<p class="discovery-card__subtitle">${subtitle}</p>` : ''}
        ${item.description ? `<p class="discovery-card__description">${escapeHtml(truncate(item.description, 100))}</p>` : ''}
        <div class="discovery-card__meta">
          <span class="discovery-card__author">
            ${getAvatarHtml(item.creator, 18)}
            ${escapeHtml(creatorName)}
          </span>
          ${companyName ? `<span class="discovery-card__company">${escapeHtml(companyName)}</span>` : ''}
          ${date ? `<span class="discovery-card__date">${date}</span>` : ''}
        </div>
      </div>
    `;

    card.addEventListener('click', () => {
      // For companies, navigate to dedicated page
      if (item.type === 'company') {
        window.location.href = `company.html?id=${item.id}`;
      } else if (item.type === 'project') {
        window.location.href = `projects.html?id=${item.id}`;
      } else {
        openDetailModal(item);
      }
    });

    return card;
  }

  function updateGridView() {
    if (!elements.discoveryGrid) return;

    elements.discoveryGrid.classList.remove('discovery-grid--list');
    if (currentView === 'list') {
      elements.discoveryGrid.classList.add('discovery-grid--list');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Detail Modal
  // ─────────────────────────────────────────────────────────────────────────
  function openDetailModal(item) {
    if (!elements.detailModal || !elements.detailView) return;

    const config = CONTENT_TYPES[item.type];
    const imageUrl = item.imageUrl || item.coverImage || item.logo || null;
    const creatorName = item.creator?.nickname || item.creator?.username || 'Unknown';
    const companyName = item.company?.name || '';
    const date = item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '';

    // Build detail content based on type
    let detailsHtml = '';

    if (item.type === 'line') {
      detailsHtml = `
        ${item.color ? `<div class="detail-field">
          <span class="detail-field__label">Color</span>
          <span class="detail-field__value">
            <span class="color-preview" style="background: ${item.color}"></span>
            ${item.color}
          </span>
        </div>` : ''}
        ${item.length ? `<div class="detail-field">
          <span class="detail-field__label">Length</span>
          <span class="detail-field__value">${item.length}</span>
        </div>` : ''}
        ${item.stationCount ? `<div class="detail-field">
          <span class="detail-field__label">Stations</span>
          <span class="detail-field__value">${item.stationCount}</span>
        </div>` : ''}
      `;
    } else if (item.type === 'station') {
      detailsHtml = `
        ${item.address ? `<div class="detail-field">
          <span class="detail-field__label">Address</span>
          <span class="detail-field__value">${escapeHtml(item.address)}</span>
        </div>` : ''}
        ${item.lines ? `<div class="detail-field">
          <span class="detail-field__label">Lines</span>
          <span class="detail-field__value">${escapeHtml(item.lines)}</span>
        </div>` : ''}
        ${item.facilities ? `<div class="detail-field">
          <span class="detail-field__label">Facilities</span>
          <span class="detail-field__value">${escapeHtml(item.facilities)}</span>
        </div>` : ''}
      `;
    } else if (item.type === 'building') {
      detailsHtml = `
        ${item.address ? `<div class="detail-field">
          <span class="detail-field__label">Address</span>
          <span class="detail-field__value">${escapeHtml(item.address)}</span>
        </div>` : ''}
        ${item.floors ? `<div class="detail-field">
          <span class="detail-field__label">Floors</span>
          <span class="detail-field__value">${item.floors}</span>
        </div>` : ''}
        ${item.purpose ? `<div class="detail-field">
          <span class="detail-field__label">Purpose</span>
          <span class="detail-field__value">${escapeHtml(item.purpose)}</span>
        </div>` : ''}
      `;
    } else if (item.type === 'project') {
      detailsHtml = `
        ${item.category ? `<div class="detail-field">
          <span class="detail-field__label">Category</span>
          <span class="detail-field__value">${capitalizeFirst(item.category.replace('_', ' '))}</span>
        </div>` : ''}
        ${item.status ? `<div class="detail-field">
          <span class="detail-field__label">Status</span>
          <span class="detail-field__value status-badge status-badge--${item.status}">${capitalizeFirst(item.status)}</span>
        </div>` : ''}
        ${item.coowners?.length ? `<div class="detail-field">
          <span class="detail-field__label">Co-owners</span>
          <span class="detail-field__value">${item.coowners.length}</span>
        </div>` : ''}
        ${item.members?.length ? `<div class="detail-field">
          <span class="detail-field__label">Members</span>
          <span class="detail-field__value">${item.members.length}</span>
        </div>` : ''}
      `;
    } else if (item.type === 'company') {
      detailsHtml = `
        ${item.industry ? `<div class="detail-field">
          <span class="detail-field__label">Industry</span>
          <span class="detail-field__value">${escapeHtml(item.industry)}</span>
        </div>` : ''}
        ${item.memberCount ? `<div class="detail-field">
          <span class="detail-field__label">Members</span>
          <span class="detail-field__value">${item.memberCount}</span>
        </div>` : ''}
        ${item.visibility ? `<div class="detail-field">
          <span class="detail-field__label">Visibility</span>
          <span class="detail-field__value">${capitalizeFirst(item.visibility)}</span>
        </div>` : ''}
      `;
    }

    elements.detailView.innerHTML = `
      <div class="detail-header">
        ${imageUrl
          ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(item.name)}" class="detail-header__image">`
          : `<div class="detail-header__placeholder">${config.icon}</div>`
        }
        <div class="detail-header__overlay">
          <span class="detail-type" style="--type-color: ${config.color}">
            ${config.icon}
            ${config.label}
          </span>
        </div>
      </div>

      <div class="detail-body">
        <h2 class="detail-title">${escapeHtml(item.name)}</h2>

        <div class="detail-meta">
          <span class="detail-meta__item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            ${escapeHtml(creatorName)}
          </span>
          ${companyName ? `
            <span class="detail-meta__item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                <path d="M3 21h18"/>
                <path d="M9 21v-8H5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2h-4v8"/>
              </svg>
              ${escapeHtml(companyName)}
            </span>
          ` : ''}
          ${date ? `
            <span class="detail-meta__item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              ${date}
            </span>
          ` : ''}
        </div>

        ${item.description ? `
          <div class="detail-description">
            <h3>Description</h3>
            <p>${escapeHtml(item.description)}</p>
          </div>
        ` : ''}

        ${detailsHtml ? `
          <div class="detail-fields">
            <h3>Details</h3>
            <div class="detail-fields__grid">
              ${detailsHtml}
            </div>
          </div>
        ` : ''}
      </div>
    `;

    elements.detailModal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeDetailModal() {
    if (!elements.detailModal) return;

    elements.detailModal.classList.remove('active');
    document.body.style.overflow = '';
  }

  // ─────────────────────────────────────────────────────────────────────────
  // UI Helpers
  // ─────────────────────────────────────────────────────────────────────────
  function showLoading(show) {
    if (elements.discoveryLoading) {
      elements.discoveryLoading.style.display = show ? 'flex' : 'none';
    }
  }

  function showEmpty(message) {
    if (elements.discoveryEmpty) {
      elements.discoveryEmpty.style.display = 'flex';
      if (elements.emptyMessage) {
        elements.emptyMessage.textContent = message;
      }
    }
    if (elements.loadMoreSection) {
      elements.loadMoreSection.style.display = 'none';
    }
  }

  function hideEmpty() {
    if (elements.discoveryEmpty) {
      elements.discoveryEmpty.style.display = 'none';
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Utility Functions
  // ─────────────────────────────────────────────────────────────────────────
  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function truncate(str, maxLength) {
    if (!str) return '';
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength) + '...';
  }

  function capitalizeFirst(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function formatRelativeTime(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 30) {
      return new Date(timestamp).toLocaleDateString();
    } else if (days > 0) {
      return `${days}d ago`;
    } else if (hours > 0) {
      return `${hours}h ago`;
    } else if (minutes > 0) {
      return `${minutes}m ago`;
    } else {
      return 'Just now';
    }
  }

  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // Avatar helper - returns HTML for avatar with fallback
  function getAvatarHtml(user, size = 24) {
    const avatarUrl = user?.avatar || user?.avatar_url;
    const name = user?.nickname || user?.mcNickname || user?.username || 'U';
    const initials = name.slice(0, 2).toUpperCase();
    
    if (avatarUrl) {
      return `<img src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(name)}" class="avatar avatar--circular" style="width: ${size}px; height: ${size}px;" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
              <span class="avatar avatar--circular avatar--fallback" style="width: ${size}px; height: ${size}px; display: none; font-size: ${Math.floor(size * 0.4)}px;">${initials}</span>`;
    }
    
    return `<span class="avatar avatar--circular avatar--fallback" style="width: ${size}px; height: ${size}px; font-size: ${Math.floor(size * 0.4)}px;">${initials}</span>`;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Start
  // ─────────────────────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
