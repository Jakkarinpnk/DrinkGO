SET NAMES utf8mb4;
SET time_zone = '+00:00';

ALTER TABLE stores
    ADD COLUMN open_days_mask TINYINT UNSIGNED NOT NULL DEFAULT 127 AFTER close_time,
    ADD CONSTRAINT chk_stores_open_days_mask CHECK (open_days_mask BETWEEN 1 AND 127);
