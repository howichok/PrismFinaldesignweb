/**
 * CategorySelector Module (Vanilla JS)
 *
 * Multi-select category picker with tags/checkboxes UI
 *
 * Usage:
 *   const selector = new CategorySelector('#container', {
 *     categories: [...],
 *     maxSelections: 3,
 *     onChange: (selected) => console.log(selected)
 *   });
 *
 *   // Get selected values
 *   selector.getSelected(); // ['building', 'station']
 *
 *   // Set selected values
 *   selector.setSelected(['building']);
 */

(function () {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════════
  // PREDEFINED CATEGORIES
  // ═══════════════════════════════════════════════════════════════════════════

  const PROJECT_CATEGORIES = [
    { value: 'building', label: 'Building', icon: '🏢', color: '#6366f1' },
    { value: 'station', label: 'Station', icon: '🚉', color: '#22c55e' },
    { value: 'line_section', label: 'Line Section', icon: '🛤️', color: '#f59e0b' },
    { value: 'line', label: 'Full Line', icon: '🚇', color: '#ef4444' },
  ];

  const POST_CATEGORIES = [
    { value: 'news', label: 'News', icon: '📰', color: '#6366f1' },
    { value: 'update', label: 'Update', icon: '🔄', color: '#22c55e' },
    { value: 'announcement', label: 'Announcement', icon: '📢', color: '#f59e0b' },
    { value: 'guide', label: 'Guide', icon: '📖', color: '#3b82f6' },
    { value: 'showcase', label: 'Showcase', icon: '✨', color: '#ec4899' },
  ];

  // ═══════════════════════════════════════════════════════════════════════════
  // CATEGORY SELECTOR CLASS
  // ═══════════════════════════════════════════════════════════════════════════

  class CategorySelector {
    constructor(container, options = {}) {
      this.container =
        typeof container === 'string'
          ? document.querySelector(container)
          : container;

      if (!this.container) {
        throw new Error('CategorySelector: Container not found');
      }

      this.options = {
        categories: options.categories || PROJECT_CATEGORIES,
        selected: options.selected || [],
        maxSelections: options.maxSelections || 0, // 0 = unlimited
        minSelections: options.minSelections || 0,
        mode: options.mode || 'tags', // 'tags' | 'checkboxes' | 'chips'
        disabled: options.disabled || false,
        label: options.label || 'Categories',
        helpText: options.helpText || 'Select all that apply',
        onChange: options.onChange || (() => {}),
        name: options.name || 'categories', // For form submission
      };

      this.selected = [...this.options.selected];
      this.render();
      this.bindEvents();
    }

    render() {
      const { categories, maxSelections, mode, label, helpText, name } = this.options;

      const selectionText =
        maxSelections > 0
          ? `${this.selected.length}/${maxSelections}`
          : `${this.selected.length}`;

      this.container.innerHTML = `
        <div class="category-selector" data-name="${name}">
          <div class="category-selector__header">
            <label class="category-selector__label">${label}</label>
            <span class="category-selector__count">${selectionText} selected</span>
          </div>
          <div class="category-selector__grid category-selector__grid--${mode}" role="group">
            ${categories.map((cat) => this.renderCategory(cat)).join('')}
          </div>
          ${helpText ? `<p class="category-selector__help">${helpText}</p>` : ''}
        </div>
      `;
    }

    renderCategory(category) {
      const { mode, disabled } = this.options;
      const isActive = this.selected.includes(category.value);
      const canToggle = this.canSelect(category.value);

      if (mode === 'checkboxes') {
        return `
          <label class="category-checkbox ${isActive ? 'category-checkbox--selected' : ''} ${!canToggle && !isActive ? 'category-checkbox--disabled' : ''}"
                 data-value="${category.value}">
            <input type="checkbox"
                   ${isActive ? 'checked' : ''}
                   ${!canToggle && !isActive ? 'disabled' : ''}
                   class="category-checkbox__input">
            <span class="category-checkbox__box">
              ${isActive ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>' : ''}
            </span>
            ${category.icon ? `<span class="category-checkbox__icon">${category.icon}</span>` : ''}
            <span class="category-checkbox__label">${category.label}</span>
          </label>
        `;
      }

      // Tags mode
      return `
        <button type="button"
                role="checkbox"
                aria-checked="${isActive}"
                ${!canToggle && !isActive ? 'disabled' : ''}
                class="category-tag ${isActive ? 'category-tag--selected' : ''} ${!canToggle && !isActive ? 'category-tag--disabled' : ''} ${mode === 'chips' ? 'category-tag--chip' : ''}"
                style="--category-color: ${category.color}"
                data-value="${category.value}">
          ${category.icon ? `<span class="category-tag__icon">${category.icon}</span>` : ''}
          <span class="category-tag__label">${category.label}</span>
          ${isActive ? `<span class="category-tag__check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg></span>` : ''}
        </button>
      `;
    }

    bindEvents() {
      this.container.addEventListener('click', (e) => {
        const tag = e.target.closest('.category-tag');
        const checkbox = e.target.closest('.category-checkbox');

        if (tag && !tag.disabled) {
          this.toggle(tag.dataset.value);
        }

        if (checkbox && !checkbox.classList.contains('category-checkbox--disabled')) {
          // Prevent double-toggle from input
          if (e.target.tagName !== 'INPUT') {
            this.toggle(checkbox.dataset.value);
          }
        }
      });

      // Handle checkbox input changes
      this.container.addEventListener('change', (e) => {
        if (e.target.matches('.category-checkbox__input')) {
          const checkbox = e.target.closest('.category-checkbox');
          if (checkbox) {
            this.toggle(checkbox.dataset.value);
          }
        }
      });
    }

    canSelect(value) {
      if (this.options.disabled) return false;
      if (this.selected.includes(value)) return true; // Can always deselect
      if (
        this.options.maxSelections > 0 &&
        this.selected.length >= this.options.maxSelections
      ) {
        return false;
      }
      return true;
    }

    toggle(value) {
      const index = this.selected.indexOf(value);

      if (index > -1) {
        // Deselect - check minimum
        if (this.selected.length > this.options.minSelections) {
          this.selected.splice(index, 1);
        }
      } else {
        // Select - check maximum
        if (
          this.options.maxSelections === 0 ||
          this.selected.length < this.options.maxSelections
        ) {
          this.selected.push(value);
        }
      }

      this.render();
      this.bindEvents();
      this.options.onChange(this.selected);
    }

    getSelected() {
      return [...this.selected];
    }

    setSelected(values) {
      this.selected = [...values];
      this.render();
      this.bindEvents();
    }

    setDisabled(disabled) {
      this.options.disabled = disabled;
      this.render();
      this.bindEvents();
    }

    destroy() {
      this.container.innerHTML = '';
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FACTORY FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  function createProjectCategorySelector(container, options = {}) {
    return new CategorySelector(container, {
      categories: PROJECT_CATEGORIES,
      label: 'Project Categories',
      helpText: 'Select all that apply (max 4)',
      maxSelections: 4,
      ...options,
    });
  }

  function createPostCategorySelector(container, options = {}) {
    return new CategorySelector(container, {
      categories: POST_CATEGORIES,
      label: 'Post Category',
      helpText: 'Select up to 2 categories',
      maxSelections: 2,
      ...options,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPORT
  // ═══════════════════════════════════════════════════════════════════════════

  window.CategorySelector = CategorySelector;
  window.createProjectCategorySelector = createProjectCategorySelector;
  window.createPostCategorySelector = createPostCategorySelector;

  // Export category constants
  window.PROJECT_CATEGORIES = PROJECT_CATEGORIES;
  window.POST_CATEGORIES = POST_CATEGORIES;

  console.log('[CategorySelector] Module loaded');
})();
