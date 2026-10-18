SET NAMES utf8mb4;
SET time_zone = '+00:00';

SET @store_photo_has_media_id = (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'store_photo'
      AND COLUMN_NAME = 'media_id'
);

SET @store_photo_schema_sql = IF(
    @store_photo_has_media_id = 1,
    'ALTER TABLE store_photo
        CHANGE COLUMN media_id photo_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        DROP COLUMN file_name,
        DROP COLUMN file_type,
        DROP COLUMN file_size,
        DROP COLUMN sort_order,
        DROP COLUMN uploaded_at',
    'SELECT 1'
);

PREPARE store_photo_schema_statement FROM @store_photo_schema_sql;
EXECUTE store_photo_schema_statement;
DEALLOCATE PREPARE store_photo_schema_statement;

ALTER TABLE store_photo
    DROP INDEX uq_store_photo_next_url,
    DROP INDEX idx_store_photo_next_store_sort,
    ADD UNIQUE KEY uq_store_photo_url (file_url),
    ADD KEY idx_store_photo_store (store_id);
