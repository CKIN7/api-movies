-- 202610120001_users_role_check.sql
-- up

ALTER TABLE users
    ADD CONSTRAINT chk_users_role CHECK (role IN ('admin', 'user', 'premium'))

-- down (revert manual, no ejecutado automaticamente)
-- ALTER TABLE users DROP CHECK chk_users_role;
