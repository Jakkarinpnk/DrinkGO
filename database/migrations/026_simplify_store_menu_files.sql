SET NAMES utf8mb4;
SET time_zone = '+00:00';

ALTER TABLE store_menu_files
    DROP COLUMN file_name,
    DROP COLUMN file_type,
    DROP COLUMN file_size,
    DROP COLUMN uploaded_at;
