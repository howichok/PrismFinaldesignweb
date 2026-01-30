/**
 * PrismMTR Help Center - JavaScript
 * Clean, functional ticket submission with Discord webhook
 */

(function() {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════════
  // CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════════

  const DISCORD_WEBHOOK_URL = 'YOUR_DISCORD_WEBHOOK_URL_HERE';

  // ═══════════════════════════════════════════════════════════════════════════
  // DOM ELEMENTS
  // ═══════════════════════════════════════════════════════════════════════════

  const elements = {
    // Gates
    gateLogin: document.getElementById('ticketGateLogin'),
    gateDiscord: document.getElementById('ticketGateDiscord'),

    // Ticket section
    ticketSection: document.getElementById('ticketSection'),
    ticketCard: document.getElementById('ticketCard'),

    // Form
    form: document.getElementById('ticketForm'),
    formEl: document.getElementById('ticketFormEl'),
    category: document.getElementById('ticketCategory'),
    priority: document.getElementById('ticketPriority'),
    subject: document.getElementById('ticketSubject'),
    message: document.getElementById('ticketMessage'),
    charCount: document.getElementById('charCount'),
    submitBtn: document.getElementById('submitTicketBtn'),

    // User display
    avatar: document.getElementById('ticketUserAvatar'),
    name: document.getElementById('ticketUserName'),
    discord: document.getElementById('ticketUserDiscord'),

    // Success
    success: document.getElementById('ticketSuccess'),

    // Buttons
    connectDiscordBtn: document.getElementById('connectDiscordBtn'),
    newTicketBtn: document.getElementById('newTicketBtn'),

    // Search
    searchInput: document.getElementById('helpSearch'),

    // FAQ filters
    faqFilters: document.querySelectorAll('.faq-filter'),
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // STATE MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  function hideAll() {
    elements.gateLogin?.classList.add('ticket-gate--hidden');
    elements.gateDiscord?.classList.add('ticket-gate--hidden');
    elements.form?.classList.add('ticket-gate--hidden');
    elements.success?.classList.add('ticket-gate--hidden');
  }

  function show(element) {
    element?.classList.remove('ticket-gate--hidden');
  }

  function updateUI() {
    hideAll();

    const user = PrismAuth?.currentUser;

    if (!user) {
      show(elements.gateLogin);
      return;
    }

    const hasDiscord = PrismAuth?.hasDiscord?.() || false;

    if (!hasDiscord) {
      show(elements.gateDiscord);
      return;
    }

    // Show form
    show(elements.form);
    populateUserInfo(user);
  }

  function populateUserInfo(user) {
    if (!user) return;

    // Avatar
    if (elements.avatar) {
      const initial = (user.nickname || user.mcNickname || user.email || 'U').charAt(0).toUpperCase();
      elements.avatar.textContent = initial;
    }

    // Name
    if (elements.name) {
      elements.name.textContent = user.nickname || user.mcNickname || user.email || 'User';
    }

    // Discord
    if (elements.discord) {
      const discordName = user.connections?.discord?.username || 'Discord Connected';
      elements.discord.querySelector('span').textContent = discordName;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FORM HANDLING
  // ═══════════════════════════════════════════════════════════════════════════

  function updateCharCount() {
    if (elements.charCount && elements.message) {
      elements.charCount.textContent = elements.message.value.length;
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const user = PrismAuth?.currentUser;
    if (!user) {
      PrismUI?.showToast?.('Login Required', 'You must be logged in to submit a ticket.', 5000);
      return;
    }

    const category = elements.category?.value;
    const priority = elements.priority?.value;
    const subject = elements.subject?.value?.trim();
    const message = elements.message?.value?.trim();

    if (!category || !subject || !message) {
      PrismUI?.showToast?.('Missing Fields', 'Please fill in all required fields.', 4000);
      return;
    }

    if (message.length < 20) {
      PrismUI?.showToast?.('Message Too Short', 'Message must be at least 20 characters.', 4000);
      return;
    }

    // Disable submit
    if (elements.submitBtn) {
      elements.submitBtn.disabled = true;
      elements.submitBtn.innerHTML = `
        <svg class="spinner" viewBox="0 0 24 24" width="20" height="20">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" fill="none" stroke-dasharray="31.4" stroke-linecap="round">
            <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite"/>
          </circle>
        </svg>
        Submitting...
      `;
    }

    try {
      await sendToDiscord({
        userId: user.id,
        email: user.email,
        mcNickname: user.mcNickname || 'Not set',
        nickname: user.nickname || user.email,
        discordUser: user.connections?.discord?.username || 'Unknown',
        category,
        priority,
        subject,
        message,
        timestamp: new Date().toISOString(),
      });

      // Show success
      hideAll();
      show(elements.success);

      // Reset form
      elements.formEl?.reset();
      updateCharCount();

    } catch (error) {
      console.error('[Help] Failed to submit ticket:', error);
      PrismUI?.showToast?.('Submission Failed', 'Failed to submit ticket. Please try again or contact us on Discord.', 6000);
    } finally {
      if (elements.submitBtn) {
        elements.submitBtn.disabled = false;
        elements.submitBtn.innerHTML = `
          <img src="assets/img/PrismMTRlogo-sm.png" alt="PrismMTR" width="20" height="20" style="display: inline-block; vertical-align: middle; margin-right: 8px;">
          Submit Ticket
        `;
      }
    }
  }

  async function sendToDiscord(data) {
    const priorityColors = {
      low: 0x3b82f6,
      medium: 0xf59e0b,
      high: 0xef4444,
    };

    const embed = {
      title: `📩 ${data.subject}`,
      color: priorityColors[data.priority] || 0x3b82f6,
      fields: [
        { name: 'Category', value: data.category, inline: true },
        { name: 'Priority', value: data.priority.toUpperCase(), inline: true },
        { name: 'User', value: data.nickname, inline: true },
        { name: 'Discord', value: data.discordUser, inline: true },
        { name: 'MC Nickname', value: data.mcNickname, inline: true },
        { name: 'Email', value: data.email, inline: true },
        { name: 'Message', value: data.message.substring(0, 1000) },
      ],
      timestamp: data.timestamp,
      footer: { text: `User ID: ${data.userId}` },
    };

    const response = await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
    });

    if (!response.ok) {
      throw new Error(`Discord webhook failed: ${response.status}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SEARCH & FAQ FILTERING
  // ═══════════════════════════════════════════════════════════════════════════

  let activeFilter = 'all';

  function handleSearch() {
    const query = elements.searchInput?.value?.toLowerCase().trim() || '';
    filterFAQ(query, activeFilter);
  }

  function handleFilterClick(e) {
    const btn = e.target.closest('.faq-filter');
    if (!btn) return;

    // Update active state
    elements.faqFilters.forEach(f => f.classList.remove('active'));
    btn.classList.add('active');

    activeFilter = btn.dataset.filter || 'all';
    const query = elements.searchInput?.value?.toLowerCase().trim() || '';
    filterFAQ(query, activeFilter);
  }

  function filterFAQ(query, category) {
    const faqItems = document.querySelectorAll('.faq-item');
    const noResultsEl = document.getElementById('faqNoResults');

    let visibleCount = 0;

    faqItems.forEach(item => {
      const itemCategory = item.dataset.category || '';
      const question = item.querySelector('.faq-item__question span')?.textContent?.toLowerCase() || '';
      const answer = item.querySelector('.faq-item__answer')?.textContent?.toLowerCase() || '';

      const matchesCategory = category === 'all' || itemCategory === category;
      const matchesQuery = query === '' || question.includes(query) || answer.includes(query);

      if (matchesCategory && matchesQuery) {
        item.style.display = '';
        visibleCount++;
      } else {
        item.style.display = 'none';
      }
    });

    // Show/hide no results state
    if (noResultsEl) {
      if (visibleCount === 0) {
        noResultsEl.style.display = 'block';
      } else {
        noResultsEl.style.display = 'none';
      }
    }
  }

  function toggleTicketSection() {
    if (elements.ticketSection) {
      const isVisible = elements.ticketSection.style.display !== 'none';
      elements.ticketSection.style.display = isVisible ? 'none' : 'block';
      if (!isVisible) {
        updateUI();
        elements.ticketSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EVENT LISTENERS
  // ═══════════════════════════════════════════════════════════════════════════

  function setupEventListeners() {
    // Character counter
    elements.message?.addEventListener('input', updateCharCount);

    // Form submission
    elements.formEl?.addEventListener('submit', handleSubmit);

    // New ticket button
    elements.newTicketBtn?.addEventListener('click', () => {
      hideAll();
      show(elements.form);
    });

    // Connect Discord button - redirect to auth endpoint
    elements.connectDiscordBtn?.addEventListener('click', () => {
      const next = encodeURIComponent(window.location.pathname);
      window.location.href = `/.netlify/functions/auth-discord?next=${next}`;
    });

    // Search input
    elements.searchInput?.addEventListener('input', handleSearch);

    // FAQ filters
    elements.faqFilters.forEach(btn => btn.addEventListener('click', handleFilterClick));

    // Ticket card (opens ticket section)
    elements.ticketCard?.addEventListener('click', toggleTicketSection);

    // Auth state changes
    window.addEventListener('prism:auth:changed', updateUI);
    window.addEventListener('auth-state-changed', updateUI);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════════

  function init() {
    if (document.body.dataset.page !== 'help') return;

    setupEventListeners();
    updateUI();

    console.log('[Help] Page initialized');
  }

  // Wait for DOM and auth
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 100));
  } else {
    setTimeout(init, 100);
  }

})();
