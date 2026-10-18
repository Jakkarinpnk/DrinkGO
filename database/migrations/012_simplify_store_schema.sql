SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE store_categories_next (
    category_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    category_name VARCHAR(100) NOT NULL,
    PRIMARY KEY (category_id),
    UNIQUE KEY uq_store_categories_next_name (category_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO store_categories_next (category_id, category_name)
SELECT id, name FROM store_categories ORDER BY id;

CREATE TABLE stores_next (
    store_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    owner_user_id INT NOT NULL,
    category_id BIGINT UNSIGNED NOT NULL,
    store_name VARCHAR(180) NOT NULL,
    line_contact VARCHAR(500) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    address TEXT NOT NULL,
    google_map_url VARCHAR(2048) NOT NULL,
    description TEXT NULL,
    open_time TIME NOT NULL,
    close_time TIME NOT NULL,
    business_license_url VARCHAR(500) NOT NULL,
    status ENUM('PENDING', 'OPEN', 'CLOSED', 'REJECTED', 'SUSPENDED') NOT NULL DEFAULT 'PENDING',
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (store_id),
    KEY idx_stores_next_owner (owner_user_id),
    KEY idx_stores_next_category (category_id),
    KEY idx_stores_next_status (status),
    KEY idx_stores_next_name (store_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO stores_next
    (store_id, owner_user_id, category_id, store_name, line_contact, phone, address,
     google_map_url, description, open_time, close_time, business_license_url, status, created_at)
SELECT
    s.id,
    s.owner_user_id,
    (SELECT scm.category_id FROM store_category_mappings scm WHERE scm.store_id = s.id ORDER BY scm.category_id LIMIT 1),
    s.name,
    s.line_url,
    s.phone,
    CONCAT(s.address_line, '\nจังหวัด:', s.province),
    s.google_map_url,
    s.description,
    COALESCE((SELECT sh.open_time FROM store_hours sh WHERE sh.store_id = s.id AND sh.is_closed = 0 ORDER BY sh.day_of_week LIMIT 1), '09:00:00'),
    COALESCE((SELECT sh.close_time FROM store_hours sh WHERE sh.store_id = s.id AND sh.is_closed = 0 ORDER BY sh.day_of_week LIMIT 1), '18:00:00'),
    COALESCE((
        SELECT f.storage_key
        FROM store_documents sd
        INNER JOIN files f ON f.id = sd.file_id
        WHERE sd.store_id = s.id
        ORDER BY sd.id LIMIT 1
    ), ''),
    CASE
        WHEN s.approval_status = 'PENDING' THEN 'PENDING'
        WHEN s.approval_status = 'REJECTED' THEN 'REJECTED'
        WHEN s.approval_status = 'SUSPENDED' THEN 'SUSPENDED'
        WHEN s.service_status = 'OPEN' AND s.deleted_at IS NULL THEN 'OPEN'
        ELSE 'CLOSED'
    END,
    s.created_at
FROM stores s
WHERE s.deleted_at IS NULL;

CREATE TABLE store_menu_files_next (
    menu_file_id BIGINT UNSIGNED NOT NULL,
    store_id BIGINT UNSIGNED NOT NULL,
    file_type VARCHAR(100) NOT NULL,
    uploaded_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (menu_file_id),
    KEY idx_store_menu_files_next_store (store_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO store_menu_files_next (menu_file_id, store_id, file_type, uploaded_at)
SELECT mf.file_id, mf.store_id, f.mime_type, mf.created_at
FROM menu_files mf
INNER JOIN files f ON f.id = mf.file_id
INNER JOIN stores_next s ON s.store_id = mf.store_id
WHERE mf.deleted_at IS NULL AND f.deleted_at IS NULL;

DELETE oa
FROM owner_applications oa
LEFT JOIN stores_next s ON s.store_id = oa.store_id
WHERE s.store_id IS NULL;

DELETE sm
FROM store_media sm
LEFT JOIN stores_next s ON s.store_id = sm.store_id
WHERE s.store_id IS NULL;

ALTER TABLE owner_applications DROP FOREIGN KEY fk_owner_applications_store;
ALTER TABLE store_media DROP FOREIGN KEY fk_store_media_store;

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS background_jobs;
DROP TABLE IF EXISTS booking_periods;
DROP TABLE IF EXISTS booking_policies;
DROP TABLE IF EXISTS booking_slots;
DROP TABLE IF EXISTS email_verifications;
DROP TABLE IF EXISTS floor_plans;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS outbox_events;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS promotion_redemptions;
DROP TABLE IF EXISTS promotion_tables;
DROP TABLE IF EXISTS promotions;
DROP TABLE IF EXISTS report_attachments;
DROP TABLE IF EXISTS report_messages;
DROP TABLE IF EXISTS store_reports;
DROP TABLE IF EXISTS reservation_status_history;
DROP TABLE IF EXISTS reservation_tables;
DROP TABLE IF EXISTS reservations;
DROP TABLE IF EXISTS restaurant_tables;
DROP TABLE IF EXISTS review_ratings;
DROP TABLE IF EXISTS review_replies;
DROP TABLE IF EXISTS reviews;
DROP TABLE IF EXISTS store_category_mappings;
DROP TABLE IF EXISTS store_documents;
DROP TABLE IF EXISTS store_hours;
DROP TABLE IF EXISTS store_payment_accounts;
DROP TABLE IF EXISTS store_special_days;
DROP TABLE IF EXISTS store_status_history;
DROP TABLE IF EXISTS table_slot_allocations;
DROP TABLE IF EXISTS table_slot_blocks;
DROP TABLE IF EXISTS otp_tokens;
DROP TABLE menu_files;
DROP TABLE stores;
DROP TABLE store_categories;

RENAME TABLE store_categories_next TO store_categories,
             stores_next TO stores,
             store_menu_files_next TO store_menu_files;

DELETE f
FROM files f
LEFT JOIN store_media sm ON sm.file_id = f.id
LEFT JOIN store_menu_files smf ON smf.menu_file_id = f.id
WHERE sm.file_id IS NULL AND smf.menu_file_id IS NULL;

SET FOREIGN_KEY_CHECKS = 1;

ALTER TABLE stores
    ADD CONSTRAINT fk_stores_owner
        FOREIGN KEY (owner_user_id) REFERENCES users(user_id) ON DELETE RESTRICT,
    ADD CONSTRAINT fk_stores_category
        FOREIGN KEY (category_id) REFERENCES store_categories(category_id) ON DELETE RESTRICT;

ALTER TABLE store_menu_files
    ADD CONSTRAINT fk_store_menu_files_file
        FOREIGN KEY (menu_file_id) REFERENCES files(id) ON DELETE RESTRICT,
    ADD CONSTRAINT fk_store_menu_files_store
        FOREIGN KEY (store_id) REFERENCES stores(store_id) ON DELETE CASCADE;

ALTER TABLE owner_applications
    ADD CONSTRAINT fk_owner_applications_store
        FOREIGN KEY (store_id) REFERENCES stores(store_id) ON DELETE CASCADE;

ALTER TABLE store_media
    ADD CONSTRAINT fk_store_media_store
        FOREIGN KEY (store_id) REFERENCES stores(store_id) ON DELETE CASCADE;
