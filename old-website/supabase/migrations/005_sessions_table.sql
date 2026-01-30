-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: Add Sessions Table and User Version
-- For HttpOnly cookie-based authentication
-- ═══════════════════════════════════════════════════════════════════════════

-- Add version column to users table (for session invalidation on user changes)
ALTER TABLE users ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

-- Create sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  user_version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- Index for fast token lookups
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- Function to clean up expired sessions (run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM sessions WHERE expires_at < NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Trigger to increment user version on update
CREATE OR REPLACE FUNCTION increment_user_version()
RETURNS TRIGGER AS $$
BEGIN
  -- Only increment version if significant fields changed (not just last login)
  IF (NEW.role IS DISTINCT FROM OLD.role) OR
     (NEW.email IS DISTINCT FROM OLD.email) OR
     (NEW.nickname IS DISTINCT FROM OLD.nickname) OR
     (NEW.mc_nickname IS DISTINCT FROM OLD.mc_nickname) OR
     (NEW.connections IS DISTINCT FROM OLD.connections)
  THEN
    NEW.version := COALESCE(OLD.version, 0) + 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_increment_user_version ON users;
CREATE TRIGGER trigger_increment_user_version
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION increment_user_version();

-- RLS policies for sessions table
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (for Netlify Functions)
CREATE POLICY "Service role can manage sessions" ON sessions
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════════════════
-- Note: Run this migration in Supabase SQL Editor
-- The sessions table stores:
-- - token: 64-character hex string (32 random bytes)
-- - user_id: reference to users table
-- - user_version: snapshot of user version at login (for invalidation)
-- - expires_at: when session expires (default 24 hours)
-- ═══════════════════════════════════════════════════════════════════════════
