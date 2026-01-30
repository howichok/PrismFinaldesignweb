/* ═══════════════════════════════════════════════════════════════════════════
   Netlify Function Utility: Session Verification
   
   Shared helper for verifying session cookies in protected functions.
   
   Usage:
     const { verifySession } = require('./utils/verify-session');
     const session = await verifySession(event);
     if (!session.authenticated) {
       return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
     }
     const user = session.user;
   ═══════════════════════════════════════════════════════════════════════════ */

const { createClient } = require('@supabase/supabase-js');

const SESSION_COOKIE = 'prism_session';

let supabase = null;

function getSupabase() {
  if (!supabase) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error('Supabase configuration missing');
    }
    supabase = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
  }
  return supabase;
}

function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  
  cookieHeader.split(';').forEach(cookie => {
    const [name, ...rest] = cookie.trim().split('=');
    if (name) {
      cookies[name] = rest.join('=');
    }
  });
  
  return cookies;
}

/**
 * Verify session from cookie
 * @param {Object} event - Netlify function event
 * @param {string} requiredRole - Optional minimum role ('mod', 'admin')
 * @returns {Promise<{authenticated: boolean, user: Object|null, error: string|null}>}
 */
async function verifySession(event, requiredRole = null) {
  try {
    const cookies = parseCookies(event.headers.cookie);
    const sessionToken = cookies[SESSION_COOKIE];
    const logBase = { hasCookie: !!sessionToken, tokenLen: sessionToken ? sessionToken.length : 0 };

    if (!sessionToken) {
      console.log('[verifySession] No session cookie', logBase);
      return { authenticated: false, user: null, error: 'No session cookie' };
    }

    const db = getSupabase();

    // Look up session in database
    const { data: session, error: sessionError } = await db
      .from('sessions')
      .select('user_id, user_version, expires_at')
      .eq('token', sessionToken)
      .single();

    if (sessionError || !session) {
      console.log('[verifySession] Session not found', { ...logBase, sessionFound: false, reason: 'not_found' });
      return { authenticated: false, user: null, error: 'Invalid session' };
    }

    // Check if session is expired
    if (new Date(session.expires_at) < new Date()) {
      // Clean up expired session
      await db.from('sessions').delete().eq('token', sessionToken);
      console.log('[verifySession] Session expired', { ...logBase, sessionFound: true, reason: 'expired' });
      return { authenticated: false, user: null, error: 'Session expired' };
    }

    // Get user data
    const { data: user, error: userError } = await db
      .from('users')
      .select('id, email, nickname, mc_nickname, role, avatar_url, version')
      .eq('id', session.user_id)
      .single();

    if (userError || !user) {
      console.log('[verifySession] User not found', { ...logBase, sessionFound: true, reason: 'user_missing' });
      return { authenticated: false, user: null, error: 'User not found' };
    }

    // Check user version matches session
    if (user.version !== session.user_version) {
      console.log('[verifySession] User version mismatch - session invalidated');
      await db.from('sessions').delete().eq('token', sessionToken);
      console.log('[verifySession] Version mismatch', { ...logBase, sessionFound: true, reason: 'version_mismatch' });
      return { authenticated: false, user: null, error: 'Session invalidated' };
    }

    // Check role requirement
    if (requiredRole) {
      const ROLE_HIERARCHY = { user: 1, mod: 2, admin: 3 };
      const userLevel = ROLE_HIERARCHY[user.role] || 0;
      const requiredLevel = ROLE_HIERARCHY[requiredRole] || 0;
      
      if (userLevel < requiredLevel) {
        console.log('[verifySession] Insufficient permissions', { ...logBase, sessionFound: true, reason: 'insufficient_role', role: user.role, requiredRole });
        return { authenticated: true, user, error: 'Insufficient permissions' };
      }
    }

    console.log('[verifySession] Session OK', { ...logBase, sessionFound: true, reason: 'ok', userId: user.id });
    return { authenticated: true, user, error: null };

  } catch (err) {
    console.error('[verifySession] Error:', err.message);
    return { authenticated: false, user: null, error: 'Server error' };
  }
}

module.exports = { verifySession, parseCookies };
