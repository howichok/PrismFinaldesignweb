-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: Project Collaborations (Many-to-Many)
--
-- Allows projects to have multiple participating companies
-- Example: Project X created by Company A in collaboration with Company B, C
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- TABLE: project_companies (junction table)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE project_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Role in the project
  role TEXT NOT NULL DEFAULT 'collaborator' CHECK (role IN (
    'owner',        -- Primary company that owns the project
    'lead',         -- Lead collaborator (co-owner)
    'collaborator', -- Regular collaborator
    'contributor',  -- Minor contributor
    'sponsor'       -- Financial/resource sponsor
  )),

  -- Collaboration details
  contribution TEXT,           -- Description of company's contribution
  credit_order INTEGER DEFAULT 0, -- Display order in credits (lower = first)

  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
    'pending',   -- Invitation sent, awaiting acceptance
    'active',    -- Currently collaborating
    'completed', -- Finished their part
    'declined',  -- Declined invitation
    'removed'    -- Removed from project
  )),

  -- Permissions for this company on the project
  can_edit BOOLEAN DEFAULT FALSE,
  can_publish BOOLEAN DEFAULT FALSE,
  can_invite BOOLEAN DEFAULT FALSE,

  -- Metadata
  invited_by UUID REFERENCES users(id),
  invited_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  UNIQUE(project_id, company_id)
);

-- ═══════════════════════════════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════════════════════════════

CREATE INDEX idx_project_companies_project ON project_companies(project_id);
CREATE INDEX idx_project_companies_company ON project_companies(company_id);
CREATE INDEX idx_project_companies_role ON project_companies(role);
CREATE INDEX idx_project_companies_status ON project_companies(status) WHERE status = 'active';

-- Composite index for common queries
CREATE INDEX idx_project_companies_active ON project_companies(project_id, company_id)
  WHERE status = 'active';

-- ═══════════════════════════════════════════════════════════════════════════
-- TRIGGER: Update updated_at
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_project_companies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_project_companies_updated_at
  BEFORE UPDATE ON project_companies
  FOR EACH ROW
  EXECUTE FUNCTION update_project_companies_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATE EXISTING DATA
-- ═══════════════════════════════════════════════════════════════════════════

-- Move existing company_id from projects to project_companies as 'owner'
INSERT INTO project_companies (project_id, company_id, role, status, can_edit, can_publish, can_invite)
SELECT
  id as project_id,
  company_id,
  'owner' as role,
  'active' as status,
  TRUE as can_edit,
  TRUE as can_publish,
  TRUE as can_invite
FROM projects
WHERE company_id IS NOT NULL
ON CONFLICT (project_id, company_id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- VIEWS FOR EASY QUERYING
-- ═══════════════════════════════════════════════════════════════════════════

-- View: Project with all collaborating companies
CREATE OR REPLACE VIEW v_project_collaborators AS
SELECT
  p.id as project_id,
  p.name as project_name,
  p.slug as project_slug,
  pc.company_id,
  c.name as company_name,
  c.slug as company_slug,
  c.logo_url as company_logo,
  pc.role,
  pc.contribution,
  pc.credit_order,
  pc.status,
  pc.can_edit,
  pc.can_publish
FROM projects p
JOIN project_companies pc ON p.id = pc.project_id
JOIN companies c ON pc.company_id = c.id
WHERE pc.status = 'active'
ORDER BY p.id, pc.credit_order, pc.role;

-- View: Company's projects (including collaborations)
CREATE OR REPLACE VIEW v_company_projects AS
SELECT
  c.id as company_id,
  c.name as company_name,
  p.id as project_id,
  p.name as project_name,
  p.slug as project_slug,
  p.image_url as project_image,
  p.status as project_status,
  pc.role as company_role,
  pc.status as collaboration_status,
  CASE pc.role
    WHEN 'owner' THEN 1
    WHEN 'lead' THEN 2
    WHEN 'collaborator' THEN 3
    WHEN 'contributor' THEN 4
    WHEN 'sponsor' THEN 5
  END as role_priority
FROM companies c
JOIN project_companies pc ON c.id = pc.company_id
JOIN projects p ON pc.project_id = p.id
WHERE pc.status = 'active'
ORDER BY c.id, role_priority, p.created_at DESC;

-- ═══════════════════════════════════════════════════════════════════════════
-- HELPER FUNCTIONS
-- ═══════════════════════════════════════════════════════════════════════════

-- Get all companies for a project
CREATE OR REPLACE FUNCTION get_project_companies(p_project_id UUID)
RETURNS TABLE (
  company_id UUID,
  company_name TEXT,
  company_slug TEXT,
  company_logo TEXT,
  role TEXT,
  contribution TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.name,
    c.slug,
    c.logo_url,
    pc.role,
    pc.contribution
  FROM project_companies pc
  JOIN companies c ON pc.company_id = c.id
  WHERE pc.project_id = p_project_id
    AND pc.status = 'active'
  ORDER BY pc.credit_order, pc.role;
END;
$$ LANGUAGE plpgsql;

-- Check if company can edit project
CREATE OR REPLACE FUNCTION can_company_edit_project(p_company_id UUID, p_project_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM project_companies
    WHERE company_id = p_company_id
      AND project_id = p_project_id
      AND status = 'active'
      AND (role = 'owner' OR can_edit = TRUE)
  );
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE project_companies ENABLE ROW LEVEL SECURITY;

-- Anyone can read active collaborations
CREATE POLICY "Anyone can view active collaborations"
  ON project_companies
  FOR SELECT
  USING (status = 'active');

-- Company members can manage their collaborations
CREATE POLICY "Company members can manage collaborations"
  ON project_companies
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.company_id = project_companies.company_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'admin')
    )
  );

-- Project owner company can manage all collaborations
CREATE POLICY "Project owner can manage all collaborations"
  ON project_companies
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM project_companies pc
      JOIN company_members cm ON pc.company_id = cm.company_id
      WHERE pc.project_id = project_companies.project_id
        AND pc.role = 'owner'
        AND cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'admin')
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- EXAMPLE QUERIES
-- ═══════════════════════════════════════════════════════════════════════════

-- Get project with all collaborators:
-- SELECT * FROM v_project_collaborators WHERE project_id = '...';

-- Get all projects for a company (including collabs):
-- SELECT * FROM v_company_projects WHERE company_id = '...';

-- Add collaborator to project:
-- INSERT INTO project_companies (project_id, company_id, role, status, invited_by)
-- VALUES ('...', '...', 'collaborator', 'pending', '...');

-- Accept collaboration:
-- UPDATE project_companies
-- SET status = 'active', accepted_at = NOW()
-- WHERE project_id = '...' AND company_id = '...' AND status = 'pending';

-- Get owner company of project:
-- SELECT c.* FROM companies c
-- JOIN project_companies pc ON c.id = pc.company_id
-- WHERE pc.project_id = '...' AND pc.role = 'owner';
