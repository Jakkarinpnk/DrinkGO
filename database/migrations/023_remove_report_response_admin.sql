SET NAMES utf8mb4;
SET time_zone = '+00:00';

ALTER TABLE reports
    DROP FOREIGN KEY fk_reports_admin,
    DROP INDEX idx_reports_admin,
    DROP COLUMN response_admin_id;
