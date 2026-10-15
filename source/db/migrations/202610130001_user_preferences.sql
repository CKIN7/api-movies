CREATE TABLE IF NOT EXISTS user_preferences (
  user_id VARCHAR(36) NOT NULL PRIMARY KEY,
  favorite_genres JSON NULL,
  favorite_directors JSON NULL,
  favorite_actors JSON NULL,
  genre_affinity JSON NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_user_preferences_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
