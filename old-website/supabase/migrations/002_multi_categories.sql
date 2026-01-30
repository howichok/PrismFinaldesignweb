-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: Multi-Category Support
-- Converts single category TEXT to TEXT[] array for multi-select
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- PROJECTS: Convert category to array
-- ═══════════════════════════════════════════════════════════════════════════

-- Step 1: Add new column
ALTER TABLE projects ADD COLUMN categories TEXT[] DEFAULT '{}';

-- Step 2: Migrate existing data
UPDATE projects
SET categories = CASE
  WHEN category IS NOT NULL THEN ARRAY[category]
  ELSE '{}'
END;

-- Step 3: Drop old column (optional - keep for backwards compatibility)
-- ALTER TABLE projects DROP COLUMN category;

-- Step 4: Add constraint to validate array elements
-- Each element must be one of the allowed categories
CREATE OR REPLACE FUNCTION validate_project_categories(cats TEXT[])
RETURNS BOOLEAN AS $$
DECLARE
  allowed TEXT[] := ARRAY['building', 'station', 'line_section', 'line'];
  cat TEXT;
BEGIN
  FOREACH cat IN ARRAY cats LOOP
    IF NOT (cat = ANY(allowed)) THEN
      RETURN FALSE;
    END IF;
  END LOOP;
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

ALTER TABLE projects
  ADD CONSTRAINT check_project_categories
  CHECK (validate_project_categories(categories));

-- Step 5: Limit max categories (optional, e.g., max 3)
ALTER TABLE projects
  ADD CONSTRAINT max_project_categories
  CHECK (array_length(categories, 1) IS NULL OR array_length(categories, 1) <= 4);

-- Step 6: Create GIN index for fast array searches
CREATE INDEX idx_projects_categories_gin ON projects USING GIN(categories);

-- ═══════════════════════════════════════════════════════════════════════════
-- POSTS: Convert category to array (if needed)
-- ═══════════════════════════════════════════════════════════════════════════

-- Step 1: Add new column
ALTER TABLE posts ADD COLUMN categories TEXT[] DEFAULT '{}';

-- Step 2: Migrate existing data
UPDATE posts
SET categories = CASE
  WHEN category IS NOT NULL THEN ARRAY[category]
  ELSE '{}'
END;

-- Step 3: Add constraint
CREATE OR REPLACE FUNCTION validate_post_categories(cats TEXT[])
RETURNS BOOLEAN AS $$
DECLARE
  allowed TEXT[] := ARRAY['news', 'update', 'announcement', 'guide', 'showcase'];
  cat TEXT;
BEGIN
  FOREACH cat IN ARRAY cats LOOP
    IF NOT (cat = ANY(allowed)) THEN
      RETURN FALSE;
    END IF;
  END LOOP;
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

ALTER TABLE posts
  ADD CONSTRAINT check_post_categories
  CHECK (validate_post_categories(categories));

-- Step 4: Create index
CREATE INDEX idx_posts_categories_gin ON posts USING GIN(categories);

-- ═══════════════════════════════════════════════════════════════════════════
-- EXAMPLE QUERIES
-- ═══════════════════════════════════════════════════════════════════════════

-- Find projects with 'building' category:
-- SELECT * FROM projects WHERE 'building' = ANY(categories);

-- Find projects with ANY of these categories:
-- SELECT * FROM projects WHERE categories && ARRAY['building', 'station'];

-- Find projects with ALL of these categories:
-- SELECT * FROM projects WHERE categories @> ARRAY['building', 'station'];

-- Count projects per category:
-- SELECT unnest(categories) as category, COUNT(*)
-- FROM projects
-- GROUP BY category;
