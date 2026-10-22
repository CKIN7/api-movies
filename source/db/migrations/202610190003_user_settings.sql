CREATE TABLE IF NOT EXISTS user_settings (
  user_id CHAR(36) NOT NULL,
  language VARCHAR(10) NOT NULL DEFAULT 'es',
  theme VARCHAR(10) NOT NULL DEFAULT 'system',
  region VARCHAR(2) NULL,
  notify_email TINYINT(1) NOT NULL DEFAULT 1,
  notify_push TINYINT(1) NOT NULL DEFAULT 0,
  privacy_reviews VARCHAR(20) NOT NULL DEFAULT 'public',
  privacy_watchlist VARCHAR(20) NOT NULL DEFAULT 'public',
  privacy_activity VARCHAR(20) NOT NULL DEFAULT 'friends',
  spoiler_free TINYINT(1) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  CONSTRAINT fk_user_settings_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- down (revert manual, no ejecutado automaticamente)
-- DROP TABLE IF EXISTS user_settings;
