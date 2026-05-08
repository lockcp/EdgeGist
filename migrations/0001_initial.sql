CREATE TABLE IF NOT EXISTS gists (
  id TEXT PRIMARY KEY,
  owner_login TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  visibility TEXT NOT NULL CHECK (visibility IN ('public', 'secret')),
  starred_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_gists_owner_updated_at
  ON gists(owner_login, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_gists_visibility_updated_at
  ON gists(visibility, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_gists_starred_updated_at
  ON gists(starred_at, updated_at DESC);

CREATE TABLE IF NOT EXISTS gist_files (
  gist_id TEXT NOT NULL REFERENCES gists(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  content TEXT NOT NULL,
  type TEXT,
  language TEXT,
  size INTEGER NOT NULL,
  truncated INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (gist_id, filename)
);

CREATE TABLE IF NOT EXISTS gist_versions (
  id TEXT PRIMARY KEY,
  gist_id TEXT NOT NULL REFERENCES gists(id) ON DELETE CASCADE,
  sha TEXT NOT NULL UNIQUE,
  version_index INTEGER NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  committed_at TEXT NOT NULL,
  change_status_total INTEGER NOT NULL DEFAULT 0,
  change_status_additions INTEGER NOT NULL DEFAULT 0,
  change_status_deletions INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_gist_versions_gist_committed_at
  ON gist_versions(gist_id, committed_at DESC, version_index DESC);

CREATE TABLE IF NOT EXISTS gist_version_files (
  version_id TEXT NOT NULL REFERENCES gist_versions(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  content TEXT NOT NULL,
  type TEXT,
  language TEXT,
  size INTEGER NOT NULL,
  truncated INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (version_id, filename)
);

CREATE TABLE IF NOT EXISTS gist_version_changes (
  version_id TEXT NOT NULL REFERENCES gist_versions(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  previous_filename TEXT,
  status TEXT NOT NULL CHECK (status IN ('added', 'modified', 'deleted')),
  additions INTEGER NOT NULL DEFAULT 0,
  deletions INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (version_id, filename)
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
