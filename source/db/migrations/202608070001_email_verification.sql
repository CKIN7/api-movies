-- 202608070001_email_verification.sql
-- up
ALTER TABLE users
    ADD COLUMN email_verified TINYINT(1) NOT NULL DEFAULT 0,
    ADD COLUMN email_verified_at DATETIME NULL;

CREATE TABLE email_verifications (
    id         CHAR(36) PRIMARY KEY,
    user_id    CHAR(36) NOT NULL,
    token      VARCHAR(255) NOT NULL,
    expires_at DATETIME NOT NULL,
    used_at    DATETIME NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_email_verifications_token (token)
);

-- down (revert manual, no ejecutado automaticamente)
-- DROP TABLE email_verifications;
-- ALTER TABLE users DROP COLUMN email_verified, DROP COLUMN email_verified_at;
