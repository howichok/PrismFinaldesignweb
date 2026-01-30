/* ═══════════════════════════════════════════════════════════════════════════
   SAFE MODE: Session API
   
   GET /.netlify/functions/session
   
   Читает prism_session cookie, проверяет в Supabase, возвращает user.
   С таймаутом 5 секунд - если Supabase не ответил, возвращаем 500.
   ═══════════════════════════════════════════════════════════════════════════ */

const { createClient } = require('@supabase/supabase-js');

const SESSION_COOKIE = 'prism_session';
const SUPABASE_TIMEOUT = 5000; // 5 seconds

// Supabase client (lazy init)
let supabase = null;

function getSupabase() {
  if (!supabase) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return null;
    supabase = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
  }
  return supabase;
}

function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(';').forEach(c => {
    const [name, ...rest] = c.trim().split('=');
    if (name) cookies[name] = rest.join('=');
  });
  return cookies;
}

function isProduction() {
  const url = process.env.URL || '';
  return url.includes('prismmtr.org') || url.includes('netlify.app');
}

function clearCookie() {
  const parts = [`${SESSION_COOKIE}=`, 'Path=/', 'Max-Age=0', 'HttpOnly', 'SameSite=Lax'];
  if (isProduction()) parts.push('Secure');
  return parts.join('; ');
}

// CORS headers
function getCorsHeaders(origin) {
  if (!origin) return {}; // Same-origin usually doesn't send origin header or we don't need CORS
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
}

exports.handler = async (event) => {
  const origin = event.headers.origin || event.headers.Origin || '';
  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    ...getCorsHeaders(origin)
  };

  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // 1. Проверяем cookie
  const cookies = parseCookies(event.headers.cookie);
  const token = cookies[SESSION_COOKIE];

  if (!token) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ authenticated: false, user: null })
    };
  }

  // 2. Проверяем Supabase конфиг
  const db = getSupabase();
  if (!db) {
    console.error('[session] Supabase not configured');
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Database not configured' })
    };
  }

  // 3. Ищем сессию с таймаутом
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SUPABASE_TIMEOUT);

    const { data: session, error: sessionErr } = await db
      .from('sessions')
      .select('user_id, user_version, expires_at')
      .eq('token', token)
      .single()
      .abortSignal(controller.signal);

    clearTimeout(timeout);

    if (sessionErr || !session) {
      console.log('[session] Session not found');
      return {
        statusCode: 401,
        headers: { ...headers, 'Set-Cookie': clearCookie() },
        body: JSON.stringify({ authenticated: false, user: null })
      };
    }

    // 4. Проверяем expires_at
    if (new Date(session.expires_at) < new Date()) {
      console.log('[session] Session expired');
      // Удаляем просроченную сессию
      await db.from('sessions').delete().eq('token', token);
      return {
        statusCode: 401,
        headers: { ...headers, 'Set-Cookie': clearCookie() },
        body: JSON.stringify({ authenticated: false, user: null })
      };
    }

    // 5. Получаем user
    const controller2 = new AbortController();
    const timeout2 = setTimeout(() => controller2.abort(), SUPABASE_TIMEOUT);

    const { data: user, error: userErr } = await db
      .from('users')
      .select('id, email, nickname, mc_nickname, role, avatar_url, version')
      .eq('id', session.user_id)
      .single()
      .abortSignal(controller2.signal);

    clearTimeout(timeout2);

    if (userErr || !user) {
      console.log('[session] User not found');
      return {
        statusCode: 401,
        headers: { ...headers, 'Set-Cookie': clearCookie() },
        body: JSON.stringify({ authenticated: false, user: null })
      };
    }

    // 6. Проверяем version match
    if (user.version !== session.user_version) {
      console.log('[session] Version mismatch, invalidating session');
      await db.from('sessions').delete().eq('token', token);
      return {
        statusCode: 401,
        headers: { ...headers, 'Set-Cookie': clearCookie() },
        body: JSON.stringify({ authenticated: false, user: null })
      };
    }

    // 7. Успех - возвращаем user
    console.log('[session] Valid session for user:', user.id);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        authenticated: true,
        user: {
          id: user.id,
          email: user.email,
          nickname: user.nickname,
          mcNickname: user.mc_nickname,
          role: user.role,
          avatar: user.avatar_url,
          version: user.version
        }
      })
    };

  } catch (err) {
    if (err.name === 'AbortError') {
      console.error('[session] Supabase timeout');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Database timeout' })
      };
    }
    console.error('[session] Error:', err.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal error' })
    };
  }
};
