SET NAMES utf8mb4;
SET time_zone = '+00:00';

ALTER TABLE close_setting
    CHANGE COLUMN special_setting_id close_setting_id INT NOT NULL AUTO_INCREMENT;
