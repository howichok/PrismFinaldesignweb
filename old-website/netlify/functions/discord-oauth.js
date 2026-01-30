/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   Netlify Function: Discord OAuth Token Exchange
   
   This serverless function handles the secure token exchange for Discord OAuth.
   Discord does NOT support implicit flow, so we must exchange the code for a token
   on the server side to keep the client_secret secure.
   
   Endpoint: /.netlify/functions/discord-oauth
   Method: POST
   Body: { code: string, redirectUri: string }
   Returns: { email, id, username, avatar, displayName }
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

// Environment variables (set in Netlify dashboard):
// DISCORD_CLIENT_ID - Your Discord application client ID
// DISCORD_CLIENT_SECRET - Your Discord application client secret

exports.handler = async (event, context) => {
  // CORS headers
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

  // Only accept POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const { code, redirectUri } = JSON.parse(event.body || '{}');

    if (!code) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing authorization code' }),
      };
    }

    // Get credentials from environment
    const clientId = process.env.DISCORD_CLIENT_ID;
    const clientSecret = process.env.DISCORD_CLIENT_SECRET;

    // Debug: log what we have (mask the secret)
    console.log('Discord OAuth Debug:', {
      hasClientId: !!clientId,
      clientIdLength: clientId?.length,
      clientIdValue: clientId,
      hasClientSecret: !!clientSecret,
      clientSecretLength: clientSecret?.length,
      clientSecretFirst4: clientSecret?.substring(0, 4),
      redirectUri: redirectUri,
    });

    if (!clientId || !clientSecret) {
      console.error('Discord OAuth credentials not configured');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'Server configuration error',
          debug: {
            hasClientId: !!clientId,
            hasClientSecret: !!clientSecret,
          }
        }),
      };
    }

    // --- Step 1: Exchange code for access token ---
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri || 'https://prismmtr.org/',
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('Discord token exchange failed:', {
        status: tokenResponse.status,
        error: errorData,
        redirectUri: redirectUri,
        clientId: clientId,
      });
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ 
          error: 'discord_token_exchange_failed',
          details: errorData,
          status: tokenResponse.status,
          usedRedirectUri: redirectUri,
          hint: 'Make sure this redirect_uri is registered in Discord Developer Portal',
        }),
      };
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'No access token received from Discord' }),
      };
    }

    // â”€â”€â”€ Step 2: Fetch user info from Discord â”€â”€â”€
    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!userResponse.ok) {
      const errorData = await userResponse.text();
      console.error('Discord user fetch failed:', errorData);
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Failed to fetch user info from Discord' }),
      };
    }

    const userData = await userResponse.json();

    // â”€â”€â”€ Step 3: Normalize and return user data â”€â”€â”€
    const avatar = userData.avatar
      ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png`
      : `https://cdn.discordapp.com/embed/avatars/${parseInt(userData.discriminator || '0') % 5}.png`;

    const userInfo = {
      email: userData.email,
      id: userData.id,
      username: userData.username,
      displayName: userData.global_name || userData.username,
      avatar: avatar,
    };

    console.log('Discord OAuth successful for:', userData.username);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(userInfo),
    };

  } catch (error) {
    console.error('Discord OAuth error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'discord_oauth_internal_error',
        details: error.message,
        stack: error.stack,
      }),
    };
  }
};
