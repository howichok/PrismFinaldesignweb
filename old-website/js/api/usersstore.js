/* ═══════════════════════════════════════════════════════════════════════════
   PrismMTR — Users Store
   CRUD operations for user management
   ═══════════════════════════════════════════════════════════════════════════ */

const UsersStore = (function () {
  'use strict';

  const BIN_ID = JSONBin.CONFIG.BINS.USERS;

  // ═══════════════════════════════════════════════════════════════════════════
  // READ OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  async function getAll() {
    const data = await JSONBin.read(BIN_ID);
    return data.users || [];
  }

  async function getById(userId) {
    const users = await getAll();
    return users.find(u => u.id === userId) || null;
  }

  async function getByEmail(email) {
    const users = await getAll();
    return users.find(u => u.email === email) || null;
  }

  async function getByMcNickname(mcNickname) {
    const users = await getAll();
    return users.find(u => u.mcNickname?.toLowerCase() === mcNickname.toLowerCase()) || null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // WRITE OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  async function create(userData) {
    const users = await getAll();
    
    const newUser = {
      id: JSONBin.generateId('user'),
      mcNickname: userData.mcNickname || null,
      nickname: userData.nickname || null,
      email: userData.email,
      role: 'user',
      avatar: userData.avatar || null,
      connections: {
        github: userData.provider === 'github',
        google: userData.provider === 'google',
        discord: userData.provider === 'discord',
      },
      createdAt: JSONBin.getTimestamp(),
      updatedAt: JSONBin.getTimestamp(),
    };

    users.push(newUser);
    await JSONBin.write(BIN_ID, { users });
    
    return newUser;
  }

  async function update(userId, updates) {
    const users = await getAll();
    const index = users.findIndex(u => u.id === userId);
    
    if (index === -1) {
      throw new Error(`User not found: ${userId}`);
    }

    users[index] = {
      ...users[index],
      ...updates,
      updatedAt: JSONBin.getTimestamp(),
    };

    await JSONBin.write(BIN_ID, { users });
    return users[index];
  }

  async function updateConnection(userId, provider, connected) {
    const users = await getAll();
    const index = users.findIndex(u => u.id === userId);
    
    if (index === -1) {
      throw new Error(`User not found: ${userId}`);
    }

    users[index].connections[provider] = connected;
    users[index].updatedAt = JSONBin.getTimestamp();

    await JSONBin.write(BIN_ID, { users });
    return users[index];
  }

  async function updateRole(userId, newRole, editorRole) {
    // Only admin can change roles
    if (editorRole !== 'admin') {
      throw new Error('Insufficient permissions to change roles');
    }

    const validRoles = ['user', 'mod', 'admin'];
    if (!validRoles.includes(newRole)) {
      throw new Error(`Invalid role: ${newRole}`);
    }

    return update(userId, { role: newRole });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PERMISSION HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  function canEditUser(editorUser, targetUser) {
    if (!editorUser || !targetUser) return false;
    
    // Users can only edit themselves
    if (editorUser.role === 'user') {
      return editorUser.id === targetUser.id;
    }
    
    // Mods can edit users with role 'user'
    if (editorUser.role === 'mod') {
      return targetUser.role === 'user';
    }
    
    // Admins can edit anyone
    if (editorUser.role === 'admin') {
      return true;
    }
    
    return false;
  }

  function hasDiscordConnection(user) {
    return user?.connections?.discord === true;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════════

  return {
    getAll,
    getById,
    getByEmail,
    getByMcNickname,
    create,
    update,
    updateConnection,
    updateRole,
    canEditUser,
    hasDiscordConnection,
  };

})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = UsersStore;
}
