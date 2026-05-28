CREATE TABLE IF NOT EXISTS app_data (
  key         VARCHAR(80) PRIMARY KEY,
  value       JSONB       NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Optional check:
-- SELECT key, updated_at FROM app_data ORDER BY updated_at DESC;
