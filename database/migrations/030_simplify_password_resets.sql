SET NAMES utf8mb4;
SET time_zone = '+00:00';

UPDATE password_resets
SET expires_at = UTC_TIMESTAMP(3), attempt_count = 5;

ALTER TABLE password_resets
    DROP INDEX uq_password_reset_token_hash,
    DROP COLUMN verified_at,
    DROP COLUMN reset_token_hash,
    DROP COLUMN reset_token_expires_at,
    DROP COLUMN used_at,
    DROP COLUMN requested_ip;
