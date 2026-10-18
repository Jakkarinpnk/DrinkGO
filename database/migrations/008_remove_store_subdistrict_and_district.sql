SET NAMES utf8mb4;

ALTER TABLE stores
    DROP INDEX idx_stores_location,
    ADD KEY idx_stores_province (province),
    DROP COLUMN subdistrict,
    DROP COLUMN district;
