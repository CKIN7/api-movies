-- 202609300001_user_watchlist.sql
-- up

CREATE TABLE user_watchlists (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    user_id     CHAR(36) NOT NULL,
    movie_id    INT NOT NULL,
    notes       TEXT NULL,
    priority    TINYINT UNSIGNED NOT NULL DEFAULT 3,
    added_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id)  REFERENCES users(id)  ON DELETE CASCADE,
    FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE,
    UNIQUE KEY uniq_user_movie (user_id, movie_id),
    CHECK (priority BETWEEN 1 AND 5)
)

-- down (revert manual, no ejecutado automaticamente)
-- DROP TABLE IF EXISTS user_watchlists;