/* ═══════════════════════════════════════════════════════════════════════════
   SAFE MODE: Logout API
   
   POST /.netlify/functions/logout
   
   Удаляет сессию из Supabase и очищает cookie.
   С таймаутом 3 секунды - если Supabase не ответил, всё равно очищаем cookie.
   ═══════════════════════════════════════════════════════════════════════════ */

const { createClient } = require('@supabase/supabase-js');

const SESSION_COOKIE = 'prism_session';
const SUPABASE_TIMEOUT = 3000; // 3 seconds

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
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
}

exports.handler = async (event) => {
  const origin = event.headers.origin || event.headers.Origin || '';
  const headers = {
    'Content-Type': 'application/json',
    'Set-Cookie': clearCookie(), // ВСЕГДА очищаем cookie
    ...getCorsHeaders(origin)
  };

  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // Получаем токен для удаления из БД
  const cookies = parseCookies(event.headers.cookie);
  const token = cookies[SESSION_COOKIE];

  // Пытаемся удалить из Supabase (не блокируем если не получится)
  if (token) {
    const db = getSupabase();
    if (db) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), SUPABASE_TIMEOUT);
        
        await db
          .from('sessions')
          .delete()
          .eq('token', token)
          .abortSignal(controller.signal);
        
        clearTimeout(timeout);
        console.log('[logout] Session deleted from DB');
      } catch (err) {
        // Не важно если не удалось - cookie всё равно очищен
        console.log('[logout] DB delete failed (cookie still cleared):', err.message);
      }
    }
  }

  console.log('[logout] Cookie cleared');
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ success: true })
  };
};
