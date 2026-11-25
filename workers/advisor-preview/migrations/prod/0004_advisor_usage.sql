; Non-destructive: adds advisor_usage only. Does not alter existing member tables.
-- Prepared for the live members D1 (rokwilder-members) but NOT applied until
-- Christopher explicitly approves go-live. Safe to apply: CREATE TABLE IF NOT EXISTS
-- plus a new table only; no DROP, no ALTER of users/orders/entitlements.
-- Apply with wrangler d1 migrations apply rokwilder-members --remote, or the
-- Cloudflare D1 SQL API, only after that yes.
CREATE TABLE IF NOT EXISTS advisor_usage (
  user_id TEXT NOT NULL,
  yyyymm TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, yyyymm)
);
