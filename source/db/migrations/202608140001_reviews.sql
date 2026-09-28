-- 202608140001_reviews.sql
-- up
CREATE TABLE reviews (
    id         BIGINT AUTO_INCREMENT PRIMARY KEY,
    movie_id   INT NOT NULL,
    user_id    CHAR(36) NOT NULL,
    rating     DECIMAL(2,1) NOT NULL,
    comment    TEXT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_reviews_movie_user (movie_id, user_id),
    INDEX idx_reviews_movie_id (movie_id),
    INDEX idx_reviews_movie_rating (movie_id, rating),
    CONSTRAINT fk_reviews_movie FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE,
    CONSTRAINT fk_reviews_user  FOREIGN KEY (user_id)  REFERENCES users(id)  ON DELETE CASCADE
);

-- down (revert manual, no ejecutado automaticamente)
-- DROP TABLE IF EXISTS reviews;