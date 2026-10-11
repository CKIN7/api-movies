-- Migracion 0000: esquema base de moviesdb (9 tablas originales).
-- Complementa las migraciones incrementales posteriores:
--   202608070001 -> columnas users.email_verified(+_at) y tabla email_verifications
--   202608070002 -> FK de email_verifications.user_id
--   202608140001 -> tabla reviews
--   202609300001 -> tabla user_watchlists
-- Usa IF NOT EXISTS: en BDs existentes (creadas con db/schema.sql) no toca nada
-- y solo queda registrada como aplicada en schema_migrations.
-- Las definiciones deben mantenerse al dia con db/schema.sql (snapshot final).

SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS `actors` (
  `actor_id` int NOT NULL AUTO_INCREMENT,
  `actor_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  PRIMARY KEY (`actor_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `audit_log` (
  `id` int NOT NULL AUTO_INCREMENT,
  `movie_id` int NOT NULL,
  `action` enum('CREATE','UPDATE','DELETE') NOT NULL,
  `old_snapshot` json DEFAULT NULL,
  `new_snapshot` json DEFAULT NULL,
  `changed_by` varchar(100) NOT NULL DEFAULT 'system',
  `changed_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_movie_id` (`movie_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `directors` (
  `director_name` varchar(100) NOT NULL,
  `director_id` int NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (`director_id`),
  UNIQUE KEY `directors_unique` (`director_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `genres` (
  `id_genre` int NOT NULL AUTO_INCREMENT,
  `genre_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  PRIMARY KEY (`id_genre`),
  UNIQUE KEY `genres_unique` (`genre_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `movies` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(100) CHARACTER SET utf16 COLLATE utf16_general_ci NOT NULL,
  `year` int NOT NULL,
  `rating` decimal(10,0) NOT NULL,
  `duration` int NOT NULL,
  `plot` varchar(300) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `poster` text NOT NULL,
  `id_director` int NOT NULL,
  `age_rating` varchar(10) NOT NULL DEFAULT 'PG-13',
  PRIMARY KEY (`id`),
  KEY `movies_directors_FK` (`id_director`),
  CONSTRAINT `movies_directors_FK` FOREIGN KEY (`id_director`) REFERENCES `directors` (`director_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `movie_actors` (
  `movie_id` int NOT NULL,
  `actor_id` int NOT NULL,
  `character_name` varchar(255) NOT NULL,
  PRIMARY KEY (`movie_id`,`actor_id`),
  KEY `actor_id` (`actor_id`),
  CONSTRAINT `movie_actors_ibfk_1` FOREIGN KEY (`movie_id`) REFERENCES `movies` (`id`) ON DELETE CASCADE,
  CONSTRAINT `movie_actors_ibfk_2` FOREIGN KEY (`actor_id`) REFERENCES `actors` (`actor_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `movie_genres` (
  `movie_id` int NOT NULL,
  `genre_id` int NOT NULL,
  PRIMARY KEY (`movie_id`,`genre_id`),
  KEY `movie_genres_genres_FK` (`genre_id`),
  CONSTRAINT `movie_genres_genres_FK` FOREIGN KEY (`genre_id`) REFERENCES `genres` (`id_genre`),
  CONSTRAINT `movie_genres_movies_FK` FOREIGN KEY (`movie_id`) REFERENCES `movies` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `users` (
  `id` varchar(36) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role` varchar(20) NOT NULL DEFAULT 'user',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `refresh_tokens` (
  `id` varchar(36) NOT NULL,
  `user_id` varchar(36) NOT NULL,
  `token` varchar(500) NOT NULL,
  `expires_at` datetime NOT NULL,
  `revoked_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_refresh_tokens_token` (`token`),
  KEY `fk_refresh_user` (`user_id`),
  CONSTRAINT `fk_refresh_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

SET FOREIGN_KEY_CHECKS = 1;
