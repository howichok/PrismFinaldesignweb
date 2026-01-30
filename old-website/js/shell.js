/* PrismMTR Shell (shared header/profile)
   Keep profile UI consistent across pages without copy/paste.

   Usage:
   - <body data-shell="header">  -> inject full header (logo + nav + profile)
   - <body data-shell="profile"> -> inject floating profile button + dropdown
   - Load js/auth.js before this file.
*/

(function () {
  if (!window.PrismAuth) return;

  const state = () => PrismAuth.read();
  // auth.js exposes: { isLoggedIn, username, email, darkMode }
  const isAuthed = () => !!state().isLoggedIn;
  const getUser = () => {
    const st = state();
    return {
      name: st.username || 'Prism User',
      email: st.email || 'user@prism.mtr',
      avatar: st.avatar || null
    };
  };

  function applyDarkModeFromState() {
    const st = state();
    const on = !!st.darkMode;
    document.body.classList.toggle('dark-mode', on);
  }

  function currentFile() {
    const p = (location.pathname || '').split('/').pop();
    return p || 'index.html';
  }

  function avatarMarkup(user) {
    const name = user?.name || 'Prism User';
    const initials = name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(s => s[0].toUpperCase())
      .join('');

    // Use Discord avatar if available, otherwise fallback to ui-avatars
    const st = state();
    const avatarUrl = st.avatar || user?.avatar;
    
    let url;
    if (avatarUrl) {
      url = avatarUrl;
    } else {
      const bg = document.body.classList.contains('dark-mode') ? '0f0f0f' : 'ffffff';
      const fg = document.body.classList.contains('dark-mode') ? 'ffffff' : '111111';
      url = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=${bg}&color=${fg}&bold=true&rounded=true&size=96`;
    }

    return `
      <div class="avatar avatar--circular" style="background-image:url('${url}')" aria-label="${name}">
        <span class="fallback">${initials}</span>
      </div>
    `;
  }

  function injectHeader() {
    if (document.getElementById('main-header')) return;
    if (document.querySelector('header.app-header')) return; // Если header.js уже инъектировал

    const header = document.createElement('header');
    header.id = 'main-header';
    header.innerHTML = `
      <div class="logo hover-target" id="shellLogo">PrismMTR</div>

      <nav>
        <a class="nav-link hover-target" href="index.html" data-nav="index.html">Home</a>
        <a class="nav-link hover-target" href="download.html" data-nav="download.html">Download</a>
        <a class="nav-link hover-target" href="help.html" data-nav="help.html">Help</a>
      </nav>

      <div class="profile-container" id="shellProfile">
        <div class="profile-btn hover-target" id="profileTrigger" aria-label="Profile"></div>
        <div class="dropdown-menu" id="profileMenu"></div>
      </div>
    `;

    document.body.insertBefore(header, document.body.firstChild);

    // Active link
    const file = currentFile();
    header.querySelectorAll('[data-nav]').forEach(a => {
      a.classList.toggle('active', a.getAttribute('data-nav') === file);
    });

    // Logo -> home
    header.querySelector('#shellLogo')?.addEventListener('click', () => {
      location.href = 'index.html';
    });
  }

  function injectFloatingProfile() {
    if (document.getElementById('shellFloatingProfile')) return;
    if (document.getElementById('profileTrigger')) return;

    const wrap = document.createElement('div');
    wrap.id = 'shellFloatingProfile';
    wrap.className = 'floating-profile';
    wrap.innerHTML = `
      <div class="profile-container">
        <div class="profile-btn hover-target" id="profileTrigger" aria-label="Profile"></div>
        <div class="dropdown-menu" id="profileMenu"></div>
      </div>
    `;
    document.body.appendChild(wrap);
  }

  function buildMenuHTML(user) {
    const name = user?.name || 'Prism User';
    const email = user?.email || 'user@prism.mtr';

    // Match index.html dropdown structure & styling
    if (!isAuthed()) {
      return `<a href="#" class="menu-item hover-target" id="shellLoginBtn">Log In / Register</a>`;
    }

    return `
      <div class="user-info">
        <div class="u-name">${name}</div>
        <div class="u-email">${email}</div>
      </div>
      <a href="#" class="menu-item hover-target" id="shellSettingsBtn">Settings</a>
      <div class="menu-divider"></div>
      <a href="#" class="menu-item hover-target" id="shellLogoutBtn">Log out</a>
    `;
  }

  function wireHoverTargets(root) {
    const els = root.querySelectorAll('.hover-target');
    els.forEach(el => {
      el.addEventListener('mouseenter', () => document.body.classList.add('hovering'));
      el.addEventListener('mouseleave', () => document.body.classList.remove('hovering'));
    });
  }

  function renderProfileUI() {
    applyDarkModeFromState();

    const trigger = document.getElementById('profileTrigger');
    const menu = document.getElementById('profileMenu');
    if (!trigger || !menu) return;

    const user = getUser();

    // Avatar/icon
    if (isAuthed()) {
      trigger.innerHTML = avatarMarkup(user);
    } else {
      trigger.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
      `;
    }

    menu.innerHTML = buildMenuHTML(user);
    wireHoverTargets(menu);

    // Actions
    const loginBtn = document.getElementById('shellLoginBtn');
    loginBtn?.addEventListener('click', () => {
      // Go to index login overlay and return back
      PrismAuth.setRedirect(currentFile());
      location.href = `index.html?login=1`;
    });

    const settingsBtn = document.getElementById('shellSettingsBtn');
    settingsBtn?.addEventListener('click', () => {
      // Open settings on index (keeps overlay logic in one place)
      location.href = `index.html?settings=1`;
    });

    const logoutBtn = document.getElementById('shellLogoutBtn');
    logoutBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      if (typeof AuthManager !== 'undefined' && AuthManager.logout) {
        AuthManager.logout();
      } else if (window.PrismAuth?.logout) {
        PrismAuth.logout();
      } else {
        window.location.href = 'index.html';
      }
      renderProfileUI();
      try { menu.classList.remove('active'); } catch (_) {}
    });
  }

  function wireMenuToggle() {
    const trigger = document.getElementById('profileTrigger');
    const menu = document.getElementById('profileMenu');
    if (!trigger || !menu) return;

    function close() { menu.classList.remove('active'); }

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      menu.classList.toggle('active');
    });

    document.addEventListener('click', (e) => {
      if (!menu.classList.contains('active')) return;
      const within = menu.contains(e.target) || trigger.contains(e.target);
      if (!within) close();
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();
    });
  }

  function boot() {
    const mode = document.body.dataset.shell || '';
    if (!document.getElementById('profileTrigger')) {
      if (mode === 'header') injectHeader();
      else if (mode === 'profile') injectFloatingProfile();
    }

    // If the page already has a header (index), just wire up.
    renderProfileUI();
    wireMenuToggle();
    wireHoverTargets(document);

    // Keep in sync if login happens in another tab
    window.addEventListener('storage', (ev) => {
      // auth.js uses AUTH_KEY="prismmtr_auth_v1"
      const key = PrismAuth.AUTH_KEY || 'prismmtr_auth_v1';
      if (ev.key === key) renderProfileUI();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
