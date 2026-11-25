-- Preview-only quota table. This database is not the live members database.
CREATE TABLE IF NOT EXISTS advisor_usage (
  user_id TEXT NOT NULL,
  yyyymm TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, yyyymm)
);
