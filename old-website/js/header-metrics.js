/**
 * PrismMTR - Header Metrics
 *
 * Measures header height and sets CSS variable --app-header-h
 * for adaptive layout on all dashboard/company pages.
 *
 * USAGE:
 * Include this script right after the header in HTML:
 * <script src="js/header-metrics.js"></script>
 */

(function() {
  'use strict';

  const HEADER_ID = 'appHeader';
  const CSS_VAR = '--app-header-h';
  const FALLBACK_HEIGHT = 72;

  let header = null;
  let resizeObserver = null;

  /**
   * Update the CSS variable with header height
   */
  function setHeaderHeight() {
    if (!header) {
      header = document.getElementById(HEADER_ID);
    }

    const height = header ? header.offsetHeight : FALLBACK_HEIGHT;
    document.documentElement.style.setProperty(CSS_VAR, height + 'px');
  }

  /**
   * Initialize header metrics
   */
  function init() {
    header = document.getElementById(HEADER_ID);

    // Set initial value
    setHeaderHeight();

    // Use ResizeObserver for header size changes
    if (header && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(setHeaderHeight);
      resizeObserver.observe(header);
    }

    // Handle window resize
    window.addEventListener('resize', setHeaderHeight);

    // Handle font loading (can change header height)
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(setHeaderHeight);
    }

    // Re-check after a short delay (in case header is injected by JS)
    setTimeout(() => {
      if (!header) {
        header = document.getElementById(HEADER_ID);
        if (header && resizeObserver) {
          resizeObserver.observe(header);
        }
      }
      setHeaderHeight();
    }, 100);
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Export for manual re-measurement
  window.PrismHeaderMetrics = {
    update: setHeaderHeight,
    getHeight: () => header ? header.offsetHeight : FALLBACK_HEIGHT
  };

})();
