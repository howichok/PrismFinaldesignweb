/* ═══════════════════════════════════════════════════════════════════════════
   SAFE MODE: Discord OAuth Callback
   
   GET /.netlify/functions/auth-discord-callback?code=xxx&state=xxx
   
   1. Verify state (HMAC)
   2. Exchange code for token (Discord API)
   3. Fetch Discord user
   4. Find/create local user (Supabase)
   5. Create session (Supabase)
   6. Set cookie + redirect
   
   Все внешние запросы с таймаутом 8 секунд.
   ═══════════════════════════════════════════════════════════════════════════ */

const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

// Config
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const STATE_SECRET = process.env.SESSION_SECRET || DISCORD_CLIENT_SECRET;
const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || 'https://prismmtr.org/.netlify/functions/auth-discord-callback';
const SITE_URL = process.env.URL || 'https://prismmtr.org';
const STATE_TTL = 10 * 60 * 1000; // 10 min
const SESSION_HOURS = 24;
const REQUEST_TIMEOUT = 8000; // 8 seconds
const SESSION_COOKIE = 'prism_session';

// Supabase
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

// Error redirect
function errorRedirect(message) {
  return {
    statusCode: 302,
    headers: {
      'Location': `${SITE_URL}/index.html?reason=auth&error=${encodeURIComponent(message)}`,
      'Cache-Control': 'no-store'
    },
    body: ''
  };
}

// Verify HMAC state
function verifyState(state, secret) {
  if (!state || !state.includes('.')) return null;
  
  const [payloadB64, sig] = state.split('.');
  if (!payloadB64 || !sig) return null;

  const expected = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
  
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);

  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }
  
  try {
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
    if (Date.now() - payload.t > STATE_TTL) return null;
  
    let next = payload.x || '/dashboard.html';
    // Strict validation
    if (!next.startsWith('/') || next.startsWith('//') || next.includes('\\') || next.includes('://')) {
      next = '/dashboard.html';
    }
    return next;
  } catch (e) { return null; }
}

// Fetch with timeout
async function fetchWithTimeout(url, options, timeout = REQUEST_TIMEOUT) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

exports.handler = async (event) => {
  console.log('[callback] Start');
  
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const { code, state, error } = event.queryStringParameters || {};
  
  if (error) {
    console.log('[callback] OAuth error:', error);
    return errorRedirect(error);
  }
  
  if (!code || !state) {
    return errorRedirect('Missing parameters');
  }

  // Config check
  if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET) {
    console.error('[callback] Missing Discord credentials');
    return errorRedirect('Server error');
  }

  const db = getSupabase();
  if (!db) {
    console.error('[callback] Supabase not configured');
    return errorRedirect('Server error');
  }

  try {
    // 1. Verify state
    const nextUrl = verifyState(state, STATE_SECRET);
    if (!nextUrl) return errorRedirect('Invalid state');

    // 2. Exchange code for token
    console.log('[callback] Exchanging code...');
    const tokenRes = await fetchWithTimeout('https://discord.com/api/v10/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: REDIRECT_URI
      }).toString()
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error('[callback] Token exchange failed:', tokenRes.status, errText);
      return errorRedirect('Please sign in again');
    }

    const tokenData = await tokenRes.json();
    console.log('[callback] Token OK');

    // 3. Fetch Discord user
    console.log('[callback] Fetching Discord user...');
    const userRes = await fetchWithTimeout('https://discord.com/api/v10/users/@me', {
      headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
    });

    if (!userRes.ok) {
      console.error('[callback] Discord user fetch failed');
      return errorRedirect('Failed to get Discord profile');
    }

    const discordUser = await userRes.json();
    console.log('[callback] Discord user:', discordUser.username);

    // 4. Find or create local user
    const discordId = discordUser.id;
    const email = discordUser.email;
    const avatar = discordUser.avatar 
      ? `https://cdn.discordapp.com/avatars/${discordId}/${discordUser.avatar}.png`
      : null;

    // Search by discord ID or email
    let searchFilter = `connections->discord->>id.eq.${discordId}`;
    if (email) searchFilter += `,email.eq.${email}`;

    const { data: existingUsers } = await db
      .from('users')
      .select('*')
      .or(searchFilter);

    let user = existingUsers?.[0];

    if (user) {
      // Update existing user
      const connections = user.connections || {};
      connections.discord = { connected: true, id: discordId, username: discordUser.username };
      
      const { data: updated } = await db
        .from('users')
        .update({
          connections,
          avatar_url: avatar || user.avatar_url,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)
        .select()
        .single();
      
      if (updated) user = updated;
      console.log('[callback] Updated user:', user.id);
    } else {
      // Create new user (first user is admin)
      const { count } = await db.from('users').select('*', { count: 'exact', head: true });
      const role = count === 0 ? 'admin' : 'user';

      const { data: newUser, error: createErr } = await db
        .from('users')
        .insert({
          email: email,
          nickname: discordUser.global_name || discordUser.username,
          role: role,
          avatar_url: avatar,
          connections: { discord: { connected: true, id: discordId, username: discordUser.username } },
          version: 1
        })
        .select()
        .single();

      if (createErr) {
        console.error('[callback] User create error:', createErr);
        return errorRedirect('Failed to create account');
      }
      
      user = newUser;
      console.log('[callback] Created user:', user.id, 'role:', role);
    }

    // 5. Create session
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000);

    const { error: sessErr } = await db
      .from('sessions')
      .insert({
        token: sessionToken,
        user_id: user.id,
        user_version: user.version || 1,
        expires_at: expiresAt.toISOString()
      });

    if (sessErr) {
      console.error('[callback] Session create error:', sessErr);
      return errorRedirect('Failed to create session');
    }

    console.log('[callback] Session created');

    // 6. Build cookie
    const isSecure = event.headers['x-forwarded-proto'] === 'https' || SITE_URL.startsWith('https');
    const cookieParts = [
      `${SESSION_COOKIE}=${sessionToken}`,
      'Path=/',
      `Max-Age=${SESSION_HOURS * 60 * 60}`,
      'HttpOnly',
      'SameSite=Lax'
    ];
    if (isSecure) cookieParts.push('Secure');

    // 7. Redirect to next URL
    const redirectUrl = `${SITE_URL}${nextUrl}`;
    console.log('[callback] Success! Redirecting to:', redirectUrl);

    return {
      statusCode: 302,
      headers: {
        'Location': redirectUrl,
        'Set-Cookie': cookieParts.join('; '),
        'Cache-Control': 'no-store'
      },
      body: ''
    };

  } catch (err) {
    if (err.name === 'AbortError') {
      console.error('[callback] Request timeout');
      return errorRedirect('Request timeout');
    }
    console.error('[callback] Error:', err.message);
    return errorRedirect(err.message);
  }
};
