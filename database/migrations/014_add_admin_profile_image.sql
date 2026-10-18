SET NAMES utf8mb4;
SET time_zone = '+00:00';

ALTER TABLE admins
    ADD COLUMN profile_image VARCHAR(500) NULL AFTER phone_number;
