export const SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS classes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS teachers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  class_id TEXT REFERENCES classes(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS children (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  class_id TEXT NOT NULL REFERENCES classes(id),
  gender TEXT,
  birthday TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS domains (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS indicators (
  id TEXT PRIMARY KEY,
  domain_id TEXT NOT NULL REFERENCES domains(id),
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS stages (
  id TEXT PRIMARY KEY,
  indicator_id TEXT NOT NULL REFERENCES indicators(id),
  level INTEGER NOT NULL,
  description TEXT NOT NULL,
  key_point TEXT
);

CREATE TABLE IF NOT EXISTS observations (
  id TEXT PRIMARY KEY,
  teacher_id TEXT NOT NULL REFERENCES teachers(id),
  class_id TEXT NOT NULL REFERENCES classes(id),
  record_type TEXT NOT NULL DEFAULT 'COA记录',
  observed_at TEXT NOT NULL,
  narrative TEXT NOT NULL DEFAULT '',
  voice_transcript TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS observation_children (
  observation_id TEXT NOT NULL REFERENCES observations(id) ON DELETE CASCADE,
  child_id TEXT NOT NULL REFERENCES children(id),
  PRIMARY KEY (observation_id, child_id)
);

CREATE TABLE IF NOT EXISTS observation_stages (
  observation_id TEXT NOT NULL REFERENCES observations(id) ON DELETE CASCADE,
  stage_id TEXT NOT NULL REFERENCES stages(id),
  PRIMARY KEY (observation_id, stage_id)
);

CREATE TABLE IF NOT EXISTS media (
  id TEXT PRIMARY KEY,
  observation_id TEXT NOT NULL REFERENCES observations(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('photo','video','audio')),
  filename TEXT NOT NULL,
  original_name TEXT,
  mime_type TEXT,
  size INTEGER,
  duration_ms INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS observation_guide (
  id TEXT PRIMARY KEY,
  observation_id TEXT NOT NULL REFERENCES observations(id) ON DELETE CASCADE,
  rule_id TEXT NOT NULL,
  domain TEXT NOT NULL,
  area TEXT NOT NULL,
  goal TEXT NOT NULL,
  age_band TEXT NOT NULL,
  typical TEXT NOT NULL,
  keywords TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS observation_guide (
  id TEXT PRIMARY KEY,
  observation_id TEXT NOT NULL REFERENCES observations(id) ON DELETE CASCADE,
  rule_id TEXT NOT NULL,
  domain TEXT NOT NULL,
  area TEXT NOT NULL,
  goal TEXT NOT NULL,
  age_band TEXT NOT NULL,
  typical TEXT NOT NULL,
  keywords TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
`;
