SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE store_photo_next (
    media_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    store_id BIGINT UNSIGNED NOT NULL,
    file_url VARCHAR(500) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(100) NOT NULL,
    file_size BIGINT UNSIGNED NOT NULL,
    is_cover TINYINT(1) NOT NULL DEFAULT 0,
    sort_order INT UNSIGNED NOT NULL DEFAULT 0,
    uploaded_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (media_id),
    UNIQUE KEY uq_store_photo_next_url (file_url),
    KEY idx_store_photo_next_store_sort (store_id, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO store_photo_next
    (media_id, store_id, file_url, file_name, file_type, file_size, is_cover, sort_order, uploaded_at)
SELECT sm.id, sm.store_id, CONCAT('/uploads/', f.storage_key), f.original_name,
       f.mime_type, f.size_bytes, sm.is_cover, sm.sort_order, sm.created_at
FROM store_media sm
INNER JOIN files f ON f.id = sm.file_id
WHERE f.deleted_at IS NULL;

CREATE TABLE store_menu_files_next (
    menu_file_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    store_id BIGINT UNSIGNED NOT NULL,
    file_url VARCHAR(500) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(100) NOT NULL,
    file_size BIGINT UNSIGNED NOT NULL,
    uploaded_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (menu_file_id),
    UNIQUE KEY uq_store_menu_files_next_url (file_url),
    KEY idx_store_menu_files_next_store (store_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO store_menu_files_next
    (menu_file_id, store_id, file_url, file_name, file_type, file_size, uploaded_at)
SELECT smf.menu_file_id, smf.store_id, CONCAT('/uploads/', f.storage_key),
       f.original_name, smf.file_type, f.size_bytes, smf.uploaded_at
FROM store_menu_files smf
INNER JOIN files f ON f.id = smf.menu_file_id
WHERE f.deleted_at IS NULL;

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE store_media;
DROP TABLE store_menu_files;
DROP TABLE files;

RENAME TABLE store_photo_next TO store_photo,
             store_menu_files_next TO store_menu_files;

SET FOREIGN_KEY_CHECKS = 1;

ALTER TABLE store_photo
    ADD CONSTRAINT fk_store_photo_store
        FOREIGN KEY (store_id) REFERENCES stores(store_id) ON DELETE CASCADE;

ALTER TABLE store_menu_files
    ADD CONSTRAINT fk_store_menu_files_store
        FOREIGN KEY (store_id) REFERENCES stores(store_id) ON DELETE CASCADE;
