ALTER TABLE user_preferences
  ADD COLUMN disliked_genres JSON NULL,
  ADD COLUMN disliked_directors JSON NULL,
  ADD COLUMN disliked_actors JSON NULL,
  ADD COLUMN content_filters JSON NULL;

-- down (revert manual, no ejecutado automaticamente)
-- ALTER TABLE user_preferences
--   DROP COLUMN disliked_genres,
--   DROP COLUMN disliked_directors,
--   DROP COLUMN disliked_actors,
--   DROP COLUMN content_filters;
