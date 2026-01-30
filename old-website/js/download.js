/* ═══════════════════════════════════════════════════════════════════════════
   PrismMTR - Download Page Logic
   Auth-gated download with platform detection
   ═══════════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════════
  // CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════════
  
  // Download URL - can be replaced via Netlify environment variable injection
  const DOWNLOAD_LAUNCHER = 'https://example.com/PrismMTR-Launcher.exe';

  // ═══════════════════════════════════════════════════════════════════════════
  // ELEMENTS
  // ═══════════════════════════════════════════════════════════════════════════

  const authGate = document.getElementById('authGate');
  const downloadReady = document.getElementById('downloadReady');
  const downloadBtn = document.getElementById('downloadBtn');
  const userAvatar = document.getElementById('userAvatar');
  const userName = document.getElementById('userName');

  // ═══════════════════════════════════════════════════════════════════════════
  // STATE SYNC
  // ═══════════════════════════════════════════════════════════════════════════

  function syncDownloadUI() {
    const isLoggedIn = PrismAuth.isLoggedIn();
    const user = PrismAuth.getUser();
    
    if (isLoggedIn && user) {
      // Check if MC nickname is required
      if (PrismAuth.requiresMcNickname()) {
        showMcNicknameModal();
        return;
      }
      
      // Show download ready state
      authGate.style.display = 'none';
      downloadReady.style.display = 'flex';
      
      // Update user info
      const initials = (user.nickname || user.mcNickname || 'U').slice(0, 2).toUpperCase();
      userAvatar.textContent = initials;
      userName.textContent = user.nickname || user.mcNickname || 'User';
    } else {
      // Show auth gate
      authGate.style.display = 'flex';
      downloadReady.style.display = 'none';
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MC NICKNAME MODAL
  // ═══════════════════════════════════════════════════════════════════════════

  async function showMcNicknameModal() {
    const user = PrismAuth.getUser();
    const currentNickname = user?.mcNickname;
    const isChange = !!currentNickname;

    // Check for pending request if this is a nickname change
    let hasPendingRequest = false;
    let pendingRequest = null;
    if (isChange && window.PrismDB) {
      try {
        hasPendingRequest = await PrismDB.NicknameRequests.hasPendingRequest(user.id);
        if (hasPendingRequest) {
          const requests = await PrismDB.NicknameRequests.getByUser(user.id);
          pendingRequest = requests.find(r => r.status === 'pending');
        }
      } catch (e) {
        console.warn('[NicknameModal] Could not check pending requests:', e);
      }
    }

    // If user has a pending request, show the pending state modal
    if (hasPendingRequest && pendingRequest) {
      showPendingNicknameModal(pendingRequest);
      return;
    }

    // Create blocking modal for MC nickname
    const modal = document.createElement('div');
    modal.className = 'modal open';
    modal.id = 'mcNicknameModal';

    const title = isChange ? 'Change Your Nickname' : 'Set Your Nickname';
    const subtitle = isChange
      ? 'Request a new Minecraft username'
      : 'Enter your Minecraft username to continue';
    const submitText = isChange ? 'Submit Request' : 'Continue to Download';
    const infoText = isChange
      ? 'Nickname changes require moderator approval. You will be notified when your request is reviewed.'
      : 'This nickname will be used for the whitelist and to identify you in-game. Make sure it matches your Minecraft account.';

    modal.innerHTML = `
      <div class="modal__backdrop"></div>
      <div class="modal__container">
        <div class="mc-nickname-card">
          <!-- Header -->
          <div class="mc-nickname-card__header">
            <div class="mc-nickname-card__icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                ${isChange
                  ? '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>'
                  : '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h.01M15 9h.01M9 15h6"/>'}
              </svg>
            </div>
            <h2 class="mc-nickname-card__title">${title}</h2>
            <p class="mc-nickname-card__subtitle">${subtitle}</p>
          </div>

          ${isChange ? `
          <!-- Current Nickname -->
          <div class="mc-nickname-card__current">
            <span class="mc-nickname-card__current-label">Current:</span>
            <span class="mc-nickname-card__current-value">${currentNickname}</span>
          </div>
          ` : ''}

          <!-- Info Box -->
          <div class="mc-nickname-card__info ${isChange ? 'mc-nickname-card__info--warning' : ''}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              ${isChange
                ? '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>'
                : '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>'}
            </svg>
            <p>${infoText}</p>
          </div>

          <!-- Form -->
          <div class="mc-nickname-card__form">
            <label class="mc-nickname-card__label" for="mcNicknameInput">
              ${isChange ? 'New Minecraft Username' : 'Minecraft Username'}
            </label>
            <div class="mc-nickname-card__input-wrapper">
              <input type="text"
                     class="mc-nickname-card__input"
                     id="mcNicknameInput"
                     placeholder="e.g. Steve_123"
                     maxlength="16"
                     pattern="[a-zA-Z0-9_]+"
                     autocomplete="off"
                     spellcheck="false">
              <span class="mc-nickname-card__counter"><span id="charCount">0</span>/16</span>
            </div>

            <!-- Validation Rules -->
            <div class="mc-nickname-card__rules">
              <div class="mc-nickname-card__rule" id="ruleLength">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                </svg>
                <span>3-16 characters</span>
              </div>
              <div class="mc-nickname-card__rule" id="ruleChars">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                </svg>
                <span>Letters, numbers, underscores only</span>
              </div>
            </div>

            <p class="mc-nickname-card__status" id="mcNicknameStatus"></p>
          </div>

          <!-- Actions -->
          <div class="mc-nickname-card__actions">
            ${isChange ? `
            <button class="mc-nickname-card__cancel" id="mcNicknameCancel">
              Cancel
            </button>
            ` : ''}
            <button class="mc-nickname-card__submit" id="mcNicknameSubmit">
              <span>${submitText}</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';

    const input = document.getElementById('mcNicknameInput');
    const submitBtn = document.getElementById('mcNicknameSubmit');
    const cancelBtn = document.getElementById('mcNicknameCancel');
    const status = document.getElementById('mcNicknameStatus');
    const charCount = document.getElementById('charCount');
    const ruleLength = document.getElementById('ruleLength');
    const ruleChars = document.getElementById('ruleChars');

    input.focus();

    // Cancel button (only for changes)
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        modal.remove();
        document.body.style.overflow = '';
      });
    }

    // Live validation
    input.addEventListener('input', () => {
      const val = input.value;
      charCount.textContent = val.length;

      // Length check
      const lengthValid = val.length >= 3 && val.length <= 16;
      ruleLength.classList.toggle('valid', lengthValid);
      ruleLength.classList.toggle('invalid', val.length > 0 && !lengthValid);

      // Characters check
      const charsValid = /^[a-zA-Z0-9_]*$/.test(val);
      ruleChars.classList.toggle('valid', val.length > 0 && charsValid);
      ruleChars.classList.toggle('invalid', val.length > 0 && !charsValid);

      // Clear error status on input
      status.textContent = '';
    });

    // Handle submit
    async function submit() {
      const nickname = input.value.trim();

      if (!nickname) {
        status.textContent = 'Please enter a nickname';
        status.className = 'mc-nickname-card__status error';
        return;
      }

      if (nickname.length < 3 || nickname.length > 16) {
        status.textContent = 'Must be 3-16 characters';
        status.className = 'mc-nickname-card__status error';
        return;
      }

      if (!/^[a-zA-Z0-9_]+$/.test(nickname)) {
        status.textContent = 'Only letters, numbers, and underscores';
        status.className = 'mc-nickname-card__status error';
        return;
      }

      // Check if same as current
      if (isChange && nickname.toLowerCase() === currentNickname.toLowerCase()) {
        status.textContent = 'New nickname must be different from current';
        status.className = 'mc-nickname-card__status error';
        return;
      }

      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span>Saving...</span>';
      status.textContent = '';

      try {
        if (isChange && window.PrismDB) {
          // Submit moderation request instead of directly updating
          await PrismDB.NicknameRequests.create(user.id, currentNickname, nickname);

          // Remove modal
          modal.remove();
          document.body.style.overflow = '';

          // Show success message
          if (window.PrismUI) {
            window.PrismUI.showToast('Request Submitted', 'Your nickname change request is pending approval.');
          }
        } else {
          // First-time set - directly update
          await PrismAuth.setMcNickname(nickname);

          // Remove modal
          modal.remove();
          document.body.style.overflow = '';

          // Update UI
          syncDownloadUI();

          // Show success
          if (window.PrismUI) {
            window.PrismUI.showToast('Nickname Set', `Welcome, ${nickname}!`);
          }
        }
      } catch (error) {
        status.textContent = error.message;
        status.className = 'mc-nickname-card__status error';
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<span>${submitText}</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>`;
      }
    }

    submitBtn.addEventListener('click', submit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submit();
    });
  }

  // Show pending request modal
  function showPendingNicknameModal(request) {
    const modal = document.createElement('div');
    modal.className = 'modal open';
    modal.id = 'mcNicknamePendingModal';

    const requestDate = new Date(request.createdAt).toLocaleDateString();

    modal.innerHTML = `
      <div class="modal__backdrop"></div>
      <div class="modal__container">
        <div class="mc-nickname-card">
          <!-- Header -->
          <div class="mc-nickname-card__header">
            <div class="mc-nickname-card__icon mc-nickname-card__icon--pending">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
            </div>
            <h2 class="mc-nickname-card__title">Request Pending</h2>
            <p class="mc-nickname-card__subtitle">Your nickname change is awaiting review</p>
          </div>

          <!-- Request Details -->
          <div class="mc-nickname-card__pending-details">
            <div class="mc-nickname-card__pending-row">
              <span class="mc-nickname-card__pending-label">Current:</span>
              <span class="mc-nickname-card__pending-value">${request.currentNickname}</span>
            </div>
            <div class="mc-nickname-card__pending-arrow">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="5" y1="12" x2="19" y2="12"/>
                <polyline points="12 5 19 12 12 19"/>
              </svg>
            </div>
            <div class="mc-nickname-card__pending-row">
              <span class="mc-nickname-card__pending-label">Requested:</span>
              <span class="mc-nickname-card__pending-value mc-nickname-card__pending-value--new">${request.requestedNickname}</span>
            </div>
          </div>

          <!-- Info Box -->
          <div class="mc-nickname-card__info">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="16" x2="12" y2="12"/>
              <line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
            <p>Submitted on ${requestDate}. You'll receive a notification when a moderator reviews your request.</p>
          </div>

          <!-- Actions -->
          <button class="mc-nickname-card__submit" id="mcNicknamePendingClose">
            <span>Got it</span>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';

    document.getElementById('mcNicknamePendingClose').addEventListener('click', () => {
      modal.remove();
      document.body.style.overflow = '';
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PLATFORM DETECTION
  // ═══════════════════════════════════════════════════════════════════════════

  function detectPlatform() {
    const platform = navigator.platform.toLowerCase();
    const userAgent = navigator.userAgent.toLowerCase();
    
    if (platform.includes('win') || userAgent.includes('windows')) {
      return 'windows';
    } else if (platform.includes('mac') || userAgent.includes('mac')) {
      return 'mac';
    } else if (platform.includes('linux') || userAgent.includes('linux')) {
      return 'linux';
    }
    
    return 'windows'; // Default
  }

  function setupPlatformSelector() {
    const buttons = document.querySelectorAll('.platform-btn');
    const detected = detectPlatform();
    
    // Select detected platform if available
    buttons.forEach(btn => {
      if (btn.dataset.platform === detected && !btn.disabled) {
        btn.classList.add('active');
      }
    });
    
    // Handle clicks
    buttons.forEach(btn => {
      if (!btn.disabled) {
        btn.addEventListener('click', () => {
          buttons.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
        });
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DOWNLOAD HANDLER
  // ═══════════════════════════════════════════════════════════════════════════

  function setupDownloadButton() {
    downloadBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      
      // Get download URL from data attribute (set by Netlify) or use default
      const downloadUrl = downloadBtn.dataset.downloadUrl || DOWNLOAD_LAUNCHER;
      
      // Simulate download start
      downloadBtn.innerHTML = `
        <svg class="btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 6v6l4 2"/>
        </svg>
        Starting Download...
      `;
      
      setTimeout(() => {
        downloadBtn.innerHTML = `
          <svg class="btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          Download Started!
        `;
        
        if (window.PrismUI) {
          window.PrismUI.showToast('Download Started', 'PrismMTR is downloading...');
        }
        
        // Reset button after delay
        setTimeout(() => {
          downloadBtn.innerHTML = `
            <svg class="btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Download Launcher
          `;
        }, 3000);
        
        // In production: window.location.href = downloadUrl;
      }, 1500);
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EVENT LISTENERS
  // ═══════════════════════════════════════════════════════════════════════════

  function setupEventListeners() {
    // Listen for auth changes
    window.addEventListener('prism:logout', syncDownloadUI);
    
    // Listen for login success
    document.addEventListener('click', (e) => {
      // After login modal closes, check auth
      if (e.target.closest('[data-action="close-modal"]')) {
        setTimeout(syncDownloadUI, 100);
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════════

  function init() {
    if (document.body.dataset.page !== 'download') return;
    
    setupPlatformSelector();
    setupDownloadButton();
    setupEventListeners();
    syncDownloadUI();
    
    console.log('[PrismMTR] Download page initialized');
  }

  // Wait for DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(init, 100);
    });
  } else {
    setTimeout(init, 100);
  }

})();
