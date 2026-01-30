/* ═══════════════════════════════════════════════════════════════════════════
   PrismMTR — Projects Store
   CRUD operations for project management with role-based access
   ═══════════════════════════════════════════════════════════════════════════ */

const ProjectsStore = (function () {
  'use strict';

  const BIN_ID = JSONBin.CONFIG.BINS.PROJECTS;

  // ═══════════════════════════════════════════════════════════════════════════
  // READ OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  async function getAll() {
    const data = await JSONBin.read(BIN_ID);
    return data.projects || [];
  }

  async function getById(projectId) {
    const projects = await getAll();
    return projects.find(p => p.id === projectId) || null;
  }

  async function getByOwner(userId) {
    const projects = await getAll();
    return projects.filter(p => p.ownerId === userId);
  }

  async function getByMember(userId) {
    const projects = await getAll();
    return projects.filter(p => 
      p.ownerId === userId || 
      p.coOwners?.includes(userId) || 
      p.members?.includes(userId)
    );
  }

  async function getPublic() {
    const projects = await getAll();
    return projects.filter(p => p.visibility === 'public');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // WRITE OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  async function create(projectData, creatorId) {
    const projects = await getAll();
    
    const newProject = {
      id: JSONBin.generateId('proj'),
      title: projectData.title,
      description: projectData.description || '',
      ownerId: creatorId,
      coOwners: [],
      members: [],
      visibility: projectData.visibility || 'private',
      createdAt: JSONBin.getTimestamp(),
      updatedAt: JSONBin.getTimestamp(),
    };

    projects.push(newProject);
    await JSONBin.write(BIN_ID, { projects });
    
    return newProject;
  }

  async function update(projectId, updates, editorUser) {
    const projects = await getAll();
    const index = projects.findIndex(p => p.id === projectId);
    
    if (index === -1) {
      throw new Error(`Project not found: ${projectId}`);
    }

    const project = projects[index];
    
    // Check permissions
    if (!canEditProject(editorUser, project)) {
      throw new Error('Insufficient permissions to edit this project');
    }

    // Prevent changing owner unless admin/mod
    if (updates.ownerId && !['admin', 'mod'].includes(editorUser.role)) {
      delete updates.ownerId;
    }

    projects[index] = {
      ...project,
      ...updates,
      updatedAt: JSONBin.getTimestamp(),
    };

    await JSONBin.write(BIN_ID, { projects });
    return projects[index];
  }

  async function deleteProject(projectId, editorUser) {
    const projects = await getAll();
    const project = projects.find(p => p.id === projectId);
    
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    // Only owner, admin, or mod can delete
    const isOwner = project.ownerId === editorUser.id;
    const isStaff = ['admin', 'mod'].includes(editorUser.role);
    
    if (!isOwner && !isStaff) {
      throw new Error('Only the owner can delete this project');
    }

    const filtered = projects.filter(p => p.id !== projectId);
    await JSONBin.write(BIN_ID, { projects: filtered });
    
    return true;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MEMBER MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  async function addMember(projectId, userId, editorUser) {
    const projects = await getAll();
    const index = projects.findIndex(p => p.id === projectId);
    
    if (index === -1) {
      throw new Error(`Project not found: ${projectId}`);
    }

    const project = projects[index];
    
    // Check if editor can add members
    if (!canManageMembers(editorUser, project)) {
      throw new Error('Insufficient permissions to add members');
    }

    // Don't add duplicates
    if (!project.members.includes(userId)) {
      project.members.push(userId);
      project.updatedAt = JSONBin.getTimestamp();
      await JSONBin.write(BIN_ID, { projects });
    }

    return project;
  }

  async function removeMember(projectId, userId, editorUser) {
    const projects = await getAll();
    const index = projects.findIndex(p => p.id === projectId);
    
    if (index === -1) {
      throw new Error(`Project not found: ${projectId}`);
    }

    const project = projects[index];
    
    if (!canManageMembers(editorUser, project)) {
      throw new Error('Insufficient permissions to remove members');
    }

    project.members = project.members.filter(id => id !== userId);
    project.updatedAt = JSONBin.getTimestamp();
    await JSONBin.write(BIN_ID, { projects });

    return project;
  }

  async function addCoOwner(projectId, userId, editorUser) {
    // Only admin/mod can add co-owners
    if (!['admin', 'mod'].includes(editorUser.role)) {
      throw new Error('Only staff can add co-owners');
    }

    const projects = await getAll();
    const index = projects.findIndex(p => p.id === projectId);
    
    if (index === -1) {
      throw new Error(`Project not found: ${projectId}`);
    }

    const project = projects[index];
    
    if (!project.coOwners.includes(userId)) {
      project.coOwners.push(userId);
      // Remove from members if present
      project.members = project.members.filter(id => id !== userId);
      project.updatedAt = JSONBin.getTimestamp();
      await JSONBin.write(BIN_ID, { projects });
    }

    return project;
  }

  async function removeCoOwner(projectId, userId, editorUser) {
    // Only admin/mod can remove co-owners
    if (!['admin', 'mod'].includes(editorUser.role)) {
      throw new Error('Only staff can remove co-owners');
    }

    const projects = await getAll();
    const index = projects.findIndex(p => p.id === projectId);
    
    if (index === -1) {
      throw new Error(`Project not found: ${projectId}`);
    }

    const project = projects[index];
    project.coOwners = project.coOwners.filter(id => id !== userId);
    project.updatedAt = JSONBin.getTimestamp();
    await JSONBin.write(BIN_ID, { projects });

    return project;
  }

  async function transferOwnership(projectId, newOwnerId, editorUser) {
    // Only admin/mod can transfer ownership
    if (!['admin', 'mod'].includes(editorUser.role)) {
      throw new Error('Only staff can transfer ownership');
    }

    const projects = await getAll();
    const index = projects.findIndex(p => p.id === projectId);
    
    if (index === -1) {
      throw new Error(`Project not found: ${projectId}`);
    }

    const project = projects[index];
    const previousOwner = project.ownerId;
    
    project.ownerId = newOwnerId;
    // Add previous owner as co-owner
    if (!project.coOwners.includes(previousOwner)) {
      project.coOwners.push(previousOwner);
    }
    // Remove new owner from co-owners/members
    project.coOwners = project.coOwners.filter(id => id !== newOwnerId);
    project.members = project.members.filter(id => id !== newOwnerId);
    project.updatedAt = JSONBin.getTimestamp();
    
    await JSONBin.write(BIN_ID, { projects });
    return project;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PERMISSION HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  function getUserRole(user, project) {
    if (!user || !project) return null;
    if (project.ownerId === user.id) return 'owner';
    if (project.coOwners?.includes(user.id)) return 'co-owner';
    if (project.members?.includes(user.id)) return 'member';
    return null;
  }

  function canEditProject(user, project) {
    if (!user || !project) return false;
    
    // Staff can always edit
    if (['admin', 'mod'].includes(user.role)) return true;
    
    // Owner can edit
    if (project.ownerId === user.id) return true;
    
    // Co-owner can edit
    if (project.coOwners?.includes(user.id)) return true;
    
    return false;
  }

  function canManageMembers(user, project) {
    if (!user || !project) return false;
    
    // Staff can always manage
    if (['admin', 'mod'].includes(user.role)) return true;
    
    // Owner can manage
    if (project.ownerId === user.id) return true;
    
    // Co-owner can manage members
    if (project.coOwners?.includes(user.id)) return true;
    
    return false;
  }

  function canDeleteProject(user, project) {
    if (!user || !project) return false;
    
    // Staff can delete
    if (['admin', 'mod'].includes(user.role)) return true;
    
    // Only owner can delete (co-owners cannot)
    if (project.ownerId === user.id) return true;
    
    return false;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════════

  return {
    getAll,
    getById,
    getByOwner,
    getByMember,
    getPublic,
    create,
    update,
    deleteProject,
    addMember,
    removeMember,
    addCoOwner,
    removeCoOwner,
    transferOwnership,
    getUserRole,
    canEditProject,
    canManageMembers,
    canDeleteProject,
  };

})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ProjectsStore;
}
