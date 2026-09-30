-- Per-IP rate limit counters (one row per ip+scope+window). Written by functions/_lib/rate-limit.ts.
CREATE TABLE IF NOT EXISTS rate_limits (
  k TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  window_start INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window_start ON rate_limits (window_start);
