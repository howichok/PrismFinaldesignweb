-- ═══════════════════════════════════════════════════════════════════════════
-- Company Roles Normalization Migration
-- Update company_members.role to support: owner, co_owner, trusted, member
-- Remove trusted_members array from companies table
-- ═══════════════════════════════════════════════════════════════════════════

-- Step 1: Add new role values to company_members
ALTER TABLE company_members 
  DROP CONSTRAINT IF EXISTS company_members_role_check;

ALTER TABLE company_members 
  ADD CONSTRAINT company_members_role_check 
  CHECK (role IN ('member', 'trusted', 'co_owner', 'owner'));

-- Step 2: Migrate existing data
-- Convert 'admin' to 'co_owner' (closest equivalent)
UPDATE company_members 
SET role = 'co_owner' 
WHERE role = 'admin';

-- Step 3: Migrate trusted_members array to company_members table
-- Add members from companies.trusted_members as 'trusted' role
INSERT INTO company_members (company_id, user_id, role, joined_at)
SELECT 
  c.id as company_id,
  unnest(c.trusted_members) as user_id,
  'trusted' as role,
  NOW() as joined_at
FROM companies c
WHERE array_length(c.trusted_members, 1) > 0
ON CONFLICT (company_id, user_id) DO UPDATE
SET role = 'trusted';

-- Step 4: Remove trusted_members column from companies
ALTER TABLE companies DROP COLUMN IF EXISTS trusted_members;

-- Step 5: Add author_company_id to posts and projects for "posting as company"
ALTER TABLE posts 
  ADD COLUMN IF NOT EXISTS author_company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

ALTER TABLE projects 
  ADD COLUMN IF NOT EXISTS author_company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

-- Step 6: Add indexes for author_company_id
CREATE INDEX IF NOT EXISTS idx_posts_author_company ON posts(author_company_id);
CREATE INDEX IF NOT EXISTS idx_projects_author_company ON projects(author_company_id);

-- Step 7: Update RLS policies if needed (keep existing policies, they should still work)
