SET NAMES utf8mb4;
SET time_zone = '+00:00';

ALTER TABLE stores
    ADD COLUMN layout_image_url VARCHAR(500) NULL AFTER business_license_url,
    ADD COLUMN layout_file_name VARCHAR(255) NULL AFTER layout_image_url,
    ADD COLUMN layout_file_type VARCHAR(100) NULL AFTER layout_file_name,
    ADD COLUMN layout_file_size BIGINT UNSIGNED NULL AFTER layout_file_type,
    ADD COLUMN layout_updated_at DATETIME(3) NULL AFTER layout_file_size;

ALTER TABLE store_tables
    ADD COLUMN position_x DECIMAL(6,3) NULL AFTER status,
    ADD COLUMN position_y DECIMAL(6,3) NULL AFTER position_x,
    ADD CONSTRAINT chk_store_tables_position_x CHECK (position_x IS NULL OR (position_x >= 0 AND position_x <= 100)),
    ADD CONSTRAINT chk_store_tables_position_y CHECK (position_y IS NULL OR (position_y >= 0 AND position_y <= 100)),
    ADD CONSTRAINT chk_store_tables_position_pair CHECK (
        (position_x IS NULL AND position_y IS NULL) OR
        (position_x IS NOT NULL AND position_y IS NOT NULL)
    );
