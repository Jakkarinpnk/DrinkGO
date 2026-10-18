SET NAMES utf8mb4;
SET time_zone = '+00:00';

ALTER TABLE setting
    DROP CONSTRAINT chk_booking_settings_late_minutes,
    CHANGE COLUMN booking_setting_id setting_id INT NOT NULL AUTO_INCREMENT,
    DROP COLUMN late_grace_minutes,
    DROP COLUMN daily_booking_release_time,
    DROP COLUMN created_at;
