/* ═══════════════════════════════════════════════════════════════════════════
   Netlify Function: Google OAuth Token Exchange
   
   This serverless function handles the secure token exchange for Google OAuth.
   While Google supports implicit flow, authorization code flow is more secure
   and recommended for production.
   
   Endpoint: /.netlify/functions/google-oauth
   Method: POST
   Body: { code: string, redirectUri: string }
   Returns: { email, id, displayName, avatar }
   ═══════════════════════════════════════════════════════════════════════════ */

// Environment variables (set in Netlify dashboard):
// GOOGLE_CLIENT_ID - Your Google Cloud OAuth client ID
// GOOGLE_CLIENT_SECRET - Your Google Cloud OAuth client secret

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
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error('Google OAuth credentials not configured');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Server configuration error' }),
      };
    }

    // ─── Step 1: Exchange code for access token ───
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
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
      console.error('Google token exchange failed:', errorData);
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ 
          error: 'google_token_exchange_failed',
          details: errorData,
          status: tokenResponse.status,
        }),
      };
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'No access token received from Google' }),
      };
    }

    // ─── Step 2: Fetch user info from Google ───
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!userResponse.ok) {
      const errorData = await userResponse.text();
      console.error('Google user fetch failed:', errorData);
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Failed to fetch user info from Google' }),
      };
    }

    const userData = await userResponse.json();

    // ─── Step 3: Normalize and return user data ───
    const userInfo = {
      email: userData.email,
      id: userData.id,
      username: userData.email,
      displayName: userData.name,
      avatar: userData.picture,
    };

    console.log('Google OAuth successful for:', userData.email);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(userInfo),
    };

  } catch (error) {
    console.error('Google OAuth error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'google_oauth_internal_error',
        details: error.message,
        stack: error.stack,
      }),
    };
  }
};
