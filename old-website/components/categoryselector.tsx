'use client';

/**
 * CategorySelector Component
 *
 * Multi-select category picker with tags UI
 * Supports both checkboxes and clickable tags
 */

import React, { useState, useCallback } from 'react';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface Category {
  value: string;
  label: string;
  icon?: string;
  color?: string;
  description?: string;
}

export interface CategorySelectorProps {
  /** Available categories */
  categories: Category[];
  /** Currently selected category values */
  selected: string[];
  /** Callback when selection changes */
  onChange: (selected: string[]) => void;
  /** Maximum number of selections (0 = unlimited) */
  maxSelections?: number;
  /** Minimum required selections */
  minSelections?: number;
  /** Display mode: 'tags' | 'checkboxes' | 'chips' */
  mode?: 'tags' | 'checkboxes' | 'chips';
  /** Whether the selector is disabled */
  disabled?: boolean;
  /** Custom class name */
  className?: string;
  /** Error message to display */
  error?: string;
  /** Label for the selector */
  label?: string;
  /** Help text */
  helpText?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// PREDEFINED CATEGORIES
// ═══════════════════════════════════════════════════════════════════════════

export const PROJECT_CATEGORIES: Category[] = [
  { value: 'building', label: 'Building', icon: '🏢', color: '#6366f1', description: 'Standalone buildings and structures' },
  { value: 'station', label: 'Station', icon: '🚉', color: '#22c55e', description: 'Transit stations and platforms' },
  { value: 'line_section', label: 'Line Section', icon: '🛤️', color: '#f59e0b', description: 'Portions of transit lines' },
  { value: 'line', label: 'Full Line', icon: '🚇', color: '#ef4444', description: 'Complete transit lines' },
];

export const POST_CATEGORIES: Category[] = [
  { value: 'news', label: 'News', icon: '📰', color: '#6366f1' },
  { value: 'update', label: 'Update', icon: '🔄', color: '#22c55e' },
  { value: 'announcement', label: 'Announcement', icon: '📢', color: '#f59e0b' },
  { value: 'guide', label: 'Guide', icon: '📖', color: '#3b82f6' },
  { value: 'showcase', label: 'Showcase', icon: '✨', color: '#ec4899' },
];

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function CategorySelector({
  categories,
  selected,
  onChange,
  maxSelections = 0,
  minSelections = 0,
  mode = 'tags',
  disabled = false,
  className = '',
  error,
  label,
  helpText,
}: CategorySelectorProps) {
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const isSelected = useCallback(
    (value: string) => selected.includes(value),
    [selected]
  );

  const canSelect = useCallback(
    (value: string) => {
      if (disabled) return false;
      if (isSelected(value)) return true; // Can always deselect
      if (maxSelections > 0 && selected.length >= maxSelections) return false;
      return true;
    },
    [disabled, isSelected, maxSelections, selected.length]
  );

  const handleToggle = useCallback(
    (value: string) => {
      if (disabled) return;

      if (isSelected(value)) {
        // Deselect - check minimum
        if (selected.length > minSelections) {
          onChange(selected.filter((v) => v !== value));
        }
      } else {
        // Select - check maximum
        if (maxSelections === 0 || selected.length < maxSelections) {
          onChange([...selected, value]);
        }
      }
    },
    [disabled, isSelected, selected, onChange, minSelections, maxSelections]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, value: string) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleToggle(value);
      }
    },
    [handleToggle]
  );

  // Render based on mode
  const renderCategory = (category: Category, index: number) => {
    const isActive = isSelected(category.value);
    const canToggle = canSelect(category.value);

    if (mode === 'checkboxes') {
      return (
        <label
          key={category.value}
          className={`category-checkbox ${isActive ? 'category-checkbox--selected' : ''} ${!canToggle && !isActive ? 'category-checkbox--disabled' : ''}`}
        >
          <input
            type="checkbox"
            checked={isActive}
            onChange={() => handleToggle(category.value)}
            disabled={!canToggle && !isActive}
            className="category-checkbox__input"
          />
          <span className="category-checkbox__box">
            {isActive && (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            )}
          </span>
          {category.icon && <span className="category-checkbox__icon">{category.icon}</span>}
          <span className="category-checkbox__label">{category.label}</span>
        </label>
      );
    }

    // Tags/Chips mode
    return (
      <button
        key={category.value}
        type="button"
        role="checkbox"
        aria-checked={isActive}
        disabled={!canToggle && !isActive}
        onClick={() => handleToggle(category.value)}
        onKeyDown={(e) => handleKeyDown(e, category.value)}
        onFocus={() => setFocusedIndex(index)}
        onBlur={() => setFocusedIndex(-1)}
        className={`category-tag ${isActive ? 'category-tag--selected' : ''} ${!canToggle && !isActive ? 'category-tag--disabled' : ''} ${mode === 'chips' ? 'category-tag--chip' : ''}`}
        style={{
          '--category-color': category.color,
        } as React.CSSProperties}
      >
        {category.icon && <span className="category-tag__icon">{category.icon}</span>}
        <span className="category-tag__label">{category.label}</span>
        {isActive && (
          <span className="category-tag__check">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </span>
        )}
      </button>
    );
  };

  const selectionText =
    maxSelections > 0
      ? `${selected.length}/${maxSelections} selected`
      : `${selected.length} selected`;

  return (
    <div className={`category-selector ${className} ${error ? 'category-selector--error' : ''}`}>
      {label && (
        <div className="category-selector__header">
          <label className="category-selector__label">{label}</label>
          <span className="category-selector__count">{selectionText}</span>
        </div>
      )}

      <div
        className={`category-selector__grid category-selector__grid--${mode}`}
        role="group"
        aria-label={label || 'Category selection'}
      >
        {categories.map((cat, index) => renderCategory(cat, index))}
      </div>

      {helpText && !error && (
        <p className="category-selector__help">{helpText}</p>
      )}

      {error && <p className="category-selector__error">{error}</p>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SPECIALIZED SELECTORS
// ═══════════════════════════════════════════════════════════════════════════

export function ProjectCategorySelector(
  props: Omit<CategorySelectorProps, 'categories'> & { maxSelections?: number }
) {
  return (
    <CategorySelector
      {...props}
      categories={PROJECT_CATEGORIES}
      label={props.label || 'Project Categories'}
      helpText={props.helpText || 'Select all that apply'}
      maxSelections={props.maxSelections || 4}
    />
  );
}

export function PostCategorySelector(
  props: Omit<CategorySelectorProps, 'categories'> & { maxSelections?: number }
) {
  return (
    <CategorySelector
      {...props}
      categories={POST_CATEGORIES}
      label={props.label || 'Post Category'}
      maxSelections={props.maxSelections || 2}
    />
  );
}

export default CategorySelector;
