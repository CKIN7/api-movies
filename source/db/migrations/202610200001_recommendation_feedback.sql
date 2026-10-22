CREATE TABLE IF NOT EXISTS recommendation_feedback (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  movie_id INT NOT NULL,
  action ENUM('view', 'hide', 'like', 'not_interested') NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_user_movie_action (user_id, movie_id, action),
  KEY idx_feedback_excluded (user_id, action),
  CONSTRAINT fk_feedback_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_feedback_movie FOREIGN KEY (movie_id) REFERENCES movies (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- down (revert manual, no ejecutado automaticamente)
-- DROP TABLE IF EXISTS recommendation_feedback;
