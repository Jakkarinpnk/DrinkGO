SET NAMES utf8mb4;
SET time_zone = '+00:00';

ALTER TABLE close_setting
    DROP CONSTRAINT chk_booking_special_settings_status,
    DROP COLUMN booking_status;
