SET NAMES utf8mb4;
SET time_zone = '+00:00';

DROP TABLE login_log;

ALTER TABLE users
    ADD COLUMN last_activity_at DATETIME(3) NULL AFTER account_status,
    ADD KEY idx_users_last_activity (account_status, last_activity_at);
