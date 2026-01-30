# PrismMTR: JSONBin to Supabase Migration Guide

## Overview

This guide covers migrating from JSONBin to Supabase as the data backend for PrismMTR.

## Prerequisites

1. A Supabase account and project
2. Node.js 18+ installed
3. Netlify CLI installed (`npm i -g netlify-cli`)

## Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note your project URL and keys from Settings > API:
   - `SUPABASE_URL`: Your project URL (e.g., `https://xxxxx.supabase.co`)
   - `SUPABASE_ANON_KEY`: Public anon key (for client-side, read-only operations)
   - `SUPABASE_SERVICE_KEY`: Service role key (for server-side operations)

## Step 2: Create Database Schema

1. Go to SQL Editor in Supabase Dashboard
2. Copy the contents of `supabase/schema.sql`
3. Run the SQL to create all tables, indexes, and policies

## Step 3: Configure Netlify Environment Variables

Add these environment variables to your Netlify project:

```bash
# In Netlify Dashboard > Site settings > Environment variables
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key

# Keep JSONBin variables during migration (can remove after migration)
JSONBIN_API_KEY=your-jsonbin-key
USERS_BIN_ID=xxx
PROJECTS_BIN_ID=xxx
# ... other bin IDs
```

Or use Netlify CLI:
```bash
netlify env:set SUPABASE_URL "https://your-project.supabase.co"
netlify env:set SUPABASE_SERVICE_KEY "your-service-role-key"
```

## Step 4: Install Dependencies

```bash
npm install
```

This installs `@supabase/supabase-js` for the Netlify Functions.

## Step 5: Data Migration

### Option A: Manual Migration (Recommended for small datasets)

1. Export data from JSONBin using the existing API
2. Transform data to match Supabase schema
3. Import using Supabase Dashboard or SQL

### Option B: Migration Script

Create a Node.js script to migrate data:

```javascript
// scripts/migrate-to-supabase.js
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function migrateUsers(jsonbinUsers) {
  for (const user of jsonbinUsers) {
    const { error } = await supabase.from('users').upsert({
      id: user.id, // If using same IDs, or generate new UUIDs
      email: user.email,
      nickname: user.nickname,
      mc_nickname: user.mcNickname,
      role: user.role || 'user',
      avatar_url: user.avatarUrl,
      connections: user.connections || {},
      permission_overrides: user.permissionOverrides,
      created_at: user.createdAt || new Date().toISOString(),
    });
    if (error) console.error('User migration error:', error);
  }
}

// Similar functions for projects, posts, companies, etc.
```

## Step 6: Switch to Supabase Backend

### Option A: Full Switch

Replace JSONBin module with Supabase module in HTML files:

```html
<!-- Before -->
<script src="js/jsonbin.js"></script>

<!-- After -->
<script src="js/supabase.js"></script>
```

And update code that references `PrismBin` to use `PrismData`:

```javascript
// Before
const users = await PrismBin.getUsers();

// After
const users = await PrismData.getUsers();
```

### Option B: Gradual Migration (Feature Flags)

Create a data layer that can switch between backends:

```javascript
// js/data.js
const DataBackend = (function() {
  const USE_SUPABASE = localStorage.getItem('use_supabase') === 'true';

  return USE_SUPABASE ? PrismData : PrismBin;
})();
```

## Step 7: Verify Migration

1. Test all CRUD operations:
   - Users: Create, read, update
   - Projects: Create, read, update, delete
   - Posts: Create, read, update, delete
   - Companies: Create, read, update, delete
   - Notifications: Create, read, mark as read
   - Invitations: Create, update status
   - Moderation requests: Create, approve/reject

2. Verify data integrity:
   - All users migrated with correct roles
   - All projects/posts have correct ownership
   - Company memberships are intact

## Step 8: Remove JSONBin (After Successful Migration)

1. Remove JSONBin environment variables from Netlify
2. Remove `js/jsonbin.js` from the project
3. Remove JSONBin proxy function if not needed

## Schema Differences

| JSONBin Field | Supabase Column | Notes |
|---------------|-----------------|-------|
| `mcNickname` | `mc_nickname` | Snake case |
| `avatarUrl` | `avatar_url` | Snake case |
| `createdAt` | `created_at` | Snake case, TIMESTAMPTZ |
| `updatedAt` | `updated_at` | Auto-updated via trigger |
| `permissionOverrides` | `permission_overrides` | JSONB column |

## Supabase Benefits

1. **Real-time subscriptions**: Get live updates without polling
2. **Row Level Security**: Fine-grained access control
3. **Full SQL**: Complex queries and joins
4. **Scalability**: Handles growth better than JSONBin
5. **Backups**: Automatic daily backups
6. **Dashboard**: Visual data management

## Troubleshooting

### "Supabase configuration missing" error
- Verify `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` are set in Netlify

### Foreign key constraint errors
- Ensure referenced records exist before inserting
- Migrate in order: users → companies → projects → posts

### RLS policy errors
- Service role bypasses RLS, but anon key respects policies
- Check policies if public queries fail

## Support

For issues with migration, check:
1. Supabase Dashboard > Logs
2. Netlify Functions logs
3. Browser console for client-side errors
