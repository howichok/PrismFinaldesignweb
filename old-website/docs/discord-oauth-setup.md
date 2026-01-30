# Discord OAuth Setup for PrismMTR

## OAuth Flow (HttpOnly Cookie Sessions)

```
1. User clicks "Sign in with Discord"
   → Browser navigates to /.netlify/functions/auth-discord?next=/dashboard.html

2. auth-discord function:
   → Generates signed state (HMAC with next URL embedded)
   → Redirects to Discord authorize URL

3. Discord shows login/consent screen
   → User authorizes
   → Discord redirects to /.netlify/functions/auth-discord-callback?code=xxx&state=xxx

4. auth-discord-callback function:
   → Validates state signature and TTL
   → Exchanges code for access_token (server-to-server)
   → Fetches Discord user info
   → Finds/creates local user in Supabase
   → Creates session in sessions table
   → Sets HttpOnly cookie: prism_session=<token>
   → Redirects to next URL from state

5. Browser loads next URL (e.g., /dashboard.html)
   → guards.js fetches /.netlify/functions/session
   → Session cookie sent automatically
   → Server validates session, returns user data
   → Page renders with authenticated UI
```

## Discord Developer Portal Setup

### 1. Create Application
- Go to https://discord.com/developers/applications
- Click "New Application"
- Name it "PrismMTR" or similar

### 2. OAuth2 Settings
Navigate to OAuth2 → General

**Redirects (IMPORTANT - add ALL of these):**
```
https://prismmtr.org/.netlify/functions/auth-discord-callback
https://your-site-name.netlify.app/.netlify/functions/auth-discord-callback
```

For local development with `netlify dev`:
```
http://localhost:8888/.netlify/functions/auth-discord-callback
```

### 3. Copy Credentials
- Copy **Client ID** 
- Copy **Client Secret** (click "Reset Secret" if needed)

### 4. Netlify Environment Variables
Set these in Netlify Dashboard → Site settings → Environment variables:

```
DISCORD_CLIENT_ID=your_client_id_here
DISCORD_CLIENT_SECRET=your_client_secret_here
SESSION_SECRET=random_32_char_string_for_signing_state
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key
```

## Supabase Setup

### Run Migration
Execute the migration in Supabase SQL Editor:
```sql
-- From supabase/migrations/005_sessions_table.sql
```

This creates:
- `sessions` table for storing session tokens
- `version` column on `users` table for session invalidation
- Trigger to increment version on user changes

## Testing Locally

1. Install Netlify CLI:
```bash
npm install -g netlify-cli
```

2. Create `.env` file (copy from local-keys.env.example):
```
DISCORD_CLIENT_ID=xxx
DISCORD_CLIENT_SECRET=xxx
SESSION_SECRET=xxx
SUPABASE_URL=xxx
SUPABASE_SERVICE_KEY=xxx
```

3. Run Netlify Dev:
```bash
netlify dev
```

4. Open http://localhost:8888

## Troubleshooting

### "Redirecting to Discord" hangs
- Check redirect_uri matches EXACTLY in Discord Portal
- Ensure SESSION_SECRET is set
- Check browser Network tab for redirect response

### Session not persisting
- Check Set-Cookie header in callback response
- Ensure SameSite=Lax (not Strict) for OAuth redirects
- Check cookie domain matches site

### 401 from /session endpoint
- Session expired or not created
- Check sessions table in Supabase
- Verify SUPABASE_SERVICE_KEY has access

### CORS errors
- credentials: 'include' required for cookie requests
- Access-Control-Allow-Credentials: true required in response
- Access-Control-Allow-Origin must be specific origin (not *)
