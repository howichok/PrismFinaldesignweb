/**
 * PrismMTR - Shared Create Modals
 *
 * Provides Create Project/Post/Company modal functionality
 * that can be used on any dashboard page without redirecting.
 *
 * USAGE:
 * Include this script after auth.js and supabase.js:
 * <script src="js/create-modals.js"></script>
 *
 * Then call:
 * - PrismCreateModals.openProject()
 * - PrismCreateModals.openPost()
 * - PrismCreateModals.openCompany()
 */

(function() {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════════════════

  let currentUser = null;
  let userCompanies = [];
  let projectImageData = null;
  let postImageData = null;
  let projectWizardStep = 1;
  let postWizardStep = 1;
  let projectCoowners = [];
  let projectMembers = [];
  let initialized = false;

  // ═══════════════════════════════════════════════════════════════════════════
  // MODAL HTML TEMPLATES
  // ═══════════════════════════════════════════════════════════════════════════

  function getProjectModalHTML() {
    return `
    <div class="modal" id="createProjectModal">
      <div class="modal__backdrop" data-action="close-project-modal" aria-hidden="true"></div>
      <div class="modal__container modal__container--xl">
        <button class="modal__close" data-action="close-project-modal" aria-label="Close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>

        <div class="creation-wizard" id="projectWizard">
          <div class="wizard-progress">
            <div class="wizard-progress__step active" data-step="1">
              <div class="wizard-progress__number">1</div>
              <span class="wizard-progress__label">Type</span>
            </div>
            <div class="wizard-progress__line"></div>
            <div class="wizard-progress__step" data-step="2">
              <div class="wizard-progress__number">2</div>
              <span class="wizard-progress__label">Details</span>
            </div>
          </div>

          <form id="createProjectForm">
            <!-- Step 1: Category Selection -->
            <div class="wizard-step active" data-wizard-step="1">
              <div class="wizard-step__header">
                <h2 class="wizard-step__title">What are you building?</h2>
                <p class="wizard-step__subtitle">Choose the type of project you want to create</p>
              </div>

              <div class="category-grid category-grid--2x2" id="projectCategoryGrid">
                <label class="category-card category-card--large">
                  <input type="radio" name="projectCategory" value="building" required>
                  <div class="category-card__content">
                    <div class="category-card__icon category-card__icon--building">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/>
                        <path d="M9 9h1"/><path d="M9 13h1"/><path d="M9 17h1"/>
                      </svg>
                    </div>
                    <h3 class="category-card__title">Building</h3>
                    <p class="category-card__desc">Standalone structures like depots, offices, or facilities</p>
                  </div>
                </label>

                <label class="category-card category-card--large">
                  <input type="radio" name="projectCategory" value="station">
                  <div class="category-card__content">
                    <div class="category-card__icon category-card__icon--station">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/>
                        <path d="M12 2v4"/><path d="M12 18v4"/><path d="M2 12h4"/><path d="M18 12h4"/>
                      </svg>
                    </div>
                    <h3 class="category-card__title">Station</h3>
                    <p class="category-card__desc">Metro stations with platforms and facilities</p>
                  </div>
                </label>

                <label class="category-card category-card--large">
                  <input type="radio" name="projectCategory" value="line_section">
                  <div class="category-card__content">
                    <div class="category-card__icon category-card__icon--section">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M4 12h16"/><circle cx="6" cy="12" r="2"/><circle cx="18" cy="12" r="2"/>
                        <path d="M8 12h8"/>
                      </svg>
                    </div>
                    <h3 class="category-card__title">Line Section</h3>
                    <p class="category-card__desc">A portion of track between stations</p>
                  </div>
                </label>

                <label class="category-card category-card--large">
                  <input type="radio" name="projectCategory" value="line">
                  <div class="category-card__content">
                    <div class="category-card__icon category-card__icon--line">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
                        <line x1="4" y1="22" x2="4" y2="15"/>
                      </svg>
                    </div>
                    <h3 class="category-card__title">Line / Extension</h3>
                    <p class="category-card__desc">Complete metro lines or extensions</p>
                  </div>
                </label>
              </div>

              <div class="wizard-actions">
                <button type="button" class="btn btn--ghost" data-action="close-project-modal">Cancel</button>
                <button type="button" class="btn btn--primary" data-action="project-wizard-next" disabled id="projectStep1Next">
                  Continue
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </button>
              </div>
            </div>

            <!-- Step 2: Project Details -->
            <div class="wizard-step" data-wizard-step="2">
              <div class="wizard-step__header">
                <h2 class="wizard-step__title">Project details</h2>
                <p class="wizard-step__subtitle">Tell us about your creation</p>
              </div>

              <div class="wizard-form wizard-form--split">
                <div class="wizard-form__left">
                  <div class="form-group">
                    <label class="form-label">Cover Image <span class="form-hint">(optional)</span></label>
                    <div class="image-upload image-upload--large" id="projectImageUpload">
                      <input type="file" id="projectImageInput" accept="image/*" hidden>
                      <div class="image-upload__placeholder" id="projectImagePlaceholder">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                          <circle cx="8.5" cy="8.5" r="1.5"/>
                          <polyline points="21 15 16 10 5 21"/>
                        </svg>
                        <span>Click to upload</span>
                        <span class="image-upload__hint">Max 2MB, JPG or PNG</span>
                      </div>
                      <img class="image-upload__preview" id="projectImagePreview" style="display: none;" alt="Preview">
                      <button type="button" class="image-upload__remove" id="projectImageRemove" style="display: none;">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                          <line x1="18" y1="6" x2="6" y2="18"/>
                          <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>

                <div class="wizard-form__right">
                  <div class="form-group">
                    <label class="form-label" for="projectName">
                      Project Name
                      <span class="form-label__counter"><span id="projectNameCount">0</span>/50</span>
                    </label>
                    <input type="text" class="form-input form-input--lg" id="projectName" placeholder="My Awesome Build" required maxlength="50">
                  </div>

                  <div class="form-group">
                    <label class="form-label" for="projectDescription">
                      Description
                      <span class="form-label__counter"><span id="projectDescCount">0</span>/500</span>
                    </label>
                    <textarea class="form-textarea" id="projectDescription" placeholder="Tell us about your project..." required minlength="20" maxlength="500" rows="4"></textarea>
                  </div>

                  <div class="form-group">
                    <label class="form-label" for="projectStatus">Status</label>
                    <div class="status-selector">
                      <label class="status-option">
                        <input type="radio" name="projectStatus" value="planning">
                        <span class="status-option__badge status-option__badge--planning">Planning</span>
                      </label>
                      <label class="status-option">
                        <input type="radio" name="projectStatus" value="active" checked>
                        <span class="status-option__badge status-option__badge--active">Active</span>
                      </label>
                      <label class="status-option">
                        <input type="radio" name="projectStatus" value="completed">
                        <span class="status-option__badge status-option__badge--completed">Completed</span>
                      </label>
                      <label class="status-option">
                        <input type="radio" name="projectStatus" value="paused">
                        <span class="status-option__badge status-option__badge--paused">Paused</span>
                      </label>
                    </div>
                  </div>

                  <div class="form-group" id="projectAuthorGroup">
                    <label class="form-label" for="projectAuthorSelect">Creating as</label>
                    <select class="form-select" id="projectAuthorSelect">
                      <option value="personal">Personal (myself)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div class="wizard-actions">
                <button type="button" class="btn btn--ghost" data-action="project-wizard-prev">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                    <polyline points="15 18 9 12 15 6"/>
                  </svg>
                  Back
                </button>
                <button type="submit" class="btn btn--primary" id="submitProjectBtn">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  <span id="projectSubmitText">Create Project</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>`;
  }

  function getPostModalHTML() {
    return `
    <div class="modal" id="createPostModal">
      <div class="modal__backdrop" data-action="close-post-modal" aria-hidden="true"></div>
      <div class="modal__container modal__container--xl">
        <button class="modal__close" data-action="close-post-modal" aria-label="Close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>

        <div class="creation-wizard" id="postWizard">
          <div class="wizard-progress">
            <div class="wizard-progress__step active" data-step="1">
              <div class="wizard-progress__number">1</div>
              <span class="wizard-progress__label">Type</span>
            </div>
            <div class="wizard-progress__line"></div>
            <div class="wizard-progress__step" data-step="2">
              <div class="wizard-progress__number">2</div>
              <span class="wizard-progress__label">Content</span>
            </div>
          </div>

          <form id="createPostForm">
            <!-- Step 1: Category Selection -->
            <div class="wizard-step active" data-wizard-step="1">
              <div class="wizard-step__header">
                <h2 class="wizard-step__title">What type of post?</h2>
                <p class="wizard-step__subtitle">Choose the category for your post</p>
              </div>

              <div class="category-grid category-grid--2x2" id="postCategoryGrid">
                <label class="category-card category-card--large">
                  <input type="radio" name="postCategory" value="announcement" required>
                  <div class="category-card__content">
                    <div class="category-card__icon category-card__icon--announcement">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                      </svg>
                    </div>
                    <h3 class="category-card__title">Announcement</h3>
                    <p class="category-card__desc">News and important updates</p>
                  </div>
                </label>

                <label class="category-card category-card--large">
                  <input type="radio" name="postCategory" value="devlog">
                  <div class="category-card__content">
                    <div class="category-card__icon category-card__icon--devlog">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                      </svg>
                    </div>
                    <h3 class="category-card__title">Devlog</h3>
                    <p class="category-card__desc">Development progress and logs</p>
                  </div>
                </label>

                <label class="category-card category-card--large">
                  <input type="radio" name="postCategory" value="guide">
                  <div class="category-card__content">
                    <div class="category-card__icon category-card__icon--guide">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                      </svg>
                    </div>
                    <h3 class="category-card__title">Guide / Tutorial</h3>
                    <p class="category-card__desc">How-to guides and tutorials</p>
                  </div>
                </label>

                <label class="category-card category-card--large">
                  <input type="radio" name="postCategory" value="discussion">
                  <div class="category-card__content">
                    <div class="category-card__icon category-card__icon--discussion">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                        <circle cx="9" cy="7" r="4"/>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                      </svg>
                    </div>
                    <h3 class="category-card__title">Discussion</h3>
                    <p class="category-card__desc">Open discussions and feedback</p>
                  </div>
                </label>
              </div>

              <div class="wizard-actions">
                <button type="button" class="btn btn--ghost" data-action="close-post-modal">Cancel</button>
                <button type="button" class="btn btn--primary" data-action="post-wizard-next" disabled id="postStep1Next">
                  Continue
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </button>
              </div>
            </div>

            <!-- Step 2: Post Content -->
            <div class="wizard-step" data-wizard-step="2">
              <div class="wizard-step__header">
                <h2 class="wizard-step__title">Write your post</h2>
                <p class="wizard-step__subtitle">Share your thoughts and updates</p>
              </div>

              <div class="wizard-form">
                <div class="form-group">
                  <label class="form-label" for="postTitle">
                    Title
                    <span class="form-label__counter"><span id="postTitleCount">0</span>/100</span>
                  </label>
                  <input type="text" class="form-input form-input--lg" id="postTitle" placeholder="Post title" required maxlength="100">
                </div>

                <div class="form-group">
                  <label class="form-label" for="postContent">
                    Content
                    <span class="form-hint">(Markdown supported)</span>
                    <span class="form-label__counter"><span id="postContentCount">0</span>/5000</span>
                  </label>
                  <textarea class="form-textarea form-textarea--tall" id="postContent" placeholder="Write your post content..." required minlength="50" maxlength="5000" rows="10"></textarea>
                </div>

                <div class="form-row form-row--2col">
                  <div class="form-group">
                    <label class="form-label">Cover Image <span class="form-hint">(optional)</span></label>
                    <div class="image-upload" id="postImageUpload">
                      <input type="file" id="postImageInput" accept="image/*" hidden>
                      <div class="image-upload__placeholder" id="postImagePlaceholder">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                          <circle cx="8.5" cy="8.5" r="1.5"/>
                          <polyline points="21 15 16 10 5 21"/>
                        </svg>
                        <span>Click to upload</span>
                      </div>
                      <img class="image-upload__preview" id="postImagePreview" style="display: none;" alt="Preview">
                      <button type="button" class="image-upload__remove" id="postImageRemove" style="display: none;">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                          <line x1="18" y1="6" x2="6" y2="18"/>
                          <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div class="form-group" id="postAuthorGroup">
                    <label class="form-label" for="postAuthorSelect">Publishing as</label>
                    <select class="form-select" id="postAuthorSelect">
                      <option value="personal">Personal (myself)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div class="wizard-actions">
                <button type="button" class="btn btn--ghost" data-action="post-wizard-prev">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                    <polyline points="15 18 9 12 15 6"/>
                  </svg>
                  Back
                </button>
                <button type="submit" class="btn btn--primary" id="submitPostBtn">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  <span id="postSubmitText">Publish Post</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>`;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UTILITIES
  // ═══════════════════════════════════════════════════════════════════════════

  function showToast(title, message, type = 'success') {
    if (window.PrismUI && window.PrismUI.showToast) {
      window.PrismUI.showToast(title, message);
    } else {
      console.log(`[CreateModals] ${title}: ${message}`);
    }
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MODAL MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  function injectModal(html, id) {
    // Remove existing modal if any
    const existing = document.getElementById(id);
    if (existing) existing.remove();

    // Inject new modal
    document.body.insertAdjacentHTML('beforeend', html);
    return document.getElementById(id);
  }

  function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
  }

  function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.classList.remove('open');
      document.body.style.overflow = '';
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PROJECT MODAL
  // ═══════════════════════════════════════════════════════════════════════════

  function initProjectModal() {
    const modal = injectModal(getProjectModalHTML(), 'createProjectModal');
    if (!modal) return;

    // Close handlers
    modal.querySelectorAll('[data-action="close-project-modal"]').forEach(el => {
      el.addEventListener('click', () => closeModal('createProjectModal'));
    });

    // Category selection enables next button
    modal.querySelectorAll('input[name="projectCategory"]').forEach(input => {
      input.addEventListener('change', () => {
        const nextBtn = document.getElementById('projectStep1Next');
        if (nextBtn) nextBtn.disabled = false;
      });
    });

    // Wizard navigation
    modal.querySelector('[data-action="project-wizard-next"]')?.addEventListener('click', () => {
      projectWizardStep = 2;
      updateProjectWizard();
    });

    modal.querySelector('[data-action="project-wizard-prev"]')?.addEventListener('click', () => {
      projectWizardStep = 1;
      updateProjectWizard();
    });

    // Character counters
    const nameInput = document.getElementById('projectName');
    const descInput = document.getElementById('projectDescription');
    const nameCount = document.getElementById('projectNameCount');
    const descCount = document.getElementById('projectDescCount');

    if (nameInput && nameCount) {
      nameInput.addEventListener('input', () => {
        nameCount.textContent = nameInput.value.length;
      });
    }

    if (descInput && descCount) {
      descInput.addEventListener('input', () => {
        descCount.textContent = descInput.value.length;
      });
    }

    // Image upload
    const imageUpload = document.getElementById('projectImageUpload');
    const imageInput = document.getElementById('projectImageInput');
    const imagePreview = document.getElementById('projectImagePreview');
    const imagePlaceholder = document.getElementById('projectImagePlaceholder');
    const imageRemove = document.getElementById('projectImageRemove');

    if (imageUpload && imageInput) {
      imageUpload.addEventListener('click', (e) => {
        if (e.target.closest('.image-upload__remove')) return;
        imageInput.click();
      });

      imageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) {
          showToast('Error', 'Image must be less than 2MB');
          return;
        }

        const reader = new FileReader();
        reader.onload = (ev) => {
          projectImageData = ev.target.result;
          if (imagePreview) {
            imagePreview.src = projectImageData;
            imagePreview.style.display = 'block';
          }
          if (imagePlaceholder) imagePlaceholder.style.display = 'none';
          if (imageRemove) imageRemove.style.display = 'flex';
          imageUpload.classList.add('image-upload--has-image');
        };
        reader.readAsDataURL(file);
      });

      if (imageRemove) {
        imageRemove.addEventListener('click', (e) => {
          e.stopPropagation();
          projectImageData = null;
          if (imagePreview) {
            imagePreview.src = '';
            imagePreview.style.display = 'none';
          }
          if (imagePlaceholder) imagePlaceholder.style.display = 'flex';
          imageRemove.style.display = 'none';
          imageUpload.classList.remove('image-upload--has-image');
          imageInput.value = '';
        });
      }
    }

    // Form submission
    const form = document.getElementById('createProjectForm');
    if (form) {
      form.addEventListener('submit', handleProjectSubmit);
    }

    // Populate author selector
    populateAuthorSelector('projectAuthorSelect');
  }

  function updateProjectWizard() {
    const wizard = document.getElementById('projectWizard');
    if (!wizard) return;

    wizard.querySelectorAll('.wizard-progress__step').forEach(step => {
      const stepNum = parseInt(step.dataset.step, 10);
      step.classList.remove('active', 'completed');
      if (stepNum === projectWizardStep) {
        step.classList.add('active');
      } else if (stepNum < projectWizardStep) {
        step.classList.add('completed');
      }
    });

    wizard.querySelectorAll('.wizard-step').forEach(panel => {
      const stepNum = parseInt(panel.dataset.wizardStep, 10);
      panel.classList.toggle('active', stepNum === projectWizardStep);
    });
  }

  function resetProjectForm() {
    const form = document.getElementById('createProjectForm');
    if (form) form.reset();

    projectImageData = null;
    projectWizardStep = 1;
    projectCoowners = [];
    projectMembers = [];

    const imagePreview = document.getElementById('projectImagePreview');
    const imagePlaceholder = document.getElementById('projectImagePlaceholder');
    const imageRemove = document.getElementById('projectImageRemove');
    const imageUpload = document.getElementById('projectImageUpload');

    if (imagePreview) {
      imagePreview.style.display = 'none';
      imagePreview.src = '';
    }
    if (imagePlaceholder) imagePlaceholder.style.display = 'flex';
    if (imageRemove) imageRemove.style.display = 'none';
    if (imageUpload) imageUpload.classList.remove('image-upload--has-image');

    const nextBtn = document.getElementById('projectStep1Next');
    if (nextBtn) nextBtn.disabled = true;

    updateProjectWizard();
    populateAuthorSelector('projectAuthorSelect');
  }

  async function handleProjectSubmit(e) {
    e.preventDefault();

    if (!currentUser) {
      showToast('Error', 'You must be logged in to create a project');
      return;
    }

    const name = document.getElementById('projectName')?.value?.trim();
    const description = document.getElementById('projectDescription')?.value?.trim();
    const category = document.querySelector('#projectWizard input[name="projectCategory"]:checked')?.value;
    const status = document.querySelector('#projectWizard input[name="projectStatus"]:checked')?.value || 'active';
    const authorSelect = document.getElementById('projectAuthorSelect');
    const authorValue = authorSelect?.value || 'personal';
    const isCreatingAsCompany = authorValue !== 'personal';
    const companyId = isCreatingAsCompany ? authorValue : null;

    if (!name || !description || !category) {
      showToast('Error', 'Please fill in all required fields');
      return;
    }

    const submitBtn = document.getElementById('submitProjectBtn');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner spinner--sm"></span> Creating...';
    }

    try {
      let imageUrl = null;
      if (projectImageData && projectImageData.startsWith('data:')) {
        try {
          const uploaded = await PrismBin.uploadImage(projectImageData, 'images', 'projects');
          imageUrl = uploaded.url;
        } catch (imgErr) {
          console.warn('[CreateModals] Image upload failed:', imgErr);
        }
      }

      const needsMod = currentUser.role !== 'mod' && currentUser.role !== 'admin';

      if (needsMod && typeof PrismBin.createModerationRequest === 'function') {
        await PrismBin.createModerationRequest({
          type: PrismBin.MODERATION_TYPES?.CREATE_PROJECT || 'create_project',
          userId: currentUser.id,
          data: {
            name,
            description,
            category,
            status,
            image: imageUrl,
            companyId,
          },
        });
        showToast('Submitted', 'Your project has been submitted for review');
      } else {
        await PrismBin.createProject({
          name,
          description,
          category,
          status: status === 'active' ? 'published' : status,
          image: imageUrl,
          authorId: currentUser.id,
          companyId,
          createdAt: new Date().toISOString(),
        });
        showToast('Success', 'Project created successfully!');
      }

      closeModal('createProjectModal');
      resetProjectForm();

      // Trigger refresh on current page if possible
      if (typeof window.loadProjects === 'function') {
        window.loadProjects();
      } else {
        // Reload page to show new project
        window.location.reload();
      }
    } catch (error) {
      console.error('[CreateModals] Failed to create project:', error);
      showToast('Error', error.message || 'Failed to create project');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          <span id="projectSubmitText">Create Project</span>
        `;
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // POST MODAL
  // ═══════════════════════════════════════════════════════════════════════════

  function initPostModal() {
    const modal = injectModal(getPostModalHTML(), 'createPostModal');
    if (!modal) return;

    // Close handlers
    modal.querySelectorAll('[data-action="close-post-modal"]').forEach(el => {
      el.addEventListener('click', () => closeModal('createPostModal'));
    });

    // Category selection enables next button
    modal.querySelectorAll('input[name="postCategory"]').forEach(input => {
      input.addEventListener('change', () => {
        const nextBtn = document.getElementById('postStep1Next');
        if (nextBtn) nextBtn.disabled = false;
      });
    });

    // Wizard navigation
    modal.querySelector('[data-action="post-wizard-next"]')?.addEventListener('click', () => {
      postWizardStep = 2;
      updatePostWizard();
    });

    modal.querySelector('[data-action="post-wizard-prev"]')?.addEventListener('click', () => {
      postWizardStep = 1;
      updatePostWizard();
    });

    // Character counters
    const titleInput = document.getElementById('postTitle');
    const contentInput = document.getElementById('postContent');
    const titleCount = document.getElementById('postTitleCount');
    const contentCount = document.getElementById('postContentCount');

    if (titleInput && titleCount) {
      titleInput.addEventListener('input', () => {
        titleCount.textContent = titleInput.value.length;
      });
    }

    if (contentInput && contentCount) {
      contentInput.addEventListener('input', () => {
        contentCount.textContent = contentInput.value.length;
      });
    }

    // Image upload
    const imageUpload = document.getElementById('postImageUpload');
    const imageInput = document.getElementById('postImageInput');
    const imagePreview = document.getElementById('postImagePreview');
    const imagePlaceholder = document.getElementById('postImagePlaceholder');
    const imageRemove = document.getElementById('postImageRemove');

    if (imageUpload && imageInput) {
      imageUpload.addEventListener('click', (e) => {
        if (e.target.closest('.image-upload__remove')) return;
        imageInput.click();
      });

      imageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) {
          showToast('Error', 'Image must be less than 2MB');
          return;
        }

        const reader = new FileReader();
        reader.onload = (ev) => {
          postImageData = ev.target.result;
          if (imagePreview) {
            imagePreview.src = postImageData;
            imagePreview.style.display = 'block';
          }
          if (imagePlaceholder) imagePlaceholder.style.display = 'none';
          if (imageRemove) imageRemove.style.display = 'flex';
          imageUpload.classList.add('image-upload--has-image');
        };
        reader.readAsDataURL(file);
      });

      if (imageRemove) {
        imageRemove.addEventListener('click', (e) => {
          e.stopPropagation();
          postImageData = null;
          if (imagePreview) {
            imagePreview.src = '';
            imagePreview.style.display = 'none';
          }
          if (imagePlaceholder) imagePlaceholder.style.display = 'flex';
          imageRemove.style.display = 'none';
          imageUpload.classList.remove('image-upload--has-image');
          imageInput.value = '';
        });
      }
    }

    // Form submission
    const form = document.getElementById('createPostForm');
    if (form) {
      form.addEventListener('submit', handlePostSubmit);
    }

    // Populate author selector
    populateAuthorSelector('postAuthorSelect');
  }

  function updatePostWizard() {
    const wizard = document.getElementById('postWizard');
    if (!wizard) return;

    wizard.querySelectorAll('.wizard-progress__step').forEach(step => {
      const stepNum = parseInt(step.dataset.step, 10);
      step.classList.remove('active', 'completed');
      if (stepNum === postWizardStep) {
        step.classList.add('active');
      } else if (stepNum < postWizardStep) {
        step.classList.add('completed');
      }
    });

    wizard.querySelectorAll('.wizard-step').forEach(panel => {
      const stepNum = parseInt(panel.dataset.wizardStep, 10);
      panel.classList.toggle('active', stepNum === postWizardStep);
    });
  }

  function resetPostForm() {
    const form = document.getElementById('createPostForm');
    if (form) form.reset();

    postImageData = null;
    postWizardStep = 1;

    const imagePreview = document.getElementById('postImagePreview');
    const imagePlaceholder = document.getElementById('postImagePlaceholder');
    const imageRemove = document.getElementById('postImageRemove');
    const imageUpload = document.getElementById('postImageUpload');

    if (imagePreview) {
      imagePreview.style.display = 'none';
      imagePreview.src = '';
    }
    if (imagePlaceholder) imagePlaceholder.style.display = 'flex';
    if (imageRemove) imageRemove.style.display = 'none';
    if (imageUpload) imageUpload.classList.remove('image-upload--has-image');

    const nextBtn = document.getElementById('postStep1Next');
    if (nextBtn) nextBtn.disabled = true;

    updatePostWizard();
    populateAuthorSelector('postAuthorSelect');
  }

  async function handlePostSubmit(e) {
    e.preventDefault();

    if (!currentUser) {
      showToast('Error', 'You must be logged in to create a post');
      return;
    }

    const title = document.getElementById('postTitle')?.value?.trim();
    const content = document.getElementById('postContent')?.value?.trim();
    const category = document.querySelector('#postWizard input[name="postCategory"]:checked')?.value;
    const authorSelect = document.getElementById('postAuthorSelect');
    const authorValue = authorSelect?.value || 'personal';
    const isCreatingAsCompany = authorValue !== 'personal';
    const companyId = isCreatingAsCompany ? authorValue : null;

    if (!title || !content || !category) {
      showToast('Error', 'Please fill in all required fields');
      return;
    }

    const submitBtn = document.getElementById('submitPostBtn');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner spinner--sm"></span> Publishing...';
    }

    try {
      let imageUrl = null;
      if (postImageData && postImageData.startsWith('data:')) {
        try {
          const uploaded = await PrismBin.uploadImage(postImageData, 'images', 'posts');
          imageUrl = uploaded.url;
        } catch (imgErr) {
          console.warn('[CreateModals] Image upload failed:', imgErr);
        }
      }

      const needsMod = currentUser.role !== 'mod' && currentUser.role !== 'admin';

      if (needsMod && typeof PrismBin.createModerationRequest === 'function') {
        await PrismBin.createModerationRequest({
          type: PrismBin.MODERATION_TYPES?.CREATE_POST || 'create_post',
          userId: currentUser.id,
          data: {
            title,
            content,
            category,
            image: imageUrl,
            companyId,
          },
        });
        showToast('Submitted', 'Your post has been submitted for review');
      } else {
        await PrismBin.createPost({
          title,
          content,
          category,
          status: 'published',
          image: imageUrl,
          authorId: currentUser.id,
          companyId,
          createdAt: new Date().toISOString(),
        });
        showToast('Success', 'Post published successfully!');
      }

      closeModal('createPostModal');
      resetPostForm();

      // Trigger refresh on current page if possible
      if (typeof window.loadPosts === 'function') {
        window.loadPosts();
      } else {
        // Reload page to show new post
        window.location.reload();
      }
    } catch (error) {
      console.error('[CreateModals] Failed to create post:', error);
      showToast('Error', error.message || 'Failed to create post');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          <span id="postSubmitText">Publish Post</span>
        `;
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTHOR SELECTOR (for companies)
  // ═══════════════════════════════════════════════════════════════════════════

  async function populateAuthorSelector(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;

    // Clear existing options except personal
    select.innerHTML = '<option value="personal">Personal (myself)</option>';

    if (!currentUser) return;

    try {
      // Get companies where user can create content
      if (typeof PrismBin !== 'undefined' && PrismBin.getCompaniesWhereUserCanCreate) {
        userCompanies = await PrismBin.getCompaniesWhereUserCanCreate(currentUser.id) || [];
      } else if (typeof PrismBin !== 'undefined' && PrismBin.getUserCompanies) {
        userCompanies = await PrismBin.getUserCompanies(currentUser.id) || [];
      } else {
        userCompanies = [];
      }

      userCompanies.forEach(company => {
        const option = document.createElement('option');
        option.value = company.id;
        option.textContent = `As ${company.name}`;
        select.appendChild(option);
      });
    } catch (err) {
      console.warn('[CreateModals] Failed to load companies:', err);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════════

  async function init() {
    if (initialized) return;

    console.log('[CreateModals] Initializing...');

    // Get current user
    if (typeof PrismAuth !== 'undefined') {
      currentUser = PrismAuth.getUser();
    }

    // Wait for auth if not ready
    if (!currentUser) {
      await new Promise(resolve => {
        let attempts = 0;
        const check = setInterval(() => {
          attempts++;
          if (typeof PrismAuth !== 'undefined') {
            currentUser = PrismAuth.getUser();
          }
          if (currentUser || attempts > 30) {
            clearInterval(check);
            resolve();
          }
        }, 100);
      });
    }

    initialized = true;
    console.log('[CreateModals] Ready');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════════

  window.PrismCreateModals = {
    /**
     * Open Create Project modal
     */
    openProject: async function() {
      await init();
      if (!document.getElementById('createProjectModal')) {
        initProjectModal();
      } else {
        resetProjectForm();
      }
      openModal('createProjectModal');
    },

    /**
     * Open Create Post modal
     */
    openPost: async function() {
      await init();
      if (!document.getElementById('createPostModal')) {
        initPostModal();
      } else {
        resetPostForm();
      }
      openModal('createPostModal');
    },

    /**
     * Close all create modals
     */
    closeAll: function() {
      closeModal('createProjectModal');
      closeModal('createPostModal');
    },

    /**
     * Check if user can create content
     */
    canCreate: function() {
      return !!currentUser;
    }
  };

  // Auto-init when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
