ALTER TABLE user_settings
  ADD COLUMN onboarding_completed TINYINT(1) NOT NULL DEFAULT 0;

-- down (revert manual, no ejecutado automaticamente)
-- ALTER TABLE user_settings DROP COLUMN onboarding_completed;
