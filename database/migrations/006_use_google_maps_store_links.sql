SET NAMES utf8mb4;
SET time_zone = '+00:00';

ALTER TABLE stores
    ADD COLUMN IF NOT EXISTS google_map_url VARCHAR(2048) NULL AFTER address_line;

-- Preserve existing locations as real Maps links before removing their coordinates.
-- New applications supply a Google Maps link directly.
UPDATE stores
SET google_map_url = CONCAT('https://www.google.com/maps?q=', latitude, ',', longitude)
WHERE google_map_url IS NULL OR TRIM(google_map_url) = '';

ALTER TABLE stores
    MODIFY COLUMN google_map_url VARCHAR(2048) NOT NULL,
    DROP COLUMN IF EXISTS latitude,
    DROP COLUMN IF EXISTS longitude,
    DROP COLUMN IF EXISTS postal_code;
