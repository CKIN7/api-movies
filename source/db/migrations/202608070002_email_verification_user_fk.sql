-- 202608070002_email_verification_user_fk.sql
-- up
ALTER TABLE email_verifications
    ADD INDEX idx_email_verifications_user_id (user_id),
    ADD CONSTRAINT fk_email_verifications_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- down (revert manual, no ejecutado automaticamente)
-- ALTER TABLE email_verifications DROP FOREIGN KEY fk_email_verifications_user;
-- ALTER TABLE email_verifications DROP INDEX idx_email_verifications_user_id;
