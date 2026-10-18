SET NAMES utf8mb4;
SET time_zone = '+00:00';

ALTER TABLE admins
    DROP COLUMN admin_status,
    DROP COLUMN session_version;
