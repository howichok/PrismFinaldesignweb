/* ═══════════════════════════════════════════════════════════════════════════
   Netlify Function: Admin API (SECURE)
   
   This serverless function handles ALL privileged operations:
   - Role changes (user ↔ mod ↔ admin)
   - User management (edit, delete)
   - Project management (create, edit, delete, members)
   
   SECURITY ARCHITECTURE:
   - Requires cookie-based session verification (NOT just sessionUserId)
   - Enforces role hierarchy server-side
   - Prevents self-escalation attacks
   - Logs all admin actions
   
   Endpoint: /.netlify/functions/admin-api
   Method: POST
   Body: { action: string, data: object }
   
   Session is verified via prism_session cookie, NOT body parameter.
   ═══════════════════════════════════════════════════════════════════════════ */

const { verifySession } = require('./utils/verify-session');

exports.handler = async (event, context) => {
  const origin = event.headers.origin || event.headers.Origin || '';
  
  // CORS headers for credentialed requests
  const headers = {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    // ═══════════════════════════════════════════════════════════════════════════
    // VERIFY SESSION FROM COOKIE (not from body!)
    // ═══════════════════════════════════════════════════════════════════════════
    
    const session = await verifySession(event, 'mod'); // Require at least mod role
    
    if (!session.authenticated) {
      console.log('[admin-api] Session verification failed:', session.error);
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: session.error || 'Unauthorized' }),
      };
    }
    
    if (session.error === 'Insufficient permissions') {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'Insufficient permissions - mod+ required' }),
      };
    }
    
    const sessionUser = session.user;
    const sessionUserId = sessionUser.id;
    const actorRole = sessionUser.role || 'user';
    
    console.log('[admin-api] Verified session for:', sessionUserId, 'role:', actorRole);

    const { action, data } = JSON.parse(event.body || '{}');

    if (!action) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing action' }),
      };
    }

    // Get secrets from environment
    const apiKey = process.env.JSONBIN_API_KEY;
    const bins = {
      users: process.env.USERS_BIN_ID,
      projects: process.env.PROJECTS_BIN_ID,
      notifications: process.env.NOTIFICATIONS_BIN_ID,
    };

    if (!apiKey || !bins.users) {
      console.error('Missing required environment variables');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Server configuration error' }),
      };
    }

    const BASE_URL = 'https://api.jsonbin.io/v3/b';

    // ═══════════════════════════════════════════════════════════════════════════
    // HELPER: Fetch from JSONBin
    // ═══════════════════════════════════════════════════════════════════════════

    async function fetchBin(binId) {
      const res = await fetch(`${BASE_URL}/${binId}/latest`, {
        headers: { 'X-Master-Key': apiKey },
      });
      if (!res.ok) throw new Error(`Failed to fetch bin: ${res.status}`);
      const json = await res.json();
      return json.record || [];
    }

    async function saveBin(binId, data) {
      const res = await fetch(`${BASE_URL}/${binId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Master-Key': apiKey,
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(`Failed to save bin: ${res.status}`);
      return true;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // HELPER: Role Hierarchy
    // ═══════════════════════════════════════════════════════════════════════════

    const ROLE_HIERARCHY = { user: 1, mod: 2, admin: 3 };

    function hasPermission(userRole, requiredRole) {
      return (ROLE_HIERARCHY[userRole] || 0) >= (ROLE_HIERARCHY[requiredRole] || 0);
    }

    function canEditUser(actorRole, targetRole) {
      // Admins can edit anyone
      if (actorRole === 'admin') return true;
      // Mods can edit users but not admins or other mods
      if (actorRole === 'mod' && targetRole === 'user') return true;
      return false;
    }

    function canAssignRole(actorRole, newRole) {
      // Only admins can assign admin role
      if (newRole === 'admin') return actorRole === 'admin';
      // Admins can assign any role
      if (actorRole === 'admin') return true;
      // Mods can only assign 'user' role
      if (actorRole === 'mod') return newRole === 'user';
      return false;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // HELPER: Create Notification
    // ═══════════════════════════════════════════════════════════════════════════

    async function createNotification(userId, type, title, message) {
      try {
        const notifications = await fetchBin(bins.notifications);
        notifications.push({
          id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          userId,
          type,
          title,
          message,
          read: false,
          createdAt: new Date().toISOString(),
        });
        await saveBin(bins.notifications, { notifications });
      } catch (e) {
        console.error('Failed to create notification:', e);
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // FETCH USERS FOR OPERATIONS
    // (Session already verified above via cookie)
    // ═══════════════════════════════════════════════════════════════════════════

    const users = await fetchBin(bins.users);

    // ═══════════════════════════════════════════════════════════════════════════
    // ACTION HANDLERS
    // ═══════════════════════════════════════════════════════════════════════════

    switch (action) {
      // ─────────────────────────────────────────────────────────────────────────
      // UPDATE USER ROLE (Protected)
      // ─────────────────────────────────────────────────────────────────────────
      case 'updateUserRole': {
        const { targetUserId, newRole } = data || {};
        
        if (!targetUserId || !newRole) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Missing targetUserId or newRole' }),
          };
        }

        if (!['user', 'mod', 'admin'].includes(newRole)) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Invalid role' }),
          };
        }

        // Check if actor has mod+ permissions
        if (!hasPermission(actorRole, 'mod')) {
          return {
            statusCode: 403,
            headers,
            body: JSON.stringify({ error: 'Insufficient permissions' }),
          };
        }

        const targetIndex = users.findIndex(u => u.id === targetUserId);
        if (targetIndex === -1) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Target user not found' }),
          };
        }

        const targetUser = users[targetIndex];
        const targetRole = targetUser.role || 'user';

        // Prevent self role change
        if (targetUserId === sessionUserId) {
          return {
            statusCode: 403,
            headers,
            body: JSON.stringify({ error: 'Cannot change your own role' }),
          };
        }

        // Check if actor can edit this user
        if (!canEditUser(actorRole, targetRole)) {
          return {
            statusCode: 403,
            headers,
            body: JSON.stringify({ error: 'Cannot edit users with equal or higher role' }),
          };
        }

        // Check if actor can assign this role
        if (!canAssignRole(actorRole, newRole)) {
          return {
            statusCode: 403,
            headers,
            body: JSON.stringify({ error: 'Cannot assign this role' }),
          };
        }

        // Update the role
        users[targetIndex] = {
          ...targetUser,
          role: newRole,
          updatedAt: new Date().toISOString(),
        };

        await saveBin(bins.users, { users });

        // Send notification to target user
        await createNotification(
          targetUserId,
          'info',
          'Role Updated',
          `Your role has been changed to ${newRole} by ${sessionUser.nickname || 'an admin'}.`
        );

        console.log(`[Admin API] Role change: ${targetUser.email} ${targetRole} → ${newRole} by ${sessionUser.email}`);

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true, user: users[targetIndex] }),
        };
      }

      // ─────────────────────────────────────────────────────────────────────────
      // UPDATE USER DATA (Protected - non-role fields)
      // ─────────────────────────────────────────────────────────────────────────
      case 'updateUser': {
        const { targetUserId, updates } = data || {};
        
        if (!targetUserId || !updates) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Missing targetUserId or updates' }),
          };
        }

        // Check if actor has mod+ permissions
        if (!hasPermission(actorRole, 'mod')) {
          return {
            statusCode: 403,
            headers,
            body: JSON.stringify({ error: 'Insufficient permissions' }),
          };
        }

        const targetIndex = users.findIndex(u => u.id === targetUserId);
        if (targetIndex === -1) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Target user not found' }),
          };
        }

        const targetUser = users[targetIndex];
        const targetRole = targetUser.role || 'user';

        // Check if actor can edit this user
        if (!canEditUser(actorRole, targetRole)) {
          return {
            statusCode: 403,
            headers,
            body: JSON.stringify({ error: 'Cannot edit users with equal or higher role' }),
          };
        }

        // CRITICAL: Strip role from updates - use updateUserRole action instead
        const safeUpdates = { ...updates };
        delete safeUpdates.role;
        delete safeUpdates.id;
        delete safeUpdates.createdAt;

        // Update user
        users[targetIndex] = {
          ...targetUser,
          ...safeUpdates,
          updatedAt: new Date().toISOString(),
        };

        await saveBin(bins.users, { users });

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true, user: users[targetIndex] }),
        };
      }

      // ─────────────────────────────────────────────────────────────────────────
      // DELETE USER (Admin only)
      // ─────────────────────────────────────────────────────────────────────────
      case 'deleteUser': {
        const { targetUserId } = data || {};
        
        if (!targetUserId) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Missing targetUserId' }),
          };
        }

        // Only admins can delete users
        if (actorRole !== 'admin') {
          return {
            statusCode: 403,
            headers,
            body: JSON.stringify({ error: 'Only admins can delete users' }),
          };
        }

        // Prevent self-deletion
        if (targetUserId === sessionUserId) {
          return {
            statusCode: 403,
            headers,
            body: JSON.stringify({ error: 'Cannot delete yourself' }),
          };
        }

        const targetIndex = users.findIndex(u => u.id === targetUserId);
        if (targetIndex === -1) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'User not found' }),
          };
        }

        const deletedUser = users.splice(targetIndex, 1)[0];
        await saveBin(bins.users, { users });

        // Also delete their owned projects
        try {
          const projects = await fetchBin(bins.projects);
          const filteredProjects = projects.filter(p => p.owner?.id !== targetUserId);
          if (filteredProjects.length !== projects.length) {
            await saveBin(bins.projects, { projects: filteredProjects });
          }
        } catch (e) {
          console.error('Failed to clean up projects:', e);
        }

        console.log(`[Admin API] User deleted: ${deletedUser.email} by ${sessionUser.email}`);

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true }),
        };
      }

      // ─────────────────────────────────────────────────────────────────────────
      // CREATE PROJECT (Admin/Mod)
      // ─────────────────────────────────────────────────────────────────────────
      case 'createProject': {
        const { project } = data || {};
        
        if (!project || !project.name || !project.category) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Missing project data' }),
          };
        }

        // Mods and admins can create projects via admin panel
        if (!hasPermission(actorRole, 'mod')) {
          return {
            statusCode: 403,
            headers,
            body: JSON.stringify({ error: 'Insufficient permissions' }),
          };
        }

        const projects = await fetchBin(bins.projects);
        
        const newProject = {
          id: `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: project.name,
          description: project.description || '',
          category: project.category,
          status: project.status || 'active',
          image: project.image || null,
          owner: project.owner || {
            id: sessionUserId,
            nickname: sessionUser.nickname || sessionUser.email,
          },
          coowners: project.coowners || [],
          members: project.members || [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        projects.push(newProject);
        await saveBin(bins.projects, { projects });

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true, project: newProject }),
        };
      }

      // ─────────────────────────────────────────────────────────────────────────
      // UPDATE PROJECT (Admin/Mod)
      // ─────────────────────────────────────────────────────────────────────────
      case 'updateProject': {
        const { projectId, updates } = data || {};
        
        if (!projectId || !updates) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Missing projectId or updates' }),
          };
        }

        const projects = await fetchBin(bins.projects);
        const projectIndex = projects.findIndex(p => p.id === projectId);
        
        if (projectIndex === -1) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Project not found' }),
          };
        }

        const project = projects[projectIndex];

        // Check permissions: owner, coowner, or mod+
        const isOwner = project.owner?.id === sessionUserId;
        const isCoowner = project.coowners?.some(c => c.id === sessionUserId);
        const isStaff = hasPermission(actorRole, 'mod');

        if (!isOwner && !isCoowner && !isStaff) {
          return {
            statusCode: 403,
            headers,
            body: JSON.stringify({ error: 'Cannot edit this project' }),
          };
        }

        // Safe updates
        const safeUpdates = { ...updates };
        delete safeUpdates.id;
        delete safeUpdates.createdAt;

        projects[projectIndex] = {
          ...project,
          ...safeUpdates,
          updatedAt: new Date().toISOString(),
        };

        await saveBin(bins.projects, { projects });

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true, project: projects[projectIndex] }),
        };
      }

      // ─────────────────────────────────────────────────────────────────────────
      // DELETE PROJECT (Admin only or Owner)
      // ─────────────────────────────────────────────────────────────────────────
      case 'deleteProject': {
        const { projectId } = data || {};
        
        if (!projectId) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Missing projectId' }),
          };
        }

        const projects = await fetchBin(bins.projects);
        const projectIndex = projects.findIndex(p => p.id === projectId);
        
        if (projectIndex === -1) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Project not found' }),
          };
        }

        const project = projects[projectIndex];

        // Only owner or admin can delete
        const isOwner = project.owner?.id === sessionUserId;
        const isAdmin = actorRole === 'admin';

        if (!isOwner && !isAdmin) {
          return {
            statusCode: 403,
            headers,
            body: JSON.stringify({ error: 'Only owner or admin can delete' }),
          };
        }

        projects.splice(projectIndex, 1);
        await saveBin(bins.projects, { projects });

        // Notify owner if deleted by admin
        if (!isOwner && project.owner?.id) {
          await createNotification(
            project.owner.id,
            'warning',
            'Project Deleted',
            `Your project "${project.name}" was deleted by an administrator.`
          );
        }

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true }),
        };
      }

      // ─────────────────────────────────────────────────────────────────────────
      // MANAGE PROJECT MEMBERS (Admin/Mod/Owner/Coowner)
      // ─────────────────────────────────────────────────────────────────────────
      case 'addProjectMember': {
        const { projectId, userId, role } = data || {};
        
        if (!projectId || !userId) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Missing projectId or userId' }),
          };
        }

        const memberRole = role || 'member';
        if (!['coowner', 'member'].includes(memberRole)) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Invalid member role' }),
          };
        }

        const projects = await fetchBin(bins.projects);
        const projectIndex = projects.findIndex(p => p.id === projectId);
        
        if (projectIndex === -1) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Project not found' }),
          };
        }

        const project = projects[projectIndex];

        // Check permissions
        const isOwner = project.owner?.id === sessionUserId;
        const isCoowner = project.coowners?.some(c => c.id === sessionUserId);
        const isStaff = hasPermission(actorRole, 'mod');

        if (!isOwner && !isCoowner && !isStaff) {
          return {
            statusCode: 403,
            headers,
            body: JSON.stringify({ error: 'Cannot manage this project' }),
          };
        }

        // Only owner/staff can add coowners
        if (memberRole === 'coowner' && !isOwner && !isStaff) {
          return {
            statusCode: 403,
            headers,
            body: JSON.stringify({ error: 'Only owner or staff can add coowners' }),
          };
        }

        // Get user to add
        const userToAdd = users.find(u => u.id === userId);
        if (!userToAdd) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'User not found' }),
          };
        }

        const memberData = {
          id: userToAdd.id,
          nickname: userToAdd.nickname || userToAdd.email,
        };

        if (memberRole === 'coowner') {
          project.coowners = project.coowners || [];
          if (!project.coowners.some(c => c.id === userId)) {
            project.coowners.push(memberData);
          }
        } else {
          project.members = project.members || [];
          if (!project.members.some(m => m.id === userId)) {
            project.members.push(memberData);
          }
        }

        project.updatedAt = new Date().toISOString();
        await saveBin(bins.projects, { projects });

        // Notify the added user
        await createNotification(
          userId,
          'success',
          'Added to Project',
          `You've been added as ${memberRole} to "${project.name}".`
        );

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true, project }),
        };
      }

      case 'removeProjectMember': {
        const { projectId, userId } = data || {};
        
        if (!projectId || !userId) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Missing projectId or userId' }),
          };
        }

        const projects = await fetchBin(bins.projects);
        const projectIndex = projects.findIndex(p => p.id === projectId);
        
        if (projectIndex === -1) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Project not found' }),
          };
        }

        const project = projects[projectIndex];

        // Check permissions
        const isOwner = project.owner?.id === sessionUserId;
        const isStaff = hasPermission(actorRole, 'mod');

        if (!isOwner && !isStaff) {
          return {
            statusCode: 403,
            headers,
            body: JSON.stringify({ error: 'Only owner or staff can remove members' }),
          };
        }

        // Cannot remove owner
        if (project.owner?.id === userId) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Cannot remove project owner' }),
          };
        }

        project.coowners = (project.coowners || []).filter(c => c.id !== userId);
        project.members = (project.members || []).filter(m => m.id !== userId);
        project.updatedAt = new Date().toISOString();

        await saveBin(bins.projects, { projects });

        // Notify removed user
        await createNotification(
          userId,
          'info',
          'Removed from Project',
          `You've been removed from "${project.name}".`
        );

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true, project }),
        };
      }

      case 'changeProjectOwner': {
        const { projectId, newOwnerId } = data || {};
        
        if (!projectId || !newOwnerId) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Missing projectId or newOwnerId' }),
          };
        }

        // Only admins can change project ownership
        if (actorRole !== 'admin') {
          return {
            statusCode: 403,
            headers,
            body: JSON.stringify({ error: 'Only admins can transfer ownership' }),
          };
        }

        const projects = await fetchBin(bins.projects);
        const projectIndex = projects.findIndex(p => p.id === projectId);
        
        if (projectIndex === -1) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Project not found' }),
          };
        }

        const newOwner = users.find(u => u.id === newOwnerId);
        if (!newOwner) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'New owner not found' }),
          };
        }

        const project = projects[projectIndex];
        const oldOwnerId = project.owner?.id;

        // Set new owner
        project.owner = {
          id: newOwner.id,
          nickname: newOwner.nickname || newOwner.email,
        };

        // Remove new owner from coowners/members if present
        project.coowners = (project.coowners || []).filter(c => c.id !== newOwnerId);
        project.members = (project.members || []).filter(m => m.id !== newOwnerId);

        project.updatedAt = new Date().toISOString();
        await saveBin(bins.projects, { projects });

        // Notify new owner
        await createNotification(
          newOwnerId,
          'success',
          'Project Ownership',
          `You are now the owner of "${project.name}".`
        );

        // Notify old owner
        if (oldOwnerId && oldOwnerId !== newOwnerId) {
          await createNotification(
            oldOwnerId,
            'info',
            'Project Ownership Transferred',
            `Ownership of "${project.name}" has been transferred to ${newOwner.nickname || 'another user'}.`
          );
        }

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true, project }),
        };
      }

      default:
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: `Unknown action: ${action}` }),
        };
    }

  } catch (error) {
    console.error('Admin API error:', error.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
