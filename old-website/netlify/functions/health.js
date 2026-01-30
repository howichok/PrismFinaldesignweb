/**
 * Health Check Function
 * 
 * Simple endpoint to verify Netlify Functions are deployed and running.
 * Access: /.netlify/functions/health
 */

exports.handler = async (event, context) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  // Check which ENV vars are configured (without exposing values)
  const envCheck = {
    JSONBIN_API_KEY: !!process.env.JSONBIN_API_KEY,
    USERS_BIN_ID: !!process.env.USERS_BIN_ID,
    PROJECTS_BIN_ID: !!process.env.PROJECTS_BIN_ID,
    NICKNAME_REQUESTS_BIN_ID: !!process.env.NICKNAME_REQUESTS_BIN_ID,
    NOTIFICATIONS_BIN_ID: !!process.env.NOTIFICATIONS_BIN_ID,
    DISCORD_CLIENT_ID: !!process.env.DISCORD_CLIENT_ID,
    DISCORD_CLIENT_SECRET: !!process.env.DISCORD_CLIENT_SECRET,
    GOOGLE_CLIENT_ID: !!process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: !!process.env.GOOGLE_CLIENT_SECRET,
  };

  const allConfigured = Object.values(envCheck).every(v => v);
  const missingVars = Object.entries(envCheck)
    .filter(([k, v]) => !v)
    .map(([k]) => k);

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      status: 'ok',
      message: 'Netlify Functions are running',
      timestamp: new Date().toISOString(),
      environment: {
        configured: allConfigured,
        missing: missingVars,
        check: envCheck,
      },
      functions: [
        'health',
        'discord-oauth',
        'google-oauth',
        'jsonbin-proxy',
        'admin-api',
      ],
    }, null, 2),
  };
};
