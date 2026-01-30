/* ═══════════════════════════════════════════════════════════════════════════
   Netlify Function: Supabase API Proxy

   This serverless function proxies Supabase requests to keep credentials
   server-side. The SUPABASE_SERVICE_KEY is NEVER exposed to the browser.

   Environment Variables Required:
   - SUPABASE_URL: Your Supabase project URL
   - SUPABASE_SERVICE_KEY: Your Supabase service role key

   Endpoint: /.netlify/functions/supabase-proxy
   Method: POST
   Body: { action: string, data?: object }
   
   SECURITY:
   - Public actions (getUsers, getProjects, etc.) - no auth required
   - Write actions (create, update, delete) - require valid session cookie
   - Admin actions (updateUserRole) - require mod+ role
   ═══════════════════════════════════════════════════════════════════════════ */

const { createClient } = require('@supabase/supabase-js');
const { verifySession } = require('./utils/verify-session');

// Initialize Supabase client (lazy loaded)
let supabase = null;

function getSupabase() {
  if (!supabase) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration missing');
    }

    supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return supabase;
}

// Response helpers
const BASE_HEADERS = {
  'Access-Control-Allow-Headers': 'Content-Type, If-None-Match, If-Modified-Since',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Expose-Headers': 'ETag, Last-Modified, X-Data-Version',
  'Content-Type': 'application/json',
};

function applyCors(origin) {
  const allowOrigin = origin || process.env.URL || '';
  if (!allowOrigin) return { ...BASE_HEADERS };
  return {
    ...BASE_HEADERS,
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Credentials': 'true',
  };
}

/**
 * Generate stable ETag from collection data
 * Uses max(updatedAt) + count instead of MD5 hash for stability
 * @param {Array|Object} data - Data to generate ETag for
 * @returns {string} ETag string
 */
function generateETag(data) {
  if (!data) return '"empty"';
  
  // For arrays (collections), use max updatedAt + count
  if (Array.isArray(data)) {
    if (data.length === 0) return '"empty-0"';
    
    let maxTimestamp = 0;
    for (const item of data) {
      // Check various timestamp fields
      const timestamps = [
        item.updatedAt,
        item.updated_at,
        item.createdAt,
        item.created_at,
      ].filter(Boolean);
      
      for (const ts of timestamps) {
        const time = new Date(ts).getTime();
        if (!isNaN(time) && time > maxTimestamp) {
          maxTimestamp = time;
        }
      }
    }
    
    // Format: "timestamp-count"
    return `"${maxTimestamp}-${data.length}"`;
  }
  
  // For single objects, use updatedAt or id
  if (typeof data === 'object' && data !== null) {
    const timestamp = data.updatedAt || data.updated_at || data.createdAt || data.created_at;
    const id = data.id || 'obj';
    if (timestamp) {
      return `"${new Date(timestamp).getTime()}-${id}"`;
    }
    return `"${id}"`;
  }
  
  // Fallback for primitives
  return `"${String(data).slice(0, 32)}"`;
}

/**
 * Check if client has valid cached version
 * @param {string} clientETag - ETag from If-None-Match header
 * @param {string} serverETag - Current server ETag
 * @returns {boolean}
 */
function isNotModified(clientETag, serverETag) {
  if (!clientETag || !serverETag) return false;
  // Handle weak ETags
  const normalizedClient = clientETag.replace(/^W\//, '').replace(/"/g, '');
  const normalizedServer = serverETag.replace(/^W\//, '').replace(/"/g, '');
  return normalizedClient === normalizedServer;
}

function success(data, options = {}, origin = null) {
  const responseHeaders = { ...applyCors(origin) };
  
  // Add ETag if caching is enabled
  if (options.etag) {
    responseHeaders['ETag'] = options.etag;
  }
  
  // Add Last-Modified if provided
  if (options.lastModified) {
    responseHeaders['Last-Modified'] = options.lastModified;
  }
  
  // Add cache control for public data
  if (options.public) {
    responseHeaders['Cache-Control'] = 'public, max-age=30, stale-while-revalidate=60';
  } else if (options.private) {
    // Private data can be cached by SW, but not shared caches
    responseHeaders['Cache-Control'] = 'private, max-age=60';
  }
  
  return {
    statusCode: 200,
    headers: responseHeaders,
    body: JSON.stringify(data),
  };
}

/**
 * Return 304 Not Modified response
 */
function notModified(etag, origin = null) {
  return {
    statusCode: 304,
    headers: {
      ...applyCors(origin),
      'ETag': etag,
    },
    body: '',
  };
}

function error(message, status = 400, origin = null) {
  return {
    statusCode: status,
    headers: applyCors(origin),
    body: JSON.stringify({ error: message }),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// FIELD NAME CONVERSION HELPERS
// ═══════════════════════════════════════════════════════════════════════════

// Convert camelCase to snake_case
function toSnakeCase(str) {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

// Convert snake_case to camelCase
function toCamelCase(str) {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

// Convert object keys from camelCase to snake_case for database
function toDbFormat(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  
  const converted = {};
  for (const [key, value] of Object.entries(obj)) {
    // Handle special cases where frontend passes object but DB expects ID
    if (key === 'author' && typeof value === 'object' && value !== null) {
      converted['author_id'] = value.id;
      continue;
    }
    if (key === 'owner' && typeof value === 'object' && value !== null) {
      converted['owner_id'] = value.id;
      continue;
    }
    
    // Map specific field names
    let dbKey = key;
    if (key === 'mcNickname') dbKey = 'mc_nickname';
    else if (key === 'avatar') dbKey = 'avatar_url';
    else if (key === 'createdAt') dbKey = 'created_at';
    else if (key === 'updatedAt') dbKey = 'updated_at';
    else if (key === 'ownerId') dbKey = 'owner_id';
    else if (key === 'companyId') dbKey = 'company_id';
    else if (key === 'authorId') dbKey = 'author_id';
    else if (key === 'userId') dbKey = 'user_id';
    else if (key === 'inviterId') dbKey = 'inviter_id';
    else if (key === 'inviteeId') dbKey = 'invitee_id';
    else if (key === 'requesterId') dbKey = 'requester_id';
    else if (key === 'moderatorId') dbKey = 'moderator_id';
    else if (key === 'logoUrl') dbKey = 'logo_url';
    else if (key === 'imageUrl') dbKey = 'image_url';
    else if (key === 'image') dbKey = 'image_url'; // frontend uses 'image', DB uses 'image_url'
    else if (key === 'logo') dbKey = 'logo_url'; // frontend uses 'logo', DB uses 'logo_url'
    else if (key === 'publishedAt') dbKey = 'published_at';
    else if (key === 'resolvedAt') dbKey = 'resolved_at';
    else if (key === 'respondedAt') dbKey = 'responded_at';
    else if (key === 'expiresAt') dbKey = 'expires_at';
    else if (key === 'joinedAt') dbKey = 'joined_at';
    else if (key === 'permissionOverrides') dbKey = 'permission_overrides';
    else if (key === 'trustedMembers') dbKey = 'trusted_members';
    else if (key === 'inviteeEmail') dbKey = 'invitee_email';
    else if (key === 'currentNickname') dbKey = 'current_nickname';
    else if (key === 'requestedNickname') dbKey = 'requested_nickname';
    else if (key === 'targetType') dbKey = 'target_type';
    else if (key === 'targetId') dbKey = 'target_id';
    else if (key === 'createdBy') dbKey = 'created_by';
    
    // Skip fields that don't belong in the database (frontend-only)
    if (key === 'coowners' || key === 'members') {
      // These are handled separately for projects
      continue;
    }
    
    // Don't convert nested objects like 'connections' or 'metadata'
    if (key === 'connections' || key === 'metadata' || key === 'settings' || key === 'data' || key === 'permissions') {
      converted[dbKey] = value;
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      converted[dbKey] = toDbFormat(value);
    } else {
      converted[dbKey] = value;
    }
  }
  return converted;
}

// Convert object keys from snake_case to camelCase for frontend
function toFrontendFormat(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    if (Array.isArray(obj)) return obj.map(toFrontendFormat);
    return obj;
  }
  
  const converted = {};
  for (const [key, value] of Object.entries(obj)) {
    // Map specific field names back
    let feKey = key;
    if (key === 'mc_nickname') feKey = 'mcNickname';
    else if (key === 'avatar_url') feKey = 'avatar';
    else if (key === 'created_at') feKey = 'createdAt';
    else if (key === 'updated_at') feKey = 'updatedAt';
    else if (key === 'owner_id') feKey = 'ownerId';
    else if (key === 'company_id') feKey = 'companyId';
    else if (key === 'author_id') feKey = 'authorId';
    else if (key === 'user_id') feKey = 'userId';
    else if (key === 'inviter_id') feKey = 'inviterId';
    else if (key === 'invitee_id') feKey = 'inviteeId';
    else if (key === 'requester_id') feKey = 'requesterId';
    else if (key === 'moderator_id') feKey = 'moderatorId';
    else if (key === 'logo_url') feKey = 'logoUrl';
    else if (key === 'image_url') feKey = 'image'; // DB uses 'image_url', frontend uses 'image'
    else if (key === 'published_at') feKey = 'publishedAt';
    else if (key === 'resolved_at') feKey = 'resolvedAt';
    else if (key === 'responded_at') feKey = 'respondedAt';
    else if (key === 'expires_at') feKey = 'expiresAt';
    else if (key === 'joined_at') feKey = 'joinedAt';
    else if (key === 'permission_overrides') feKey = 'permissionOverrides';
    else if (key === 'trusted_members') feKey = 'trustedMembers';
    else if (key === 'invitee_email') feKey = 'inviteeEmail';
    else if (key === 'current_nickname') feKey = 'currentNickname';
    else if (key === 'requested_nickname') feKey = 'requestedNickname';
    else if (key === 'target_type') feKey = 'targetType';
    else if (key === 'target_id') feKey = 'targetId';
    else if (key === 'created_by') feKey = 'createdBy';
    
    // Don't convert nested objects like 'connections' or 'metadata', but convert their contents
    if (key === 'owner' || key === 'company' || key === 'author' || key === 'user' || 
        key === 'inviter' || key === 'requester' || key === 'moderator' ||
        key === 'requester_company' || key === 'target_company') {
      converted[feKey] = toFrontendFormat(value);
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value) &&
               key !== 'connections' && key !== 'metadata' && key !== 'settings' && 
               key !== 'data' && key !== 'permissions') {
      converted[feKey] = toFrontendFormat(value);
    } else {
      converted[feKey] = value;
    }
  }
  return converted;
}

// ═══════════════════════════════════════════════════════════════════════════
// ACTION HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

const handlers = {
  // ─── USERS ───────────────────────────────────────────────────────────────

  async getUsers() {
    const db = getSupabase();
    const { data, error: err } = await db
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (err) throw new Error(err.message);
    return (data || []).map(toFrontendFormat);
  },

  async createUser(userData) {
    const db = getSupabase();

    // Check if first user (bootstrap admin)
    const { count } = await db.from('users').select('*', { count: 'exact', head: true });
    const role = count === 0 ? 'admin' : 'user';

    // Convert camelCase to snake_case for database
    const dbData = toDbFormat(userData);
    
    // Remove custom ID (frontend generates non-UUID IDs) - let Supabase generate UUID
    delete dbData.id;
    
    const { data, error: err } = await db
      .from('users')
      .insert([{ ...dbData, role }])
      .select()
      .single();

    if (err) throw new Error(err.message);
    return toFrontendFormat(data);
  },

  async updateUser({ userId, updates }) {
    const db = getSupabase();

    // Convert to database format (allow role changes for admin operations)
    const dbUpdates = toDbFormat(updates);

    const { data, error: err } = await db
      .from('users')
      .update({ ...dbUpdates, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select()
      .single();

    if (err) throw new Error(err.message);
    return toFrontendFormat(data);
  },

  async deleteUser({ userId }) {
    const db = getSupabase();
    
    // Delete user (cascades will handle related data)
    const { error: err } = await db
      .from('users')
      .delete()
      .eq('id', userId);

    if (err) throw new Error(err.message);
    return { success: true };
  },

  async saveUsers({ users }) {
    const db = getSupabase();
    
    // UUID regex pattern
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    const savedUsers = [];
    
    // Upsert all users (for compatibility with JSONBin pattern)
    for (const user of users) {
      const { role, ...safeUser } = user; // Don't allow role changes
      
      // Convert to database format
      const dbUser = toDbFormat(safeUser);
      const dbUserWithRole = toDbFormat(user);
      
      // Check if ID is a valid UUID
      const hasValidUuid = user.id && uuidRegex.test(user.id);
      
      if (hasValidUuid) {
        // ID is a valid UUID - check if user exists by ID
        const { data: existing } = await db
          .from('users')
          .select('id')
          .eq('id', user.id)
          .single();
        
        if (existing) {
          // Update existing user
          const { data: updated } = await db
            .from('users')
            .update({ ...dbUser, updated_at: new Date().toISOString() })
            .eq('id', user.id)
            .select()
            .single();
          if (updated) savedUsers.push(toFrontendFormat(updated));
        } else {
          // Insert new user with the provided UUID
          const { data: inserted } = await db
            .from('users')
            .insert([{ ...dbUserWithRole, created_at: new Date().toISOString() }])
            .select()
            .single();
          if (inserted) savedUsers.push(toFrontendFormat(inserted));
        }
      } else if (user.email) {
        // ID is not a valid UUID - try to find by email
        const { data: existingByEmail } = await db
          .from('users')
          .select('id')
          .eq('email', user.email)
          .single();
        
        if (existingByEmail) {
          // Update existing user found by email
          const { data: updated } = await db
            .from('users')
            .update({ ...dbUser, updated_at: new Date().toISOString() })
            .eq('id', existingByEmail.id)
            .select()
            .single();
          if (updated) savedUsers.push(toFrontendFormat(updated));
        } else {
          // Insert new user - let Supabase generate UUID
          delete dbUserWithRole.id;
          const { data: inserted } = await db
            .from('users')
            .insert([{ ...dbUserWithRole, created_at: new Date().toISOString() }])
            .select()
            .single();
          if (inserted) savedUsers.push(toFrontendFormat(inserted));
        }
      } else {
        // No valid ID and no email - skip this user
        console.warn('[saveUsers] Skipping user without valid ID or email');
      }
    }
    
    // Return the saved users with their real database IDs
    return { success: true, users: savedUsers };
  },

  // ─── PROJECTS ────────────────────────────────────────────────────────────

  async getProjects() {
    const db = getSupabase();
    const { data, error: err } = await db
      .from('projects')
      .select(`
        *,
        owner:users!projects_owner_id_fkey(id, email, nickname, avatar_url),
        company:companies(id, name, slug)
      `)
      .order('created_at', { ascending: false });

    if (err) throw new Error(err.message);
    return (data || []).map(toFrontendFormat);
  },

  async createProject(projectData) {
    const db = getSupabase();

    // Generate slug from name
    const slug = (projectData.name || 'project')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') +
      '-' + Date.now().toString(36);

    // Convert to database format
    const dbData = toDbFormat(projectData);
    
    // Remove custom ID (frontend generates non-UUID IDs) - let Supabase generate UUID
    delete dbData.id;

    // If creating as a company, validate user has permission
    if (dbData.company_id) {
      const ownerId = dbData.owner_id;
      if (!ownerId) {
        throw new Error('Owner ID required when creating project as company');
      }

      // Check if user is a member with creation permission
      const { data: membership, error: memberErr } = await db
        .from('company_members')
        .select('role')
        .eq('company_id', dbData.company_id)
        .eq('user_id', ownerId)
        .single();

      if (memberErr || !membership) {
        throw new Error('You do not have permission to create projects for this company');
      }

      // Only owner and admin can create projects as company
      if (membership.role !== 'owner' && membership.role !== 'admin') {
        throw new Error('You do not have permission to create projects for this company');
      }
    }

    const { data, error: err } = await db
      .from('projects')
      .insert([{ ...dbData, slug }])
      .select()
      .single();

    if (err) throw new Error(err.message);
    return toFrontendFormat(data);
  },

  async updateProject({ projectId, updates }) {
    const db = getSupabase();
    const dbUpdates = toDbFormat(updates);
    
    const { data, error: err } = await db
      .from('projects')
      .update({ ...dbUpdates, updated_at: new Date().toISOString() })
      .eq('id', projectId)
      .select()
      .single();

    if (err) throw new Error(err.message);
    return toFrontendFormat(data);
  },

  async deleteProject({ projectId }) {
    const db = getSupabase();
    const { error: err } = await db
      .from('projects')
      .delete()
      .eq('id', projectId);

    if (err) throw new Error(err.message);
    return { success: true };
  },

  // ─── POSTS ───────────────────────────────────────────────────────────────

  async getPosts() {
    const db = getSupabase();
    const { data, error: err } = await db
      .from('posts')
      .select(`
        *,
        author:users!posts_author_id_fkey(id, email, nickname, avatar_url),
        company:companies(id, name, slug)
      `)
      .order('created_at', { ascending: false });

    if (err) throw new Error(err.message);
    return (data || []).map(toFrontendFormat);
  },

  async createPost(postData) {
    const db = getSupabase();

    // Generate slug from title
    const slug = (postData.title || 'post')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') +
      '-' + Date.now().toString(36);

    // Convert to database format
    const dbData = toDbFormat(postData);
    
    // Remove custom ID (frontend generates non-UUID IDs) - let Supabase generate UUID
    delete dbData.id;

    // If posting as a company, validate user has permission
    if (dbData.company_id) {
      const authorId = dbData.author_id;
      if (!authorId) {
        throw new Error('Author ID required when posting as company');
      }

      // Check if user is a member with posting permission
      const { data: membership, error: memberErr } = await db
        .from('company_members')
        .select('role')
        .eq('company_id', dbData.company_id)
        .eq('user_id', authorId)
        .single();

      if (memberErr || !membership) {
        throw new Error('You do not have permission to post as this company');
      }

      // Only owner and admin can post as company
      if (membership.role !== 'owner' && membership.role !== 'admin') {
        throw new Error('You do not have permission to post as this company');
      }
    }

    const { data, error: err } = await db
      .from('posts')
      .insert([{ ...dbData, slug }])
      .select()
      .single();

    if (err) throw new Error(err.message);
    return toFrontendFormat(data);
  },

  async updatePost({ postId, updates }) {
    const db = getSupabase();
    const dbUpdates = toDbFormat(updates);
    
    const { data, error: err } = await db
      .from('posts')
      .update({ ...dbUpdates, updated_at: new Date().toISOString() })
      .eq('id', postId)
      .select()
      .single();

    if (err) throw new Error(err.message);
    return toFrontendFormat(data);
  },

  async deletePost({ postId }) {
    const db = getSupabase();
    const { error: err } = await db
      .from('posts')
      .delete()
      .eq('id', postId);

    if (err) throw new Error(err.message);
    return { success: true };
  },

  // ─── COMPANIES ───────────────────────────────────────────────────────────

  async getCompanies() {
    const db = getSupabase();
    const { data, error: err } = await db
      .from('companies')
      .select(`
        *,
        owner:users!companies_owner_id_fkey(id, email, nickname, avatar_url),
        members:company_members(
          id,
          role,
          joined_at,
          user:users(id, email, nickname, avatar_url)
        )
      `)
      .order('created_at', { ascending: false });

    if (err) throw new Error(err.message);
    
    // Transform members to flat format expected by frontend and convert to frontend format
    const companies = (data || []).map(company => {
      const converted = toFrontendFormat(company);
      converted.members = (company.members || []).map(m => ({
        id: m.user?.id,
        email: m.user?.email,
        nickname: m.user?.nickname,
        avatar: m.user?.avatar_url,
        role: m.role,
        joinedAt: m.joined_at
      }));
      return converted;
    });
    
    return companies;
  },

  async createCompany(companyData) {
    const db = getSupabase();

    // Generate slug from name
    const slug = (companyData.name || 'company')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') +
      '-' + Date.now().toString(36);

    // Ensure owner_id is set correctly
    const ownerId = companyData.owner_id || companyData.ownerId;
    if (!ownerId) {
      throw new Error('Owner ID is required');
    }
    
    // Prepare data for database
    const insertData = {
      name: companyData.name,
      description: companyData.description || '',
      slug: slug,
      owner_id: ownerId,
    };
    
    // Handle categories - ensure it's an array and valid JSON
    if (companyData.categories) {
      if (Array.isArray(companyData.categories)) {
        insertData.categories = companyData.categories;
      } else {
        insertData.categories = [companyData.categories];
      }
    } else if (companyData.category) {
      insertData.categories = [companyData.category];
    }
    
    // Handle logo_url
    if (companyData.logo || companyData.logo_url) {
      insertData.logo_url = companyData.logo || companyData.logo_url;
    }

    console.log('[Proxy] Creating company with data:', JSON.stringify(insertData, null, 2));

    // Create company
    const { data: company, error: companyErr } = await db
      .from('companies')
      .insert([insertData])
      .select()
      .single();

    if (companyErr) {
      console.error('[Proxy] Company creation error:', companyErr);
      console.error('[Proxy] Error code:', companyErr.code);
      console.error('[Proxy] Error details:', JSON.stringify(companyErr, null, 2));
      throw new Error(companyErr.message || 'Failed to create company');
    }

    if (!company) {
      console.error('[Proxy] Company creation returned no data');
      throw new Error('Company creation returned no data');
    }

    console.log('[Proxy] Company created successfully:', company.id);
    console.log('[Proxy] Company data:', JSON.stringify(company, null, 2));

    // Add owner as member
    if (ownerId) {
      const { error: memberErr } = await db.from('company_members').insert([{
        company_id: company.id,
        user_id: ownerId,
        role: 'owner',
      }]);
      
      if (memberErr) {
        console.warn('[Proxy] Failed to add owner as member:', memberErr);
        // Don't throw - company was created successfully
      }
    }

    return toFrontendFormat(company);
  },

  async updateCompany({ companyId, updates }) {
    const db = getSupabase();
    const dbUpdates = toDbFormat(updates);
    
    const { data, error: err } = await db
      .from('companies')
      .update({ ...dbUpdates, updated_at: new Date().toISOString() })
      .eq('id', companyId)
      .select()
      .single();

    if (err) throw new Error(err.message);
    return toFrontendFormat(data);
  },

  async deleteCompany({ companyId }) {
    const db = getSupabase();
    const { error: err } = await db
      .from('companies')
      .delete()
      .eq('id', companyId);

    if (err) throw new Error(err.message);
    return { success: true };
  },

  // ─── NOTIFICATIONS ───────────────────────────────────────────────────────

  async getNotifications({ userId }) {
    const db = getSupabase();
    
    // Ensure userId is a string UUID, not an object
    const userIdStr = typeof userId === 'string' ? userId : (userId?.id || String(userId));
    
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userIdStr)) {
      throw new Error(`Invalid user ID format: ${userIdStr}`);
    }
    
    const { data, error: err } = await db
      .from('notifications')
      .select('*')
      .eq('user_id', userIdStr)
      .order('created_at', { ascending: false })
      .limit(50);

    if (err) throw new Error(err.message);
    return (data || []).map(toFrontendFormat);
  },

  async createNotification(notificationData) {
    const db = getSupabase();
    const dbData = toDbFormat(notificationData);
    
    const { data, error: err } = await db
      .from('notifications')
      .insert([dbData])
      .select()
      .single();

    if (err) throw new Error(err.message);
    return toFrontendFormat(data);
  },

  async markNotificationRead({ notificationId }) {
    const db = getSupabase();
    const { error: err } = await db
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId);

    if (err) throw new Error(err.message);
    return { success: true };
  },

  async markAllNotificationsRead({ userId }) {
    const db = getSupabase();
    const { error: err } = await db
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false);

    if (err) throw new Error(err.message);
    return { success: true };
  },

  /**
   * Send bulk notifications from admin panel
   * @param {object} params - { title, message, type, targets }
   * targets can be: 'all_users', 'all_companies', 'project_members', or array of user IDs
   */
  async sendBulkNotifications({ title, message, type = 'admin_broadcast', targets, projectId, companyId }) {
    const db = getSupabase();
    let userIds = [];
    
    if (targets === 'all_users') {
      const { data: users } = await db.from('users').select('id');
      userIds = (users || []).map(u => u.id);
    } else if (targets === 'all_companies') {
      // Notify all company owners
      const { data: companies } = await db.from('companies').select('owner_id');
      userIds = (companies || []).map(c => c.owner_id).filter(Boolean);
    } else if (targets === 'project_members' && projectId) {
      // Notify all members of a specific project
      const { data: members } = await db
        .from('project_members')
        .select('user_id')
        .eq('project_id', projectId);
      userIds = (members || []).map(m => m.user_id);
      
      // Also get the owner
      const { data: project } = await db.from('projects').select('owner_id').eq('id', projectId).single();
      if (project?.owner_id && !userIds.includes(project.owner_id)) {
        userIds.push(project.owner_id);
      }
    } else if (targets === 'company_members' && companyId) {
      // Notify all members of a specific company
      const { data: members } = await db
        .from('company_members')
        .select('user_id')
        .eq('company_id', companyId);
      userIds = (members || []).map(m => m.user_id);
      
      // Also get the owner
      const { data: company } = await db.from('companies').select('owner_id').eq('id', companyId).single();
      if (company?.owner_id && !userIds.includes(company.owner_id)) {
        userIds.push(company.owner_id);
      }
    } else if (Array.isArray(targets)) {
      userIds = targets;
    }
    
    if (userIds.length === 0) {
      throw new Error('No recipients found for notification');
    }
    
    // Remove duplicates
    userIds = [...new Set(userIds)];
    
    const notifications = userIds.map(userId => ({
      user_id: userId,
      type,
      title,
      message,
      data: { bulk: true, projectId, companyId },
      read: false,
      created_at: new Date().toISOString()
    }));
    
    const { error: err } = await db.from('notifications').insert(notifications);
    
    if (err) throw new Error(err.message);
    return { success: true, count: userIds.length };
  },

  // ─── INVITATIONS ─────────────────────────────────────────────────────────

  async getInvitations() {
    const db = getSupabase();
    const { data, error: err } = await db
      .from('invitations')
      .select(`
        *,
        company:companies(id, name, slug),
        inviter:users!invitations_inviter_id_fkey(id, email, nickname)
      `)
      .order('created_at', { ascending: false });

    if (err) throw new Error(err.message);
    return (data || []).map(toFrontendFormat);
  },

  async createInvitation(invitationData) {
    const db = getSupabase();
    
    // Handle both formats: direct data or expanded parameters
    let companyId, inviterId, invitedUsername, role;
    
    if (invitationData.invitedUsername) {
      // New format: { companyId, inviterId, invitedUsername, role }
      companyId = invitationData.companyId;
      inviterId = invitationData.inviterId;
      invitedUsername = invitationData.invitedUsername;
      role = invitationData.role || 'member';
    } else if (invitationData.invitee_email) {
      // Direct database format
      const { data, error: err } = await db
        .from('invitations')
        .insert([invitationData])
        .select()
        .single();
      if (err) throw new Error(err.message);
      return data;
    } else {
      throw new Error('Invalid invitation data format');
    }
    
    // Find user by username, nickname, or email
    let inviteeUser;
    
    // Try to find by exact username first
    const { data: byUsername } = await db
      .from('users')
      .select('id, email, nickname, username')
      .eq('username', invitedUsername)
      .single();
    
    if (byUsername) {
      inviteeUser = byUsername;
    } else {
      // Try by nickname
      const { data: byNickname } = await db
        .from('users')
        .select('id, email, nickname, username')
        .eq('nickname', invitedUsername)
        .single();
      
      if (byNickname) {
        inviteeUser = byNickname;
      } else {
        // Try by email
        const { data: byEmail } = await db
          .from('users')
          .select('id, email, nickname, username')
          .eq('email', invitedUsername)
          .single();
        
        inviteeUser = byEmail;
      }
    }
    
    if (!inviteeUser) {
      throw new Error(`User "${invitedUsername}" not found`);
    }
    
    // Check if user is already a member
    const { data: company } = await db
      .from('companies')
      .select('owner_id')
      .eq('id', companyId)
      .single();
    
    if (company) {
      if (company.owner_id === inviteeUser.id) {
        throw new Error(`${invitedUsername} is the owner of this company`);
      }
    }
    
    // Check in company_members table
    const { data: existingMember } = await db
      .from('company_members')
      .select('id')
      .eq('company_id', companyId)
      .eq('user_id', inviteeUser.id)
      .single();
    
    if (existingMember) {
      throw new Error(`${invitedUsername} is already a member of this company`);
    }
    
    // Check if there's already a pending invitation
    const { data: existingInvite } = await db
      .from('invitations')
      .select('id')
      .eq('company_id', companyId)
      .eq('invitee_id', inviteeUser.id)
      .eq('status', 'pending')
      .single();
    
    if (existingInvite) {
      throw new Error(`${invitedUsername} already has a pending invitation`);
    }
    
    // Create invitation
    const { data, error: err } = await db
      .from('invitations')
      .insert([{
        company_id: companyId,
        inviter_id: inviterId,
        invitee_email: inviteeUser.email || invitedUsername,
        invitee_id: inviteeUser.id,
        role: role,
        status: 'pending',
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (err) throw new Error(err.message);
    return toFrontendFormat(data);
  },

  async updateInvitation({ invitationId, updates }) {
    const db = getSupabase();
    const dbUpdates = toDbFormat(updates);
    
    const { data, error: err } = await db
      .from('invitations')
      .update(dbUpdates)
      .eq('id', invitationId)
      .select()
      .single();

    if (err) throw new Error(err.message);
    return toFrontendFormat(data);
  },

  async acceptInvitation({ invitationId, userId }) {
    const db = getSupabase();
    
    // Get invitation
    const { data: invitation, error: invErr } = await db
      .from('invitations')
      .select('*, company:companies(*)')
      .eq('id', invitationId)
      .single();
    
    if (invErr) throw new Error(invErr.message);
    if (!invitation) throw new Error('Invitation not found');
    
    // Update invitation status
    await db.from('invitations').update({ 
      status: 'accepted',
      responded_at: new Date().toISOString()
    }).eq('id', invitationId);
    
    // Add user to company_members table
    const { error: memberErr } = await db.from('company_members').insert([{
      company_id: invitation.company_id,
      user_id: userId,
      role: invitation.role || 'member',
      joined_at: new Date().toISOString()
    }]);
    
    if (memberErr) throw new Error(memberErr.message);
    
    return { success: true };
  },

  async declineInvitation({ invitationId, userId }) {
    const db = getSupabase();
    const { error: err } = await db
      .from('invitations')
      .update({ status: 'declined' })
      .eq('id', invitationId);
    
    if (err) throw new Error(err.message);
    return { success: true };
  },

  async cancelInvitation({ invitationId, companyId, userId }) {
    const db = getSupabase();
    const { error: err } = await db
      .from('invitations')
      .delete()
      .eq('id', invitationId)
      .eq('company_id', companyId);
    
    if (err) throw new Error(err.message);
    return { success: true };
  },

  // ─── COMPANY MEMBERS ─────────────────────────────────────────────────────

  async setCompanyTrustedMember({ companyId, memberId, isTrusted }) {
    const db = getSupabase();
    
    const { data: company } = await db.from('companies').select('trusted_members').eq('id', companyId).single();
    let trustedMembers = company?.trusted_members || [];
    
    if (isTrusted && !trustedMembers.includes(memberId)) {
      trustedMembers.push(memberId);
    } else if (!isTrusted) {
      trustedMembers = trustedMembers.filter(id => id !== memberId);
    }
    
    const { error: err } = await db.from('companies').update({ trusted_members: trustedMembers }).eq('id', companyId);
    if (err) throw new Error(err.message);
    return { success: true };
  },

  async removeCompanyMember({ companyId, memberId }) {
    const db = getSupabase();
    
    // Remove from company_members table
    const { error: memberErr } = await db
      .from('company_members')
      .delete()
      .eq('company_id', companyId)
      .eq('user_id', memberId);
    
    if (memberErr) throw new Error(memberErr.message);
    
    // Also remove from trusted_members if present
    const { data: company } = await db.from('companies').select('trusted_members').eq('id', companyId).single();
    if (company?.trusted_members?.includes(memberId)) {
      const trustedMembers = company.trusted_members.filter(id => id !== memberId);
      await db.from('companies').update({ trusted_members: trustedMembers }).eq('id', companyId);
    }
    
    return { success: true };
  },

  // ─── PERMISSION OVERRIDES ────────────────────────────────────────────────

  async setUserPermissionOverrides({ userId, overrides }) {
    const db = getSupabase();
    const { data, error: err } = await db
      .from('users')
      .update({ permission_overrides: overrides })
      .eq('id', userId)
      .select()
      .single();
    
    if (err) throw new Error(err.message);
    return data;
  },

  async clearUserPermissionOverrides({ userId }) {
    const db = getSupabase();
    const { data, error: err } = await db
      .from('users')
      .update({ permission_overrides: null })
      .eq('id', userId)
      .select()
      .single();
    
    if (err) throw new Error(err.message);
    return data;
  },

  // ─── COLLABORATIONS ──────────────────────────────────────────────────────

  async getCollaborationsByCompany({ companyId }) {
    const db = getSupabase();
    const { data, error: err } = await db
      .from('collaborations')
      .select(`
        *,
        requester_company:companies!collaborations_requester_company_id_fkey(id, name, slug),
        target_company:companies!collaborations_target_company_id_fkey(id, name, slug)
      `)
      .or(`requester_company_id.eq.${companyId},target_company_id.eq.${companyId}`)
      .order('created_at', { ascending: false });
    
    if (err) throw new Error(err.message);
    
    // Transform to frontend expected format (companyA, companyAName, companyB, companyBName)
    const transformed = (data || []).map(c => ({
      ...c,
      companyA: c.requester_company_id,
      companyAName: c.requester_company?.name || '',
      companyB: c.target_company_id,
      companyBName: c.target_company?.name || '',
      // Also include from/to for any code that uses that format
      from_company_id: c.requester_company_id,
      to_company_id: c.target_company_id
    }));
    return transformed;
  },

  async createCollaborationRequest({ fromCompanyId, toCompanyId, userId }) {
    const db = getSupabase();
    
    // Get company names for the response
    const { data: fromCompany } = await db.from('companies').select('name').eq('id', fromCompanyId).single();
    const { data: toCompany } = await db.from('companies').select('name').eq('id', toCompanyId).single();
    
    const { data, error: err } = await db
      .from('collaborations')
      .insert([{
        requester_company_id: fromCompanyId,
        target_company_id: toCompanyId,
        status: 'pending'
      }])
      .select()
      .single();
    
    if (err) throw new Error(err.message);
    // Return with frontend expected field names
    return {
      ...data,
      companyA: fromCompanyId,
      companyAName: fromCompany?.name || '',
      companyB: toCompanyId,
      companyBName: toCompany?.name || '',
      from_company_id: fromCompanyId,
      to_company_id: toCompanyId
    };
  },

  async acceptCollaboration({ collabId, companyId, userId }) {
    const db = getSupabase();
    const { data, error: err } = await db
      .from('collaborations')
      .update({ status: 'active', responded_at: new Date().toISOString() })
      .eq('id', collabId)
      .select()
      .single();
    
    if (err) throw new Error(err.message);
    return data;
  },

  async declineCollaboration({ collabId, companyId, userId }) {
    const db = getSupabase();
    const { data, error: err } = await db
      .from('collaborations')
      .update({ status: 'declined', responded_at: new Date().toISOString() })
      .eq('id', collabId)
      .select()
      .single();
    
    if (err) throw new Error(err.message);
    return data;
  },

  async cancelCollaboration({ collabId, companyId, userId }) {
    const db = getSupabase();
    const { error: err } = await db
      .from('collaborations')
      .delete()
      .eq('id', collabId);
    
    if (err) throw new Error(err.message);
    return { success: true };
  },

  // ─── COMPANY CONTENT ─────────────────────────────────────────────────────

  async getCompanyContent() {
    const db = getSupabase();
    const { data, error: err } = await db
      .from('company_content')
      .select(`
        *,
        company:companies(id, name, slug)
      `)
      .order('created_at', { ascending: false });
    
    if (err) throw new Error(err.message);
    return (data || []).map(toFrontendFormat);
  },

  async createCompanyContentItem({ companyId, data: contentData, userId }) {
    const db = getSupabase();
    const dbData = toDbFormat(contentData);
    
    const { data, error: err } = await db
      .from('company_content')
      .insert([{
        company_id: companyId,
        ...dbData,
        created_by: userId
      }])
      .select()
      .single();
    
    if (err) throw new Error(err.message);
    return toFrontendFormat(data);
  },

  async updateContentItem({ itemId, updates, userId }) {
    const db = getSupabase();
    const dbUpdates = toDbFormat(updates);
    
    const { data, error: err } = await db
      .from('company_content')
      .update({ ...dbUpdates, updated_at: new Date().toISOString() })
      .eq('id', itemId)
      .select()
      .single();
    
    if (err) throw new Error(err.message);
    return toFrontendFormat(data);
  },

  async deleteContentItem({ contentId, userId }) {
    const db = getSupabase();
    const { error: err } = await db
      .from('company_content')
      .delete()
      .eq('id', contentId);
    
    if (err) throw new Error(err.message);
    return { success: true };
  },

  async toggleContentShared({ contentId, userId }) {
    const db = getSupabase();
    
    // Use metadata.shared since schema doesn't have dedicated shared column
    const { data: content } = await db.from('company_content').select('metadata').eq('id', contentId).single();
    const currentMetadata = content?.metadata || {};
    const newShared = !currentMetadata.shared;
    
    const { data, error: err } = await db
      .from('company_content')
      .update({ metadata: { ...currentMetadata, shared: newShared } })
      .eq('id', contentId)
      .select()
      .single();
    
    if (err) throw new Error(err.message);
    return { ...data, shared: newShared };
  },

  async getSharedContentFromCollaborators({ companyId }) {
    const db = getSupabase();
    
    // Get active collaborations for this company
    const { data: collabs } = await db
      .from('collaborations')
      .select('requester_company_id, target_company_id')
      .or(`requester_company_id.eq.${companyId},target_company_id.eq.${companyId}`)
      .eq('status', 'active');
    
    if (!collabs || collabs.length === 0) return [];
    
    // Get partner company IDs
    const partnerIds = collabs.map(c => 
      c.requester_company_id === companyId ? c.target_company_id : c.requester_company_id
    );
    
    // Get content from partners where metadata.shared = true
    const { data, error: err } = await db
      .from('company_content')
      .select('*, company:companies(id, name, slug)')
      .in('company_id', partnerIds)
      .eq('status', 'active')
      .eq('metadata->>shared', 'true');
    
    if (err) throw new Error(err.message);
    // Add shared property for frontend compatibility
    return (data || []).map(item => ({ ...item, shared: true }));
  },

  async reviewModerationRequest({ requestId, reviewerId, status, comment }) {
    const db = getSupabase();
    
    // Get the request first to know who to notify
    const { data: request } = await db
      .from('moderation_requests')
      .select('*, requester:users!moderation_requests_requester_id_fkey(id, email, nickname)')
      .eq('id', requestId)
      .single();
    
    const { data, error: err } = await db
      .from('moderation_requests')
      .update({
        status,
        moderator_id: reviewerId,
        reason: comment,
        resolved_at: new Date().toISOString()
      })
      .eq('id', requestId)
      .select()
      .single();
    
    if (err) throw new Error(err.message);
    
    // Send notification to the requester
    if (request && request.requester_id) {
      const isApproved = status === 'approved';
      const contentType = request.type?.replace('create_', '') || 'content';
      const contentName = request.data?.name || request.data?.title || 'your submission';
      
      await db.from('notifications').insert([{
        user_id: request.requester_id,
        type: isApproved ? 'moderation_approved' : 'moderation_rejected',
        title: isApproved ? 'Submission Approved' : 'Submission Rejected',
        message: isApproved 
          ? `Your ${contentType} "${contentName}" has been approved.`
          : `Your ${contentType} "${contentName}" was not approved. ${comment ? `Reason: ${comment}` : ''}`,
        data: { requestId, contentType, contentName, status },
        read: false,
        created_at: new Date().toISOString()
      }]);
    }
    
    return toFrontendFormat(data);
  },

  // ─── MODERATION REQUESTS ─────────────────────────────────────────────────

  async getModerationRequests() {
    const db = getSupabase();
    const { data, error: err } = await db
      .from('moderation_requests')
      .select(`
        *,
        requester:users!moderation_requests_requester_id_fkey(id, email, nickname),
        moderator:users!moderation_requests_moderator_id_fkey(id, email, nickname)
      `)
      .order('created_at', { ascending: false });

    if (err) throw new Error(err.message);
    return (data || []).map(toFrontendFormat);
  },

  async createModerationRequest(requestData) {
    const db = getSupabase();
    
    // Convert to database format
    const dbData = toDbFormat(requestData);
    
    const { data, error: err } = await db
      .from('moderation_requests')
      .insert([dbData])
      .select()
      .single();

    if (err) throw new Error(err.message);
    
    // Notify all mods and admins about new pending request
    try {
      const { data: staffUsers } = await db
        .from('users')
        .select('id')
        .in('role', ['mod', 'admin']);
      
      if (staffUsers && staffUsers.length > 0) {
        const contentType = requestData.type?.replace('create_', '') || 'content';
        const contentName = requestData.data?.name || requestData.data?.title || 'New submission';
        
        const notifications = staffUsers.map(user => ({
          user_id: user.id,
          type: 'moderation_pending',
          title: 'New Moderation Request',
          message: `A new ${contentType} "${contentName}" is pending review.`,
          data: { requestId: data.id, contentType, contentName },
          read: false,
          created_at: new Date().toISOString()
        }));
        
        await db.from('notifications').insert(notifications);
      }
    } catch (notifErr) {
      console.warn('[createModerationRequest] Failed to send notifications:', notifErr);
    }
    
    return toFrontendFormat(data);
  },

  async updateModerationRequest({ requestId, updates }) {
    const db = getSupabase();
    const dbUpdates = toDbFormat(updates);
    
    const { data, error: err } = await db
      .from('moderation_requests')
      .update(dbUpdates)
      .eq('id', requestId)
      .select()
      .single();

    if (err) throw new Error(err.message);
    return toFrontendFormat(data);
  },

  // ─── NICKNAME REQUESTS ───────────────────────────────────────────────────

  async getNicknameRequests() {
    const db = getSupabase();
    const { data, error: err } = await db
      .from('nickname_requests')
      .select(`
        *,
        user:users!nickname_requests_user_id_fkey(id, email, nickname),
        moderator:users!nickname_requests_moderator_id_fkey(id, email, nickname)
      `)
      .order('created_at', { ascending: false });

    if (err) throw new Error(err.message);
    return (data || []).map(toFrontendFormat);
  },

  async createNicknameRequest(requestData) {
    const db = getSupabase();
    
    // Convert to database format
    const dbData = toDbFormat(requestData);
    
    const { data, error: err } = await db
      .from('nickname_requests')
      .insert([dbData])
      .select()
      .single();

    if (err) throw new Error(err.message);
    return toFrontendFormat(data);
  },

  async updateNicknameRequest({ requestId, updates }) {
    const db = getSupabase();
    const dbUpdates = toDbFormat(updates);
    
    const { data, error: err } = await db
      .from('nickname_requests')
      .update(dbUpdates)
      .eq('id', requestId)
      .select()
      .single();

    if (err) throw new Error(err.message);
    return toFrontendFormat(data);
  },

  // ─── IMAGE UPLOAD ────────────────────────────────────────────────────────

  async uploadImage({ imageData, bucket = 'images', folder = 'uploads', filename }) {
    const db = getSupabase();
    
    // imageData should be base64 data URL like "data:image/png;base64,..."
    if (!imageData || typeof imageData !== 'string') {
      throw new Error('Invalid image data');
    }

    // Parse base64 data URL
    const matches = imageData.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) {
      throw new Error('Invalid base64 image format');
    }

    const contentType = matches[1];
    const base64Data = matches[2];
    
    // Validate content type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(contentType)) {
      throw new Error('Invalid image type. Allowed: JPEG, PNG, GIF, WEBP');
    }

    // Convert base64 to buffer
    const buffer = Buffer.from(base64Data, 'base64');

    // Check file size (max 2MB)
    if (buffer.length > 2 * 1024 * 1024) {
      throw new Error('Image too large. Maximum size is 2MB');
    }

    // Generate filename if not provided
    const ext = contentType.split('/')[1];
    const finalFilename = filename || `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${ext}`;
    const filePath = `${folder}/${finalFilename}`;

    // Upload to Supabase Storage
    const { data, error: uploadErr } = await db.storage
      .from(bucket)
      .upload(filePath, buffer, {
        contentType,
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadErr) {
      console.error('[uploadImage] Upload error:', uploadErr);
      throw new Error(uploadErr.message);
    }

    // Get public URL
    const { data: urlData } = db.storage
      .from(bucket)
      .getPublicUrl(filePath);

    return {
      path: data.path,
      url: urlData.publicUrl,
      filename: finalFilename,
    };
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════════════════════

// Actions that can be cached (public data)
const CACHEABLE_ACTIONS = [
  'getUsers',
  'getProjects',
  'getPosts',
  'getCompanies',
  'getPublicProjects',
  'getPublicPosts',
  'getPublicCompanies',
];

// Actions that are private (user-specific)
const PRIVATE_ACTIONS = [
  'getNotificationsForUser',
  'getInvitationsForUser',
  'getCollaborationsForUser',
];

// Actions that require authentication (write operations)
const AUTH_REQUIRED_ACTIONS = [
  // User operations
  'updateUser',
  'deleteUser',
  'updateMcNickname',
  // Project operations  
  'createProject',
  'updateProject',
  'deleteProject',
  'addProjectMember',
  'removeProjectMember',
  'updateProjectMember',
  // Company operations
  'createCompany',
  'updateCompany',
  'deleteCompany',
  'addCompanyMember',
  'removeCompanyMember',
  'updateCompanyMember',
  // Post operations
  'createPost',
  'updatePost',
  'deletePost',
  // Notifications
  'markNotificationRead',
  'markAllNotificationsRead',
  'deleteNotification',
  // Invitations
  'createInvitation',
  'respondToInvitation',
  'cancelInvitation',
  // Collaborations
  'createCollaboration',
  'updateCollaboration',
  'deleteCollaboration',
  // Nickname requests
  'createNicknameRequest',
  'respondToNicknameRequest',
  // File uploads
  'uploadImage',
];

// Actions that require mod+ role
const MOD_REQUIRED_ACTIONS = [
  'updateUserRole',
  'deleteUser',
];

exports.handler = async (event, context) => {
  const origin = event.headers.origin || event.headers.Origin || '';
  const corsHeaders = applyCors(origin);

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return error('Method not allowed', 405);
  }

  try {
    const { action, data } = JSON.parse(event.body || '{}');

    if (!action) {
      return error('Missing action parameter', 400, origin);
    }

    const handler = handlers[action];
    if (!handler) {
      return error(`Unknown action: ${action}`, 400, origin);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SESSION VERIFICATION FOR PROTECTED ACTIONS
    // ═══════════════════════════════════════════════════════════════════════
    
    let sessionUser = null;
    
    if (AUTH_REQUIRED_ACTIONS.includes(action)) {
      const requiredRole = MOD_REQUIRED_ACTIONS.includes(action) ? 'mod' : null;
      const session = await verifySession(event, requiredRole);
      
      if (!session.authenticated) {
        console.log(`[supabase-proxy] ${action}: Unauthorized -`, session.error);
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ error: session.error || 'Unauthorized' }),
        };
      }
      
      if (session.error === 'Insufficient permissions') {
        console.log(`[supabase-proxy] ${action}: Forbidden - mod+ required`);
        return {
          statusCode: 403,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Insufficient permissions' }),
        };
      }
      
      sessionUser = session.user;
      console.log(`[supabase-proxy] ${action}: Authorized for user ${sessionUser.id}`);
    }

    console.log(`[supabase-proxy] Processing ${action}...`);
    const result = await handler(data, sessionUser);
    
    // Determine caching strategy
    const isCacheable = CACHEABLE_ACTIONS.includes(action);
    const isPrivate = PRIVATE_ACTIONS.includes(action);
    
    if (isCacheable) {
      // Generate ETag for cacheable responses
      const etag = generateETag(result);
      
      // Check If-None-Match header
      const clientETag = event.headers['if-none-match'] || event.headers['If-None-Match'];
      
      if (isNotModified(clientETag, etag)) {
        console.log(`[supabase-proxy] ${action}: 304 Not Modified`);
        return notModified(etag, origin);
      }
      
      // Find latest updated_at for Last-Modified
      let lastModified = null;
      if (Array.isArray(result)) {
        const dates = result
          .map(item => item.updatedAt || item.updated_at || item.createdAt || item.created_at)
          .filter(Boolean)
          .map(d => new Date(d).getTime());
        if (dates.length > 0) {
          lastModified = new Date(Math.max(...dates)).toUTCString();
        }
      }
      
      return success(result, { 
        etag, 
        lastModified,
        public: true 
      }, origin);
    } else if (isPrivate) {
      // Private data - no caching
      return success(result, { private: true }, origin);
    }
    
    // Default: no special caching headers
    return success(result, {}, origin);

  } catch (err) {
    console.error('[supabase-proxy] Error:', err.message);
    return error(err.message, 500, origin);
  }
};
