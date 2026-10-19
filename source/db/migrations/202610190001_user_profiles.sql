CREATE TABLE IF NOT EXISTS user_profiles (
  user_id VARCHAR(36) NOT NULL PRIMARY KEY,
  display_name VARCHAR(50) NULL,
  bio VARCHAR(300) NULL,
  avatar_url VARCHAR(500) NULL,
  country CHAR(2) NULL,
  birth_year SMALLINT NULL,
  is_public TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_user_profiles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- down (revert manual, no ejecutado automaticamente)
-- DROP TABLE IF EXISTS user_profiles;
