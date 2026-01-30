/* ═══════════════════════════════════════════════════════════════════════════
   SAFE MODE: Discord OAuth Initiator
   
   ТОЛЬКО 302 redirect на Discord. Никаких Supabase, никаких verify-session.
   Должен отвечать <50ms.
   ═══════════════════════════════════════════════════════════════════════════ */

const crypto = require('crypto');

exports.handler = async (event) => {
  // Быстрая проверка метода
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  // ENV VARS
  const clientId = process.env.DISCORD_CLIENT_ID;
  const stateSecret = process.env.SESSION_SECRET || process.env.DISCORD_CLIENT_SECRET;
  const redirectUri = process.env.DISCORD_REDIRECT_URI || 'https://prismmtr.org/.netlify/functions/auth-discord-callback';

  // Проверка конфига - мгновенный 500 если нет
  if (!clientId || !stateSecret) {
    console.error('[auth-discord] Missing DISCORD_CLIENT_ID or SESSION_SECRET');
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'OAuth not configured' })
    };
  }

  // Получаем next URL (используем let для валидации)
  let next = event.queryStringParameters?.next || '/dashboard.html';
  // Strict validation: must start with / and NOT contain // or \ or protocol
  if (!next.startsWith('/') || next.startsWith('//') || next.includes('\\')) {
    next = '/dashboard.html';
  }
  
  // Создаём подписанный state
  const nonce = crypto.randomBytes(16).toString('hex');
  const timestamp = Date.now();
  const payload = JSON.stringify({ n: nonce, x: next, t: timestamp });
  const payloadBase64 = Buffer.from(payload).toString('base64url');
  const signature = crypto.createHmac('sha256', stateSecret).update(payloadBase64).digest('base64url');
  const state = `${payloadBase64}.${signature}`;

  // Строим Discord URL
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'identify email',
    state: state,
  });

  const discordUrl = `https://discord.com/api/oauth2/authorize?${params.toString()}`;

  console.log('[auth-discord] Redirecting to Discord, next:', next);

  // 302 Redirect
  return {
    statusCode: 302,
    headers: {
      'Location': discordUrl,
      'Cache-Control': 'no-store'
    },
    body: ''
  };
};
