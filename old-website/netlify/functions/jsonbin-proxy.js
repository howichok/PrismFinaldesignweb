/* ═══════════════════════════════════════════════════════════════════════════
   Netlify Function: JSONBin API Proxy
   
   This serverless function proxies ALL JSONBin requests to keep the API key
   server-side. The JSONBIN_API_KEY is NEVER exposed to the browser.
   
   SECURITY ARCHITECTURE:
   - saveUsers is SANITIZED to prevent role escalation attacks
   - For existing users: their role is ALWAYS preserved from the database
   - For new users: first user becomes admin (bootstrap), all others get 'user'
   - Role changes MUST go through admin-api.js which validates sessions
   
   Endpoint: /.netlify/functions/jsonbin-proxy
   Method: POST
   Body: { action: string, binId?: string, data?: object }
   
   Actions:
   - getUsers, saveUsers (sanitized - role changes ignored)
   - getProjects, saveProjects
   - getNicknameRequests, saveNicknameRequests
   - getNotifications, saveNotifications
   - getCompanies, saveCompanies
   - getInvitations, saveInvitations
   - getCollaborations, saveCollaborations
   - getCompanyContent, saveCompanyContent
   - getModerationRequests, saveModerationRequests
   - getRolePermissions, saveRolePermissions
   - getUserPermissionOverrides, saveUserPermissionOverrides
   ═══════════════════════════════════════════════════════════════════════════ */

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
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
    const { action, data } = JSON.parse(event.body || '{}');

    if (!action) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing action parameter' }),
      };
    }

    // Get secrets from environment - NEVER exposed to client
    const apiKey = process.env.JSONBIN_API_KEY;
    const bins = {
      users: process.env.USERS_BIN_ID,
      projects: process.env.PROJECTS_BIN_ID,
      nicknameRequests: process.env.NICKNAME_REQUESTS_BIN_ID,
      notifications: process.env.NOTIFICATIONS_BIN_ID,
      companies: process.env.COMPANIES_BIN_ID,
      invitations: process.env.INVITATIONS_BIN_ID,
      collaborations: process.env.COLLABORATIONS_BIN_ID,
      companyContent: process.env.COMPANY_CONTENT_BIN_ID,
      moderationRequests: process.env.MODERATION_REQUESTS_BIN_ID,
      rolePermissions: process.env.ROLE_PERMISSIONS_BIN_ID,
      userPermissionOverrides: process.env.USER_PERMISSION_OVERRIDES_BIN_ID,
    };

    // Debug: log what ENV vars we have
    console.log('[jsonbin-proxy] ENV check:', {
      hasApiKey: !!apiKey,
      hasUsersBin: !!bins.users,
      hasProjectsBin: !!bins.projects,
      hasNicknameRequestsBin: !!bins.nicknameRequests,
      hasNotificationsBin: !!bins.notifications,
      hasCompaniesBin: !!bins.companies,
      hasInvitationsBin: !!bins.invitations,
      hasCollaborationsBin: !!bins.collaborations,
      hasCompanyContentBin: !!bins.companyContent,
      hasModerationRequestsBin: !!bins.moderationRequests,
      action: action,
    });

    if (!apiKey) {
      console.error('JSONBIN_API_KEY not configured');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Server configuration error: missing API key' }),
      };
    }

    const BASE_URL = 'https://api.jsonbin.io/v3/b';

    // ═══════════════════════════════════════════════════════════════════════
    // SECURITY: Sanitize saveUsers to prevent role escalation
    // - For existing users: preserve their current role from the database
    // - For new users: only first user can be admin (bootstrap), others get 'user'
    // - Role changes MUST go through admin-api which validates sessions
    // ═══════════════════════════════════════════════════════════════════════
    if (action === 'saveUsers') {
      if (!bins.users) {
        console.error('[jsonbin-proxy] USERS_BIN_ID not configured');
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: 'Server configuration error: missing users bin ID' }),
        };
      }

      // Accept both { users: [...] } and direct array format
      const usersData = Array.isArray(data) ? data : (data?.users || null);
      
      if (!usersData || !Array.isArray(usersData)) {
        console.error('[jsonbin-proxy] Invalid users data received:', typeof data, data);
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid users data', received: typeof data }),
        };
      }

      try {
        // Fetch current users from database to get authoritative roles
      const currentRes = await fetch(`${BASE_URL}/${bins.users}/latest`, {
        headers: { 'X-Master-Key': apiKey },
      });
      
      let currentUsers = [];
      if (currentRes.ok) {
        const currentData = await currentRes.json();
        let record = currentData.record || [];
        
        // Handle case where JSONBin stores data as { users: [...] }
        if (record && typeof record === 'object' && !Array.isArray(record)) {
          if (Array.isArray(record.users)) {
            console.log('[jsonbin-proxy] Unwrapping nested users data from JSONBin');
            record = record.users;
          }
        }
        
        currentUsers = Array.isArray(record) ? record : [];
      }
      
      console.log(`[jsonbin-proxy] Current users count: ${currentUsers.length}`);
      
      // Create a map of current user IDs to their roles
      const currentRoles = {};
      currentUsers.forEach(u => {
        if (u.id && u.role) {
          currentRoles[u.id] = u.role;
        }
      });
      
      // Sanitize incoming data: preserve existing roles, set 'user' for new users
      const sanitizedUsers = usersData.map((user, index) => {
        const existingRole = currentRoles[user.id];
        
        if (existingRole) {
          // Existing user: FORCE their role to match database (prevents escalation)
          return { ...user, role: existingRole };
        } else {
          // New user: Only first user ever can be admin (bootstrap)
          // If there are already users in the system, new users get 'user' role
          if (currentUsers.length === 0 && index === 0) {
            // Bootstrap: first user becomes admin
            return { ...user, role: 'admin' };
          } else {
            // Subsequent users: force 'user' role
            return { ...user, role: 'user' };
          }
        }
      });
      
      // Save sanitized data
      const saveRes = await fetch(`${BASE_URL}/${bins.users}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Master-Key': apiKey,
        },
        body: JSON.stringify(sanitizedUsers),
      });
      
      if (!saveRes.ok) {
        const errorText = await saveRes.text();
        console.error('[jsonbin-proxy] Failed to save sanitized users:', saveRes.status, errorText);
        return {
          statusCode: saveRes.status,
          headers,
          body: JSON.stringify({ error: 'Failed to save users', details: errorText }),
        };
      }
      
      console.log('[SECURITY] saveUsers sanitized - role escalation prevented');
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true }),
      };
      } catch (error) {
        console.error('[jsonbin-proxy] saveUsers error:', error.message, error.stack);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: 'Internal server error', message: error.message }),
        };
      }
    }

    // Map action to bin
    const actionToBin = {
      getUsers: bins.users,
      getProjects: bins.projects,
      saveProjects: bins.projects,
      getNicknameRequests: bins.nicknameRequests,
      saveNicknameRequests: bins.nicknameRequests,
      getNotifications: bins.notifications,
      saveNotifications: bins.notifications,
      // Companies
      getCompanies: bins.companies,
      saveCompanies: bins.companies,
      // Invitations
      getInvitations: bins.invitations,
      saveInvitations: bins.invitations,
      // Collaborations
      getCollaborations: bins.collaborations,
      saveCollaborations: bins.collaborations,
      // Company Content (Lines, Stations, Buildings)
      getCompanyContent: bins.companyContent,
      saveCompanyContent: bins.companyContent,
      // Moderation Requests
      getModerationRequests: bins.moderationRequests,
      saveModerationRequests: bins.moderationRequests,
      // Permissions
      getRolePermissions: bins.rolePermissions,
      saveRolePermissions: bins.rolePermissions,
      getUserPermissionOverrides: bins.userPermissionOverrides,
      saveUserPermissionOverrides: bins.userPermissionOverrides,
    };

    const binId = actionToBin[action];
    if (!binId) {
      console.error(`[jsonbin-proxy] No bin ID for action: ${action}. Check ENV vars.`);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: `Unknown action or missing bin ID: ${action}`,
          hint: 'Check that all *_BIN_ID environment variables are set in Netlify',
        }),
      };
    }

    console.log(`[jsonbin-proxy] Processing ${action} on bin ${binId.substring(0, 8)}...`);

    const isWrite = action.startsWith('save');
    const url = `${BASE_URL}/${binId}${isWrite ? '' : '/latest'}`;

    const fetchOptions = {
      method: isWrite ? 'PUT' : 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': apiKey,
      },
    };

    if (isWrite) {
      if (!data) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Missing data for save operation' }),
        };
      }
      // Handle both wrapped ({ projects: [...] }) and direct array formats
      let saveData = data;
      if (!Array.isArray(data)) {
        // Extract the first array property (projects, requests, notifications, etc.)
        const arrayProp = Object.values(data).find(v => Array.isArray(v));
        if (arrayProp) {
          saveData = arrayProp;
        }
      }
      fetchOptions.body = JSON.stringify(saveData);
    }

    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`JSONBin ${action} failed:`, response.status, errorText);
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ 
          error: `JSONBin request failed`,
          status: response.status,
        }),
      };
    }

    const result = await response.json();

    // For reads, return just the record data
    if (!isWrite) {
      let data = result.record || [];
      
      // Handle case where JSONBin stores data as { users: [...] } instead of [...]
      // This can happen if data was saved incorrectly
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        // Try to extract the array from common wrapper keys
        const arrayData = data.users || data.projects || data.requests || data.notifications;
        if (Array.isArray(arrayData)) {
          console.log(`[jsonbin-proxy] Unwrapping nested ${action} data`);
          data = arrayData;
        }
      }
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(data),
      };
    }

    // For writes, return success
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true }),
    };

  } catch (error) {
    console.error('[jsonbin-proxy] Unhandled error:', error.message, error.stack);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: error.message,
      }),
    };
  }
};
