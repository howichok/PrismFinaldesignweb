/* ═══════════════════════════════════════════════════════════════════════════
   PrismMTR — JSONBin API Layer
   Centralized API access for all bin operations
   ═══════════════════════════════════════════════════════════════════════════ */

const JSONBin = (function () {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════════
  // CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════════

  const CONFIG = {
    BASE_URL: 'https://api.jsonbin.io/v3/b',
    API_KEY: '$2a$10$YOUR_API_KEY_HERE', // Replace with actual key
    BINS: {
      USERS: 'YOUR_USERS_BIN_ID',
      PROJECTS: 'YOUR_PROJECTS_BIN_ID',
      NICKNAME_REQUESTS: 'YOUR_NICKNAME_REQUESTS_BIN_ID',
      NOTIFICATIONS: 'YOUR_NOTIFICATIONS_BIN_ID',
    },
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // CORE API METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  async function read(binId) {
    try {
      const response = await fetch(`${CONFIG.BASE_URL}/${binId}/latest`, {
        method: 'GET',
        headers: {
          'X-Master-Key': CONFIG.API_KEY,
          'X-Bin-Meta': 'false',
        },
      });

      if (!response.ok) {
        throw new Error(`JSONBin read failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('[JSONBin] Read error:', error);
      throw error;
    }
  }

  async function write(binId, data) {
    try {
      const response = await fetch(`${CONFIG.BASE_URL}/${binId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Master-Key': CONFIG.API_KEY,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`JSONBin write failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('[JSONBin] Write error:', error);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UTILITY METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  function generateId(prefix = 'id') {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `${prefix}_${timestamp}${random}`;
  }

  function getTimestamp() {
    return new Date().toISOString();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════════

  return {
    CONFIG,
    read,
    write,
    generateId,
    getTimestamp,
  };

})();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = JSONBin;
}
