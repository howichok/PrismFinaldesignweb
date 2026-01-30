/* ═══════════════════════════════════════════════════════════════════════════
   PrismMTR - Components.js
   The Single Source of Truth for UI Injection
   
   This module is THE ONLY place that:
   - Injects the Header
   - Injects Modals (Login, Settings, MC Nickname)
   - Injects Toast Container
   - Manages Profile Dropdown
   - Syncs Auth State to UI
   
   Updated for OAuth (GitHub, Google, Discord) + Minecraft Nickname flow
   ═══════════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════════
  // ENVIRONMENT DETECTION
  // ═══════════════════════════════════════════════════════════════════════════

  function isProduction() {
    const origin = window.location.origin;
    return origin.includes('prismmtr.org') || 
           origin.includes('netlify.app') ||
           origin.includes('prismmtr.netlify.app');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LOGIN PROVIDER CONFIGURATION
  // Centralized management of login method availability
  // ═══════════════════════════════════════════════════════════════════════════

  const LOGIN_PROVIDERS = {
    discord: {
      name: 'Discord',
      enabled: true,
      status: 'active',
      icon: 'discord',
      description: 'Sign in with your Discord account',
    },
    google: {
      name: 'Google',
      enabled: false,
      status: 'coming-soon',
      icon: 'google',
      description: 'Coming Soon - Google Sign-In',
    },
    github: {
      name: 'GitHub',
      enabled: false,
      status: 'coming-soon',
      icon: 'github',
      description: 'Coming Soon - GitHub Sign-In',
    },
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // SVG ICONS
  // ═══════════════════════════════════════════════════════════════════════════

  const Icons = {
    // Logo - optimized WebP with PNG fallback
    prismLogo: `<picture><source srcset="assets/img/PrismMTRlogo.webp" type="image/webp"><img src="assets/img/PrismMTRlogo-optimized.png" alt="PrismMTR" class="logo-img" width="40" height="40"></picture>`,
    close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
    settings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>`,
    logout: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,
    download: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
    github: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>`,
    google: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>`,
    discord: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z"/></svg>`,
    key: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>`,
    check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
    user: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
    link: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`,
    palette: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.555C21.965 6.012 17.461 2 12 2z"/></svg>`,
    minecraft: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 2h16a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm0 2v16h16V4H4zm2 2h4v4H6V6zm8 0h4v4h-4V6zm-4 4h4v4h-4v-4zm-4 4h4v4H6v-4zm8 0h4v4h-4v-4z"/></svg>`,
    bell: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,
    admin: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
    projects: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`,
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // TEMPLATES
  // ═══════════════════════════════════════════════════════════════════════════

  function getHeaderTemplate(activePage) {
    return `
    <header class="header" id="appHeader">
      <div class="header__inner">
        <!-- Logo -->
        <a href="index.html" class="header__logo">
          ${Icons.prismLogo}
          <span>PrismMTR</span>
        </a>
        
        <!-- Navigation -->
        <nav class="header__nav">
          <a href="index.html" class="nav-link ${activePage === 'home' ? 'active' : ''}">Home</a>
          <a href="download.html" class="nav-link ${activePage === 'download' ? 'active' : ''}">Download</a>
          <a href="discovery.html" class="nav-link ${activePage === 'discovery' ? 'active' : ''}">Discovery</a>
          <a href="posts.html" class="nav-link ${activePage === 'posts' ? 'active' : ''}">Posts</a>
          <a href="help.html" class="nav-link ${activePage === 'help' ? 'active' : ''}">Help</a>
        </nav>
        
        <!-- Actions -->
        <div class="header__actions">
          <!-- Notifications Bell (Left of Profile) -->
          <div class="notifications" style="display: none;">
            <button class="notifications__trigger" data-action="toggle-notifications" aria-label="Notifications">
              ${Icons.bell}
              <span class="notifications__badge" style="display: none;">0</span>
            </button>
            <div class="notifications__panel">
              <div class="notifications__header">
                <div class="notifications__header-icon">
                  ${Icons.bell}
                </div>
                <div class="notifications__header-text">
                  <h3>Notifications</h3>
                  <span class="notifications__count">0 unread</span>
                </div>
                <button class="notifications__mark-read" data-action="mark-all-read" aria-label="Mark all as read">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  <span>Mark all</span>
                </button>
              </div>
              <div class="notifications__list">
                <div class="notifications__empty">
                  <div class="notifications__empty-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                    </svg>
                  </div>
                  <p class="notifications__empty-title">All caught up!</p>
                  <p class="notifications__empty-desc">You have no new notifications</p>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Logged Out State -->
          <div class="header__logged-out">
            <button class="btn btn--primary btn--sm" data-action="open-login">
              Sign In
            </button>
          </div>
          
          <!-- Logged In State (Profile) - Click goes to Dashboard -->
          <div class="profile" style="display: none;">
            <button class="profile__trigger" data-action="goto-dashboard-loading" aria-label="Go to Dashboard">
              <img class="profile__avatar" style="display: none;" alt="Profile">
              <span class="profile__initials">?</span>
            </button>
          </div>
        </div>
      </div>
    </header>`;
  }

  function getLoginModalTemplate() {
    // Generate login buttons based on provider configuration
    const activeProviders = [];
    const comingSoonProviders = [];

    // Get current path for redirect after login
    const currentPath = window.location.pathname + window.location.search;
    const nextParam = encodeURIComponent(currentPath);

    Object.entries(LOGIN_PROVIDERS).forEach(([key, provider]) => {
      // For enabled Discord provider, use direct link to auth endpoint
      const btnHTML = provider.enabled
        ? (key === 'discord'
          ? `<a class="login-btn login-btn--${key}" href="/.netlify/functions/auth-discord?next=${nextParam}">
              ${Icons[provider.icon]}
              <span>Continue with ${provider.name}</span>
            </a>`
          : `<button class="login-btn login-btn--${key}" data-action="login-${key}">
              ${Icons[provider.icon]}
              <span>Continue with ${provider.name}</span>
            </button>`)
        : `<button class="login-btn login-btn--${key} login-btn--disabled" disabled title="${provider.description}">
            ${Icons[provider.icon]}
            <span>Continue with ${provider.name}</span>
            <span class="login-btn__badge">Soon</span>
          </button>`;

      if (provider.enabled) {
        activeProviders.push(btnHTML);
      } else {
        comingSoonProviders.push(btnHTML);
      }
    });

    return `
    <div class="modal" id="loginModal">
      <div class="modal__backdrop" data-action="close-modal" aria-hidden="true"></div>
      <div class="modal__container">
        <button class="modal__close" data-action="close-modal" aria-label="Close">
          ${Icons.close}
        </button>
        <div class="login-card">
          <div class="login-card__logo">
            ${Icons.prismLogo}
          </div>
          <h2 class="login-card__title">Welcome to PrismMTR</h2>
          <p class="login-card__subtitle">Sign in to access downloads and sync your settings</p>

          <div class="login-card__options">
            ${activeProviders.length > 0 ? `
              <div class="login-card__section">
                <span class="login-card__section-label">Available</span>
                ${activeProviders.join('')}
              </div>
            ` : ''}

            ${comingSoonProviders.length > 0 ? `
              <div class="login-card__section login-card__section--disabled">
                <span class="login-card__section-label">Soon</span>
                ${comingSoonProviders.join('')}
              </div>
            ` : ''}
          </div>

          <p class="login-card__status" id="loginStatus"></p>

          <p class="login-card__footer">
            By signing in, you agree to our <a href="terms.html">Terms of Service</a>
          </p>
        </div>
      </div>
    </div>`;
  }

  function getSettingsModalTemplate() {
    return `
    <div class="modal" id="settingsModal">
      <div class="modal__backdrop" data-action="close-modal" aria-hidden="true"></div>
      <div class="modal__container modal__container--wide">
        <button class="modal__close" data-action="close-modal" aria-label="Close">
          ${Icons.close}
        </button>
        <div class="settings">
          <aside class="settings__sidebar">
            <h2 class="settings__title">Settings</h2>
            <p class="settings__subtitle">Manage your account</p>
            <nav class="settings__nav">
              <button class="settings__tab active" data-panel="account">
                ${Icons.user}
                <span>Account</span>
              </button>
              <button class="settings__tab" data-panel="connections">
                ${Icons.link}
                <span>Connections</span>
              </button>
              <button class="settings__tab" data-panel="visuals">
                ${Icons.palette}
                <span>Visuals</span>
              </button>
            </nav>
          </aside>
          <main class="settings__content">
            <!-- Account Panel -->
            <section class="settings__panel active" data-panel="account">
              <h3 class="settings__heading">Account</h3>
              
              <div class="setting-row setting-row--card">
                <div class="setting-row__avatar" id="userAvatar">
                  <span>?</span>
                </div>
                <div class="setting-row__info">
                  <div class="setting-row__label" id="userName">Not signed in</div>
                  <div class="setting-row__desc" id="userEmail">Sign in to manage your account</div>
                </div>
              </div>
              
              <div class="setting-row">
                <div class="setting-row__info">
                  <div class="setting-row__label">Minecraft Nickname</div>
                  <div class="setting-row__desc" id="mcNickname">Not set</div>
                </div>
                <button class="btn btn--sm btn--outline" data-action="change-nickname">
                  Change
                </button>
              </div>
              
              <div class="setting-row">
                <div class="setting-row__info">
                  <div class="setting-row__label">Role</div>
                  <div class="setting-row__desc" id="userRole">User</div>
                </div>
              </div>
              
              <div class="setting-row">
                <div class="setting-row__info">
                  <div class="setting-row__label">Member Since</div>
                  <div class="setting-row__desc" id="memberSince">-</div>
                </div>
              </div>
              
              <hr class="settings__divider">
              
              <div class="setting-row setting-row--danger">
                <div class="setting-row__info">
                  <div class="setting-row__label">Sign Out</div>
                  <div class="setting-row__desc">Sign out of your account on this device</div>
                </div>
                <button class="btn btn--sm btn--danger" data-action="logout-settings">
                  ${Icons.logout}
                  Sign Out
                </button>
              </div>
            </section>
            
            <!-- Connections Panel -->
            <section class="settings__panel" data-panel="connections">
              <h3 class="settings__heading">Connections</h3>
              <p class="settings__subheading">Connect additional accounts for enhanced features</p>
              
              <div class="connection-card" data-provider="github">
                <div class="connection-card__icon connection-card__icon--github">
                  ${Icons.github}
                </div>
                <div class="connection-card__info">
                  <div class="connection-card__name">GitHub</div>
                  <div class="connection-card__status" id="githubStatus">Not connected</div>
                </div>
                <button class="btn btn--sm btn--outline" data-action="connect-github">
                  Connect
                </button>
              </div>
              
              <div class="connection-card" data-provider="google">
                <div class="connection-card__icon connection-card__icon--google">
                  ${Icons.google}
                </div>
                <div class="connection-card__info">
                  <div class="connection-card__name">Google</div>
                  <div class="connection-card__status" id="googleStatus">Not connected</div>
                </div>
                <button class="btn btn--sm btn--outline" data-action="connect-google">
                  Connect
                </button>
              </div>
              
              <div class="connection-card" data-provider="discord">
                <div class="connection-card__icon connection-card__icon--discord">
                  ${Icons.discord}
                </div>
                <div class="connection-card__info">
                  <div class="connection-card__name">Discord</div>
                  <div class="connection-card__status" id="discordStatus">Not connected</div>
                </div>
                <button class="btn btn--sm btn--outline" data-action="connect-discord">
                  Connect
                </button>
              </div>
              
              <div class="settings__note">
                <strong>Tip:</strong> Connecting Discord is required to submit support tickets.
              </div>
            </section>
            
            <!-- Visuals Panel -->
            <section class="settings__panel" data-panel="visuals">
              <h3 class="settings__heading">Appearance</h3>
              <p class="settings__subheading">Customize how PrismMTR looks</p>
              
              <!-- Dark Mode Toggle (Premium) -->
              <div class="setting-row setting-row--featured">
                <div class="setting-row__icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                  </svg>
                </div>
                <div class="setting-row__info">
                  <div class="setting-row__label">Dark Mode</div>
                  <div class="setting-row__desc">Switch between light and dark themes</div>
                </div>
                <div class="theme-toggle" id="themeToggle">
                  <button class="theme-toggle__btn theme-toggle__btn--light" data-theme="light">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="12" cy="12" r="5"/>
                      <line x1="12" y1="1" x2="12" y2="3"/>
                      <line x1="12" y1="21" x2="12" y2="23"/>
                      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                      <line x1="1" y1="12" x2="3" y2="12"/>
                      <line x1="21" y1="12" x2="23" y2="12"/>
                      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                    </svg>
                    <span>Light</span>
                  </button>
                  <button class="theme-toggle__btn theme-toggle__btn--dark" data-theme="dark">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                    </svg>
                    <span>Dark</span>
                  </button>
                </div>
              </div>
              
              <hr class="settings__divider">
              
              <div class="setting-row">
                <div class="setting-row__info">
                  <div class="setting-row__label">Star Animation</div>
                  <div class="setting-row__desc">Show animated starfield background</div>
                </div>
                <label class="toggle">
                  <input type="checkbox" id="starsToggle" checked>
                  <span class="toggle__slider"></span>
                </label>
              </div>
              
              <div class="setting-row">
                <div class="setting-row__info">
                  <div class="setting-row__label">Reduced Motion</div>
                  <div class="setting-row__desc">Minimize animations for accessibility</div>
                </div>
                <label class="toggle">
                  <input type="checkbox" id="reducedMotionToggle">
                  <span class="toggle__slider"></span>
                </label>
              </div>
              
              <div class="setting-row">
                <div class="setting-row__info">
                  <div class="setting-row__label">High Contrast</div>
                  <div class="setting-row__desc">Increase contrast for better visibility</div>
                </div>
                <label class="toggle">
                  <input type="checkbox" id="highContrastToggle">
                  <span class="toggle__slider"></span>
                </label>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>`;
  }

  function getToastContainerTemplate() {
    return `
    <div class="toast" id="toast">
      <div class="toast__icon">
        ${Icons.check}
      </div>
      <div class="toast__content">
        <div class="toast__title"></div>
        <div class="toast__message"></div>
      </div>
    </div>`;
  }

  /**
   * User Profile Modal Template (Discord-style mini profile)
   */
  function getUserProfileModalTemplate() {
    return `
    <div class="user-profile-modal" id="userProfileModal">
      <div class="user-profile-modal__backdrop" data-action="close-user-profile"></div>
      <div class="user-profile-modal__card">
        <div class="user-profile-modal__banner"></div>
        <div class="user-profile-modal__content">
          <div class="user-profile-modal__avatar-wrapper">
            <div class="user-profile-modal__avatar" id="profileModalAvatar">?</div>
          </div>
          <div class="user-profile-modal__info">
            <h3 class="user-profile-modal__name" id="profileModalName">User</h3>
            <span class="user-profile-modal__role" id="profileModalRole">Member</span>
          </div>
          <div class="user-profile-modal__details">
            <div class="user-profile-modal__detail">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              <span>Member since <span id="profileModalJoined">-</span></span>
            </div>
          </div>
          <div class="user-profile-modal__companies" id="profileModalCompanies" style="display: none;">
            <h4 class="user-profile-modal__section-title">Companies</h4>
            <div class="user-profile-modal__companies-list" id="profileModalCompaniesList"></div>
          </div>
        </div>
      </div>
    </div>`;
  }

  /**
   * OAuth Loading Overlay Template
   * Shown while processing OAuth callback to prevent "idle" main page flash
   */
  function getOAuthLoadingOverlay() {
    return `
    <div class="oauth-loading" id="oauthLoadingOverlay">
      <div class="oauth-loading__card">
        <div class="oauth-loading__spinner"></div>
        <h2 class="oauth-loading__title">Signing you in...</h2>
        <p class="oauth-loading__text">Please wait while we complete your authentication.</p>
      </div>
    </div>`;
  }

  /**
   * Dashboard Loading Overlay Template
   * Shown for 2 seconds when clicking profile avatar to go to dashboard
   */
  function getDashboardLoadingOverlay() {
    return `
    <div class="dashboard-loading-overlay" id="dashboardLoadingOverlay">
      <div class="dashboard-loading-overlay__card">
        <div class="dashboard-loading-overlay__spinner"></div>
        <h2 class="dashboard-loading-overlay__title">Loading Dashboard...</h2>
        <p class="dashboard-loading-overlay__text">Preparing your workspace</p>
      </div>
    </div>`;
  }

  /**
   * Navigate to dashboard with 2-second loading animation
   * If already on dashboard, toggle between home and settings
   */
  function gotoDashboardWithLoading() {
    // If already on dashboard, toggle between home and settings
    if (document.body.dataset.page === 'dashboard') {
      // Get current active section
      const activeNav = document.querySelector('.sidebar-nav__item.active');
      const currentSection = activeNav?.dataset.section || 'home';

      // Toggle: settings → home, anything else → settings
      const targetSection = currentSection === 'settings' ? 'home' : 'settings';

      // Find and click the target nav item to switch sections
      const targetNav = document.querySelector(`.sidebar-nav__item[data-section="${targetSection}"]`);
      if (targetNav) {
        targetNav.click();
      }
      return;
    }

    // Inject loading overlay immediately for feedback
    document.body.insertAdjacentHTML('beforeend', getDashboardLoadingOverlay());

    // LAZY AUTH CHECK: On public pages, we haven't checked session yet.
    // Check now before navigating to dashboard.
    // If not logged in, guards-new.js on dashboard.html will redirect to login anyway,
    // but checking here gives better UX (show login modal instead of redirect loop)
    if (typeof AuthManager !== 'undefined' && !window.__sessionChecked) {
      AuthManager.initAuth(false, null).then(({ user }) => {
        if (!user) {
          // Not logged in - show login modal instead of navigating
          hideOAuthLoading();
          openModal('loginModal');
        } else {
          // Logged in - proceed to dashboard
          navigateToDashboard();
        }
      }).catch(() => {
        // On error, just navigate - guards will handle it
        navigateToDashboard();
      });
    } else {
      // Session already checked (we're on a protected page or already checked)
      const user = typeof AuthManager !== 'undefined' ? AuthManager.getSession() : window.__session;
      if (!user) {
        hideOAuthLoading();
        openModal('loginModal');
      } else {
        navigateToDashboard();
      }
    }
  }
  
  function navigateToDashboard() {
    // Start prefetching data in the background for faster dashboard load
    if (window.PrismBin) {
      Promise.all([
        PrismBin.getUsers(),
        PrismBin.getCompanies(),
        PrismBin.getProjects(),
      ]).catch(() => {}); // Ignore errors, this is just prefetch
    }

    // Brief delay for smooth transition, then navigate
    setTimeout(() => {
      window.location.href = 'dashboard.html';
    }, 300);
  }

  /**
   * Check if current URL has OAuth callback parameters
   * NOTE: This should NEVER happen in normal flow - callback is handled server-side
   * If we see code/state on frontend, something went wrong
   */
  function hasOAuthCallback() {
    const params = new URLSearchParams(window.location.search);
    return params.has('code') && params.has('state');
  }
  
  /**
   * Check for auth-related URL parameters and handle them
   */
  function handleAuthUrlParams() {
    const params = new URLSearchParams(window.location.search);
    
    // Handle OAuth code/state on frontend (ERROR CASE - should be handled server-side)
    if (params.has('code') && params.has('state')) {
      console.warn('[Components] OAuth code/state detected on frontend - this should not happen!');
      console.warn('[Components] Callback function may have failed. Clearing URL and showing login.');
      // Clear URL using location.replace (no history entry)
      window.history.replaceState({}, '', window.location.pathname);
      // Show login modal after brief delay
      setTimeout(() => {
        showToast('Sign In Required', 'Please try signing in again.', 'warning');
        openModal('loginModal');
      }, 100);
      return true; // Params were handled
    }
    
    // Handle ?reason=auth&message=please_sign_in_again
    if (params.get('reason') === 'auth' && params.get('message') === 'please_sign_in_again') {
      console.log('[Components] Auth retry requested');
      // Clear URL
      window.history.replaceState({}, '', window.location.pathname);
      // Show login modal
      setTimeout(() => {
        showToast('Session Expired', 'Please sign in again to continue.', 'info');
        openModal('loginModal');
      }, 100);
      return true;
    }
    
    // Handle ?reason=revoked (role downgrade)
    if (params.get('reason') === 'revoked') {
      console.log('[Components] Access revoked');
      window.history.replaceState({}, '', window.location.pathname);
      setTimeout(() => {
        showToast('Access Changed', 'Your access level has been changed.', 'warning');
      }, 100);
      return true;
    }
    
    // Handle ?reason=expired (session expired)
    if (params.get('reason') === 'expired') {
      console.log('[Components] Session expired');
      window.history.replaceState({}, '', window.location.pathname);
      setTimeout(() => {
        showToast('Session Expired', 'Your session has expired. Please sign in again.', 'info');
        openModal('loginModal');
      }, 100);
      return true;
    }
    
    // Handle generic ?error=... 
    const error = params.get('error');
    if (error) {
      console.log('[Components] Error param:', error);
      window.history.replaceState({}, '', window.location.pathname);
      setTimeout(() => {
        showToast('Error', decodeURIComponent(error), 'error');
      }, 100);
      return true;
    }
    
    return false; // No auth params
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DOM INJECTION
  // ═══════════════════════════════════════════════════════════════════════════

  function injectComponents() {
    const activePage = document.body.dataset.page || 'home';
    
    // Handle auth-related URL parameters (reason, error, message, code/state fallback)
    // This clears URL params and shows appropriate messages
    handleAuthUrlParams();
    
    // Inject Header on ALL pages including dashboard and company
    // Header now has id="appHeader" for CSS variable measurement
    document.body.insertAdjacentHTML('afterbegin', getHeaderTemplate(activePage));
    
    // Inject Modals before closing body (needed everywhere for auth)
    document.body.insertAdjacentHTML('beforeend', getLoginModalTemplate());
    document.body.insertAdjacentHTML('beforeend', getSettingsModalTemplate());
    document.body.insertAdjacentHTML('beforeend', getToastContainerTemplate());
    
    // Inject User Profile Modal (needed everywhere)
    document.body.insertAdjacentHTML('beforeend', getUserProfileModalTemplate());
  }

  /**
   * Hide OAuth loading overlay and restore main content
   */
  function hideOAuthLoading() {
    const overlay = document.getElementById('oauthLoadingOverlay');
    if (overlay) {
      overlay.classList.add('oauth-loading--hide');
      setTimeout(() => overlay.remove(), 300);
    }
    const mainContent = document.getElementById('mainContent') || document.querySelector('main');
    if (mainContent) {
      mainContent.style.visibility = '';
      mainContent.style.opacity = '';
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STATE MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  const UIState = {
    profileOpen: false,
    notificationsOpen: false,
    activeModal: null,
  };

  function syncAuthToUI() {
    // Use AuthManager (primary) or PrismAuth (fallback) for auth state
    let currentUser = null;
    let isLoggedIn = false;
    
    if (typeof AuthManager !== 'undefined') {
      currentUser = AuthManager.getSession();
      isLoggedIn = AuthManager.isLoggedIn();
    } else if (typeof PrismAuth !== 'undefined') {
      currentUser = PrismAuth.getUser();
      isLoggedIn = PrismAuth.isLoggedIn();
    } else {
      // Fallback to window.__session
      currentUser = window.__session;
      isLoggedIn = !!currentUser;
    }
    
    const loggedOutEl = document.querySelector('.header__logged-out');
    const profileEl = document.querySelector('.profile');
    const notificationsEl = document.querySelector('.notifications');

    if (!loggedOutEl || !profileEl) return;

    if (isLoggedIn && currentUser) {
      loggedOutEl.style.display = 'none';
      profileEl.style.display = 'block';

      // Show notifications bell for logged in users
      if (notificationsEl) {
        notificationsEl.style.display = 'flex';
        loadNotifications(currentUser);
      }
      
      // Get initials from MC nickname or name
      const displayName = currentUser.mcNickname || currentUser.nickname || currentUser.name || 'User';
      const initials = displayName.slice(0, 2).toUpperCase();
      
      // Handle avatar image display
      const avatarEl = document.querySelector('.profile__avatar');
      const initialsEl = document.querySelector('.profile__initials');
      const avatarUrl = currentUser.avatar || currentUser.avatar_url;
      
      if (avatarEl && avatarUrl) {
        avatarEl.src = avatarUrl;
        avatarEl.style.display = 'block';
        avatarEl.onerror = () => {
          avatarEl.style.display = 'none';
          if (initialsEl) initialsEl.style.display = 'flex';
        };
        if (initialsEl) initialsEl.style.display = 'none';
      } else if (initialsEl) {
        if (avatarEl) avatarEl.style.display = 'none';
        initialsEl.style.display = 'flex';
        initialsEl.textContent = initials;
      }
      
      if (initialsEl) initialsEl.textContent = initials;

      // These elements may not exist in simplified header
      const nameEl = document.querySelector('.profile__name');
      const emailEl = document.querySelector('.profile__email');
      if (nameEl) nameEl.textContent = displayName;
      if (emailEl) emailEl.textContent = currentUser.email || 'user@prism.mtr';

      // Update settings account panel
      updateSettingsPanel(currentUser, authState);
    } else {
      loggedOutEl.style.display = 'flex';
      profileEl.style.display = 'none';

      // Hide notifications for logged out users
      if (notificationsEl) notificationsEl.style.display = 'none';
    }
    
    // Dispatch auth state changed event
    window.dispatchEvent(new CustomEvent('auth-state-changed', { detail: { isLoggedIn, user: currentUser } }));
  }

  /**
   * Load and display notifications for user
   */
  async function loadNotifications(user) {
    const badge = document.querySelector('.notifications__badge');
    const list = document.querySelector('.notifications__list');
    
    if (!badge || !list || !user) return;
    
    try {
      // Get notifications from PrismBin
      let notifications = [];
      if (window.PrismBin && window.PrismBin.getNotifications) {
        // Ensure userId is a string, not an object
        const userId = typeof user.id === 'string' ? user.id : (user.id?.id || String(user.id));
        notifications = await window.PrismBin.getNotifications(userId, true);
      } else if (window.PrismDB && window.PrismDB.Notifications) {
        const userId = typeof user.id === 'string' ? user.id : (user.id?.id || String(user.id));
        notifications = await window.PrismDB.Notifications.getAll(userId, true);
      }
      
      const unreadCount = notifications.filter(n => !n.read).length;
      
      // Update badge
      if (unreadCount > 0) {
        badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
        badge.style.display = 'flex';
      } else {
        badge.style.display = 'none';
      }
      
      // Render notifications
      if (notifications.length === 0) {
        list.innerHTML = `<div class="notifications__empty"><p>No notifications</p></div>`;
      } else {
        list.innerHTML = notifications
          .sort((a, b) => new Date(b.createdAt || b.created_at) - new Date(a.createdAt || a.created_at))
          .slice(0, 10)
          .map(n => `
            <div class="notifications__item ${n.read ? '' : 'notifications__item--unread'}" data-id="${n.id}">
              <div class="notifications__item-content">
                <div class="notifications__item-title">${escapeHtml(n.title || '')}</div>
                <div class="notifications__item-message">${escapeHtml(n.message || '')}</div>
                <div class="notifications__item-time">${formatTimeAgo(n.createdAt || n.created_at)}</div>
              </div>
            </div>
          `).join('');
        
        // Add click handlers to mark as read
        list.querySelectorAll('.notifications__item').forEach(item => {
          item.addEventListener('click', async () => {
            const notifId = item.dataset.id;
            if (notifId && !item.classList.contains('notifications__item--unread')) {
              return;
            }
            try {
              if (window.PrismBin && window.PrismBin.markNotificationRead) {
                await window.PrismBin.markNotificationRead(notifId);
              } else if (window.PrismDB && window.PrismDB.Notifications) {
                await window.PrismDB.Notifications.markRead(notifId);
              }
              item.classList.remove('notifications__item--unread');
              await loadNotifications(user);
            } catch (err) {
              console.error('[Components] Failed to mark notification as read:', err);
            }
          });
        });
      }
    } catch (error) {
      console.error('[Components] Failed to load notifications:', error);
    }
  }
  
  /**
   * Helper: Escape HTML to prevent XSS
   */
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }
  
  /**
   * Helper: Format time ago
   */
  function formatTimeAgo(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return date.toLocaleDateString();
  }

  function updateSettingsPanel(user, authState) {
    // Account panel
    const userAvatar = document.getElementById('userAvatar');
    const userName = document.getElementById('userName');
    const userEmail = document.getElementById('userEmail');
    const mcNickname = document.getElementById('mcNickname');
    const userRole = document.getElementById('userRole');
    const memberSince = document.getElementById('memberSince');
    
    if (userAvatar) {
      const initials = (user.mcNickname || user.name || 'U').slice(0, 2).toUpperCase();
      userAvatar.innerHTML = `<span>${initials}</span>`;
    }
    if (userName) userName.textContent = user.mcNickname || user.name || 'User';
    if (userEmail) userEmail.textContent = user.email || '';
    if (mcNickname) mcNickname.textContent = user.mcNickname || 'Not set';
    if (userRole) {
      const role = user.role || 'user';
      const roleDisplay = role.charAt(0).toUpperCase() + role.slice(1);
      userRole.innerHTML = `<span class="role-badge role-badge--${role}">${roleDisplay}</span>`;
    }
    if (memberSince && user.createdAt) {
      memberSince.textContent = new Date(user.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }
    
    // Connections panel
    updateConnectionsPanel(user, authState);
  }

  function updateConnectionsPanel(user, authState) {
    const connections = user?.connections || {};
    const providers = ['github', 'google', 'discord'];
    
    providers.forEach(provider => {
      const statusEl = document.getElementById(`${provider}Status`);
      const card = document.querySelector(`.connection-card[data-provider="${provider}"]`);
      const btn = card?.querySelector('button');
      
      const isConnected = connections[provider] === true || authState.provider?.toLowerCase() === provider;
      
      if (statusEl) {
        statusEl.textContent = isConnected ? 'Connected ✓' : 'Not connected';
        statusEl.classList.toggle('connected', isConnected);
      }
      
      if (btn) {
        btn.textContent = isConnected ? 'Disconnect' : 'Connect';
        btn.dataset.action = isConnected ? `disconnect-${provider}` : `connect-${provider}`;
        btn.classList.toggle('btn--danger', isConnected);
        btn.classList.toggle('btn--outline', !isConnected);
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MODAL SYSTEM
  // ═══════════════════════════════════════════════════════════════════════════

  function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    
    // Close any open modal first
    closeAllModals();
    
    UIState.activeModal = modalId;
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    
    modal.classList.remove('open');
    document.body.style.overflow = '';
    UIState.activeModal = null;
    
    // Reset key input if login modal
    if (modalId === 'loginModal') {
      UIState.keyBuffer = '';
      const keyDisplay = document.getElementById('keyDisplay');
      const keyArea = document.getElementById('keyInputArea');
      if (keyDisplay) keyDisplay.textContent = '';
      if (keyArea) keyArea.style.display = 'none';
    }
  }

  function closeAllModals() {
    document.querySelectorAll('.modal.open').forEach(modal => {
      modal.classList.remove('open');
    });
    document.body.style.overflow = '';
    UIState.activeModal = null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PROFILE DROPDOWN
  // ═══════════════════════════════════════════════════════════════════════════

  function toggleProfile() {
    const menu = document.querySelector('.profile__menu');
    if (!menu) return;
    
    // Close notifications if open
    if (UIState.notificationsOpen) closeNotifications();
    
    UIState.profileOpen = !UIState.profileOpen;
    menu.classList.toggle('open', UIState.profileOpen);
  }

  function closeProfile() {
    const menu = document.querySelector('.profile__menu');
    if (!menu) return;
    
    UIState.profileOpen = false;
    menu.classList.remove('open');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // NOTIFICATIONS DROPDOWN
  // ═══════════════════════════════════════════════════════════════════════════

  function toggleNotifications() {
    const panel = document.querySelector('.notifications__panel');
    if (!panel) return;
    
    // Close profile if open
    if (UIState.profileOpen) closeProfile();
    
    UIState.notificationsOpen = !UIState.notificationsOpen;
    panel.classList.toggle('open', UIState.notificationsOpen);
  }

  function closeNotifications() {
    const panel = document.querySelector('.notifications__panel');
    if (!panel) return;
    
    UIState.notificationsOpen = false;
    panel.classList.remove('open');
  }

  async function handleMarkAllRead() {
    try {
      const currentUser = PrismAuth?.getUser?.();
      if (!currentUser) return;
      
      if (typeof NotificationsStore !== 'undefined') {
        const allNotifications = await NotificationsStore.getAll();
        const userNotifications = allNotifications.filter(n => n.userId === currentUser.id && !n.read);
        
        for (const notification of userNotifications) {
          await NotificationsStore.update(notification.id, { read: true });
        }
      }
      
      // Refresh notifications UI
      loadNotifications(currentUser);
      
      showToast('Done', 'All notifications marked as read');
    } catch (error) {
      console.error('[Components] Failed to mark notifications as read:', error);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SETTINGS TABS
  // ═══════════════════════════════════════════════════════════════════════════

  function switchSettingsTab(panelName) {
    // Update tabs
    document.querySelectorAll('.settings__tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.panel === panelName);
    });
    
    // Update panels
    document.querySelectorAll('.settings__panel').forEach(panel => {
      panel.classList.toggle('active', panel.dataset.panel === panelName);
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TOAST NOTIFICATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  function showToast(title, message, duration = 3000) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    
    toast.querySelector('.toast__title').textContent = title;
    toast.querySelector('.toast__message').textContent = message;
    toast.classList.add('show');
    
    setTimeout(() => {
      toast.classList.remove('show');
    }, duration);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CONFIRMATION MODAL (Promise-based replacement for native confirm())
  // ═══════════════════════════════════════════════════════════════════════════

  let confirmResolve = null;

  function createConfirmModalIfNeeded() {
    if (document.getElementById('confirmModal')) return;
    
    const modalHTML = `
      <div id="confirmModal" class="modal">
        <div class="modal__backdrop"></div>
        <div class="modal__container modal__container--sm">
          <button class="modal__close" aria-label="Close" onclick="PrismUI.closeConfirm(false)">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
          <div class="confirm-card">
            <h2 class="confirm-card__title" id="confirmTitle">Confirm</h2>
            <p class="confirm-card__message" id="confirmMessage">Are you sure?</p>
            <div class="confirm-card__actions">
              <button class="btn btn--outline" id="confirmCancelBtn">Cancel</button>
              <button class="btn btn--danger" id="confirmOkBtn">Confirm</button>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Add event listeners
    document.getElementById('confirmCancelBtn').addEventListener('click', () => closeConfirm(false));
    document.getElementById('confirmOkBtn').addEventListener('click', () => closeConfirm(true));
    
    // Close on backdrop click
    document.querySelector('#confirmModal .modal__backdrop').addEventListener('click', () => closeConfirm(false));
    
    // ESC key to cancel
    document.getElementById('confirmModal').addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeConfirm(false);
    });
  }

  /**
   * Show a confirmation modal (replaces native confirm())
   * @param {string} title - Modal title
   * @param {string} message - Confirmation message
   * @param {Object} options - Optional configuration
   * @param {string} options.confirmText - Text for confirm button (default: "Confirm")
   * @param {string} options.cancelText - Text for cancel button (default: "Cancel")
   * @param {boolean} options.danger - If true, uses danger styling (default: true)
   * @returns {Promise<boolean>} - Resolves true if confirmed, false if cancelled
   */
  function showConfirm(title, message, options = {}) {
    return new Promise((resolve) => {
      createConfirmModalIfNeeded();
      
      const { confirmText = 'Confirm', cancelText = 'Cancel', danger = true } = options;
      
      document.getElementById('confirmTitle').textContent = title;
      document.getElementById('confirmMessage').textContent = message;
      
      const confirmBtn = document.getElementById('confirmOkBtn');
      const cancelBtn = document.getElementById('confirmCancelBtn');
      
      confirmBtn.textContent = confirmText;
      cancelBtn.textContent = cancelText;
      
      // Toggle danger styling
      confirmBtn.classList.toggle('btn--danger', danger);
      confirmBtn.classList.toggle('btn--primary', !danger);
      
      confirmResolve = resolve;
      openModal('confirmModal');
      
      // Focus the cancel button for safety
      cancelBtn.focus();
    });
  }

  function closeConfirm(result) {
    closeModal('confirmModal');
    if (confirmResolve) {
      confirmResolve(result);
      confirmResolve = null;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LICENSE KEY INPUT
  // ═══════════════════════════════════════════════════════════════════════════

  function handleKeyInput(e) {
    // Removed - license key input no longer used
  }

  function processLicenseKey(key) {
    // Removed - license key input no longer used
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LOGIN HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════

  async function handleOAuthLogin(provider) {
    const statusEl = document.getElementById('loginStatus');
    const providerConfig = LOGIN_PROVIDERS[provider];
    const providerName = providerConfig?.name || provider.charAt(0).toUpperCase() + provider.slice(1);
    
    // Check if provider is enabled
    if (!providerConfig?.enabled) {
      if (statusEl) {
        statusEl.textContent = `${providerName} sign-in is coming soon!`;
        statusEl.style.color = 'var(--color-warning)';
      }
      return;
    }
    
    // For Discord, use direct redirect to Netlify Function (no JavaScript OAuth)
    if (provider === 'discord') {
      const next = encodeURIComponent(window.location.pathname + window.location.search || '/dashboard.html');
      console.log('[OAuth] Redirecting to Discord auth:', `/.netlify/functions/auth-discord?next=${next}`);
      window.location.href = `/.netlify/functions/auth-discord?next=${next}`;
      return; // Page will navigate away
    }
    
    // For other providers (future), use PrismAuth
    if (statusEl) {
      statusEl.textContent = `Redirecting to ${providerName}...`;
      statusEl.style.color = '';
    }
    
    try {
      if (typeof PrismAuth !== 'undefined') {
        await PrismAuth.loginWithProvider(provider);
      }
    } catch (error) {
      if (statusEl) {
        statusEl.textContent = error.message || `Failed to connect to ${providerName}`;
        statusEl.style.color = 'var(--color-danger)';
      }
      console.error('OAuth login error:', error);
    }
  }

  function handleGitHubLogin() {
    handleOAuthLogin('github');
  }

  function handleGoogleLogin() {
    handleOAuthLogin('google');
  }

  function handleDiscordLogin() {
    // Discord uses direct <a> link now, but keep this for fallback
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `/.netlify/functions/auth-discord?next=${next}`;
  }

  async function handleConnectProvider(provider) {
    try {
      if (typeof PrismAuth !== 'undefined') {
        await PrismAuth.connectProvider(provider);
        syncAuthToUI();
        const providerName = provider.charAt(0).toUpperCase() + provider.slice(1);
        showToast('Connected!', `${providerName} has been linked to your account`);
      }
    } catch (error) {
      showToast('Error', `Failed to connect ${provider}`);
      console.error('Connect provider error:', error);
    }
  }

  async function handleDisconnectProvider(provider) {
    try {
      if (typeof PrismAuth !== 'undefined') {
        await PrismAuth.disconnectProvider(provider);
        syncAuthToUI();
        const providerName = provider.charAt(0).toUpperCase() + provider.slice(1);
        showToast('Disconnected', `${providerName} has been unlinked from your account`);
      }
    } catch (error) {
      showToast('Error', `Failed to disconnect ${provider}`);
      console.error('Disconnect provider error:', error);
    }
  }

  function handleLogout() {
    // Close UI elements first
    closeProfile();
    closeAllModals();
    closeNotifications();
    
    // Use AuthManager (primary) or fallbacks
    if (typeof AuthManager !== 'undefined' && AuthManager.logout) {
      AuthManager.logout();
    } else if (typeof PrismAuth !== 'undefined' && PrismAuth.logout) {
      PrismAuth.logout();
    } else if (window.PrismGuards?.logout) {
      window.PrismGuards.logout();
    } else {
      // Direct fallback
      window.__session = null;
      window.__sessionChecked = false;
      fetch('/.netlify/functions/logout', {
        method: 'POST',
        credentials: 'include',
      }).catch(() => {});
      window.location.replace('/index.html?logged_out=' + Date.now());
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SETTINGS HANDLERS (no localStorage - uses system preferences + in-memory)
  // ═══════════════════════════════════════════════════════════════════════════

  // In-memory settings (not persisted across page loads)
  const inMemorySettings = {
    darkMode: null,
    starsEnabled: null,
    reducedMotion: null,
    highContrast: null,
  };

  function initSettings() {
    // Use system preferences as defaults (no localStorage)
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches || false;
    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false;
    const prefersHighContrast = window.matchMedia?.('(prefers-contrast: more)').matches || false;
    
    // Initialize in-memory settings from system preferences
    inMemorySettings.darkMode = prefersDark;
    inMemorySettings.starsEnabled = !prefersReducedMotion;
    inMemorySettings.reducedMotion = prefersReducedMotion;
    inMemorySettings.highContrast = prefersHighContrast;
    
    const themeToggle = document.getElementById('themeToggle');
    const starsToggle = document.getElementById('starsToggle');
    const reducedMotionToggle = document.getElementById('reducedMotionToggle');
    const highContrastToggle = document.getElementById('highContrastToggle');
    
    // Apply settings on load
    document.documentElement.classList.toggle('dark-mode', inMemorySettings.darkMode);
    document.body.classList.toggle('dark-mode', inMemorySettings.darkMode);
    updateThemeToggleUI(inMemorySettings.darkMode);
    
    if (starsToggle) {
      starsToggle.checked = inMemorySettings.starsEnabled;
    }
    
    if (reducedMotionToggle) {
      reducedMotionToggle.checked = inMemorySettings.reducedMotion;
      document.body.classList.toggle('reduced-motion', inMemorySettings.reducedMotion);
    }
    
    if (highContrastToggle) {
      highContrastToggle.checked = inMemorySettings.highContrast;
      document.body.classList.toggle('high-contrast', inMemorySettings.highContrast);
    }
    
    // Theme toggle buttons (in-memory only)
    if (themeToggle) {
      themeToggle.addEventListener('click', (e) => {
        const btn = e.target.closest('.theme-toggle__btn');
        if (!btn) return;
        
        const isDark = btn.dataset.theme === 'dark';
        inMemorySettings.darkMode = isDark;
        document.documentElement.classList.toggle('dark-mode', isDark);
        document.body.classList.toggle('dark-mode', isDark);
        updateThemeToggleUI(isDark);
        showToast('Theme Changed', isDark ? 'Dark mode enabled' : 'Light mode enabled');
      });
    }
    
    // Stars toggle (in-memory only)
    starsToggle?.addEventListener('change', (e) => {
      const enabled = e.target.checked;
      inMemorySettings.starsEnabled = enabled;
      const canvas = document.getElementById('starCanvas');
      if (canvas) canvas.style.opacity = enabled ? '1' : '0';
    });
    
    // Reduced motion toggle (in-memory only)
    reducedMotionToggle?.addEventListener('change', (e) => {
      const enabled = e.target.checked;
      inMemorySettings.reducedMotion = enabled;
      document.body.classList.toggle('reduced-motion', enabled);
    });
    
    // High contrast toggle (in-memory only)
    highContrastToggle?.addEventListener('change', (e) => {
      const enabled = e.target.checked;
      inMemorySettings.highContrast = enabled;
      document.body.classList.toggle('high-contrast', enabled);
    });
  }
  
  function updateThemeToggleUI(isDark) {
    const lightBtn = document.querySelector('.theme-toggle__btn--light');
    const darkBtn = document.querySelector('.theme-toggle__btn--dark');
    
    if (lightBtn && darkBtn) {
      lightBtn.classList.toggle('active', !isDark);
      darkBtn.classList.toggle('active', isDark);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // USER PROFILE MODAL (Discord-style)
  // ═══════════════════════════════════════════════════════════════════════════

  async function showUserProfile(userId) {
    const modal = document.getElementById('userProfileModal');
    if (!modal) return;

    // Show modal
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    // Reset content
    document.getElementById('profileModalAvatar').innerHTML = '<div class="spinner spinner--sm"></div>';
    document.getElementById('profileModalName').textContent = 'Loading...';
    document.getElementById('profileModalRole').textContent = '';
    document.getElementById('profileModalJoined').textContent = '-';
    document.getElementById('profileModalCompanies').style.display = 'none';

    try {
      // Fetch user data
      let user;
      if (typeof PrismBin !== 'undefined' && PrismBin.getUserById) {
        user = await PrismBin.getUserById(userId);
      }

      if (!user) {
        document.getElementById('profileModalName').textContent = 'User not found';
        return;
      }

      // Populate data
      const nickname = user.mcNickname || user.nickname || user.email?.split('@')[0] || 'Unknown';
      const initials = nickname.slice(0, 2).toUpperCase();
      const avatarEl = document.getElementById('profileModalAvatar');
      
      if (user.avatar) {
        avatarEl.innerHTML = `<img src="${user.avatar}" alt="${nickname}">`;
      } else {
        avatarEl.textContent = initials;
      }

      document.getElementById('profileModalName').textContent = nickname;
      
      const roleLabels = { user: 'Member', mod: 'Moderator', admin: 'Administrator' };
      document.getElementById('profileModalRole').textContent = roleLabels[user.role] || 'Member';
      document.getElementById('profileModalRole').className = `user-profile-modal__role user-profile-modal__role--${user.role || 'user'}`;

      // Format join date
      if (user.createdAt) {
        const date = new Date(user.createdAt);
        document.getElementById('profileModalJoined').textContent = date.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'short', 
          day: 'numeric' 
        });
      }

      // Load companies
      if (typeof PrismBin !== 'undefined' && PrismBin.getUserCompanies) {
        const companies = await PrismBin.getUserCompanies(userId);
        if (companies && companies.length > 0) {
          const companiesSection = document.getElementById('profileModalCompanies');
          const companiesList = document.getElementById('profileModalCompaniesList');
          
          companiesList.innerHTML = companies.map(c => `
            <a href="company.html?id=${c.id}" class="user-profile-modal__company">
              <div class="user-profile-modal__company-logo">
                ${c.logoUrl || c.logo_url ? `<img src="${c.logoUrl || c.logo_url}" alt="${c.name}">` : c.name.slice(0, 2).toUpperCase()}
              </div>
              <span>${escapeHtml(c.name)}</span>
            </a>
          `).join('');
          
          companiesSection.style.display = 'block';
        }
      }
    } catch (error) {
      console.error('[Components] Failed to load user profile:', error);
      document.getElementById('profileModalName').textContent = 'Error loading profile';
    }
  }

  function closeUserProfile() {
    const modal = document.getElementById('userProfileModal');
    if (modal) {
      modal.classList.remove('active');
    }
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }

  // Make showUserProfile globally accessible
  window.showUserProfile = showUserProfile;

  // ═══════════════════════════════════════════════════════════════════════════
  // EVENT DELEGATION
  // ═══════════════════════════════════════════════════════════════════════════

  function setupEventListeners() {
    // Global click delegation
    document.addEventListener('click', (e) => {
      const target = e.target.closest('[data-action]');
      if (!target) {
        // Close profile if clicking outside
        if (!e.target.closest('.profile') && UIState.profileOpen) {
          closeProfile();
        }
        // Close notifications if clicking outside
        if (!e.target.closest('.notifications') && UIState.notificationsOpen) {
          closeNotifications();
        }
        return;
      }
      
      const action = target.dataset.action;
      
      switch (action) {
        case 'open-login':
          openModal('loginModal');
          break;
        case 'open-settings':
          closeProfile();
          openModal('settingsModal');
          syncAuthToUI(); // Refresh settings data
          break;
        case 'open-connections':
          closeProfile();
          openModal('settingsModal');
          switchSettingsTab('connections');
          syncAuthToUI();
          break;
        case 'close-modal':
          if (UIState.activeModal) closeModal(UIState.activeModal);
          break;
        case 'toggle-profile':
          toggleProfile();
          break;
        case 'toggle-notifications':
          toggleNotifications();
          break;
        case 'mark-all-read':
          handleMarkAllRead();
          break;
        case 'logout':
        case 'logout-settings':
          handleLogout();
          break;
        case 'login-github':
          handleGitHubLogin();
          break;
        case 'login-google':
          handleGoogleLogin();
          break;
        case 'login-discord':
          handleDiscordLogin();
          break;
        case 'connect-github':
          handleConnectProvider('github');
          break;
        case 'connect-google':
          handleConnectProvider('google');
          break;
        case 'connect-discord':
          handleConnectProvider('discord');
          break;
        case 'disconnect-github':
          handleDisconnectProvider('github');
          break;
        case 'disconnect-google':
          handleDisconnectProvider('google');
          break;
        case 'disconnect-discord':
          handleDisconnectProvider('discord');
          break;
        case 'change-nickname':
          // Dispatch event for nickname change
          window.dispatchEvent(new CustomEvent('show-mc-nickname-modal'));
          break;
        case 'goto-download':
          window.location.href = 'download.html';
          break;
        case 'goto-dashboard-loading':
          gotoDashboardWithLoading();
          break;
        case 'show-user-profile':
          const userId = target.dataset.userId;
          if (userId) showUserProfile(userId);
          break;
        case 'close-user-profile':
          closeUserProfile();
          break;
      }
    });
    
    // Settings tab clicks
    document.addEventListener('click', (e) => {
      const tab = e.target.closest('.settings__tab');
      if (tab) {
        switchSettingsTab(tab.dataset.panel);
      }
    });
    
    // Listen for login modal open event
    window.addEventListener('open-login-modal', () => {
      openModal('loginModal');
    });
    
    // ═══════════════════════════════════════════════════════════════════════
    // Auth Event Listeners (from AuthManager)
    // ═══════════════════════════════════════════════════════════════════════
    
    // Auth ready (from AuthManager.initAuth)
    window.addEventListener('prism:auth:ready', (e) => {
      const { user, isLoggedIn } = e.detail;
      hideOAuthLoading();
      syncAuthToUI();
      
      if (isLoggedIn && user) {
        // Check if needs MC nickname
        if (!user.mcNickname) {
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('show-mc-nickname-modal'));
          }, 500);
        }
      }
    });
    
    // User updated via realtime
    window.addEventListener('prism:user:updated', (e) => {
      const { user, oldRole, newRole } = e.detail;
      syncAuthToUI();
      
      if (oldRole !== newRole) {
        showToast('Role Updated', `Your role changed to ${newRole}`);
      }
    });
    
    // Access revoked (role changed or session invalid)
    window.addEventListener('prism:access:revoked', (e) => {
      const { reason } = e.detail;
      const msg = reason === 'role_changed' 
        ? 'Your access level has changed. Redirecting...'
        : 'Your session has expired. Redirecting...';
      showToast('Access Changed', msg);
    });
    
    // Legacy: Handle successful OAuth login (fallback)
    window.addEventListener('prism:login:success', (e) => {
      const { user, requiresMcNickname } = e.detail;
      hideOAuthLoading();
      closeModal('loginModal');
      syncAuthToUI();
      showToast('Welcome!', `Signed in as ${user.nickname || user.email}`);
      
      if (requiresMcNickname) {
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('show-mc-nickname-modal'));
        }, 500);
      }
    });
    
    // Handle OAuth login error
    window.addEventListener('prism:login:error', (e) => {
      const { error } = e.detail;
      hideOAuthLoading();
      
      const statusEl = document.getElementById('loginStatus');
      if (statusEl) {
        statusEl.textContent = error || 'Login failed. Please try again.';
        statusEl.style.color = 'var(--color-error)';
      }
      showToast('Login Failed', error || 'Something went wrong. Please try again.');
    });
    
    // Handle auth check completed (fallback)
    window.addEventListener('prism:auth:checked', () => {
      hideOAuthLoading();
    });
    
    // Handle auth state changes
    window.addEventListener('prism:auth:changed', () => {
      syncAuthToUI();
    });
    
    // Handle logout
    window.addEventListener('prism:logout', () => {
      syncAuthToUI();
      showToast('Signed Out', 'You have been logged out.');
    });
    
    // Guards ready (page access granted)
    window.addEventListener('prism:guards:ready', () => {
      hideOAuthLoading();
      syncAuthToUI();
    });
    
    // Handle MC nickname requirement
    window.addEventListener('prism:require:mcnickname', () => {
      window.dispatchEvent(new CustomEvent('show-mc-nickname-modal'));
    });
    
    // Escape to close modals
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (UIState.activeModal) closeModal(UIState.activeModal);
        if (UIState.profileOpen) closeProfile();
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════════

  function init() {
    injectComponents();
    setupEventListeners();
    syncAuthToUI();
    initSettings();
    
    // Apply visual preferences from in-memory settings (system preferences)
    document.body.classList.toggle('reduced-motion', inMemorySettings.reducedMotion);
    document.body.classList.toggle('high-contrast', inMemorySettings.highContrast);
    
    const canvas = document.getElementById('starCanvas');
    if (canvas) canvas.style.opacity = inMemorySettings.starsEnabled ? '1' : '0';

    // Enable transitions after first paint to prevent white flash
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.body.classList.add('transitions-enabled');
      });
    });
    
    // NO auto auth init on public pages!
    // Auth is checked lazily: only on protected pages (via guards-new.js)
    // or when user clicks Dashboard/Account button
    // This ensures 0 /session requests on public pages

    console.log('[PrismMTR] Components initialized');
  }

  // Wait for DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Update notification badge count
  function updateNotificationBadge(count) {
    const badge = document.querySelector('.notifications__badge');
    const countEl = document.querySelector('.notifications__count');
    
    if (badge) {
      badge.textContent = count > 99 ? '99+' : count;
      badge.style.display = count > 0 ? 'flex' : 'none';
    }
    
    if (countEl) {
      countEl.textContent = `${count} unread`;
    }
  }

  // Expose for external use
  window.PrismUI = {
    openModal,
    closeModal,
    showToast,
    showConfirm,
    closeConfirm,
    syncAuthToUI,
    updateNotificationBadge,
    openLoginModal: () => openModal('loginModal'),
    openSettingsModal: () => openModal('settingsModal'),
  };

})();
