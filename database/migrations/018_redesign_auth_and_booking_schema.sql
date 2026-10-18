SET NAMES utf8mb4;
SET time_zone = '+00:00';

ALTER TABLE users ADD COLUMN session_version INT UNSIGNED NOT NULL DEFAULT 0 AFTER account_status;
ALTER TABLE admins ADD COLUMN session_version INT UNSIGNED NOT NULL DEFAULT 0 AFTER admin_status;

RENAME TABLE password_reset_otps TO password_resets,
             booking_settings TO setting,
             booking_special_settings TO close_setting;

CREATE TABLE promotion (
    promotion_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    store_id BIGINT UNSIGNED NOT NULL,
    promotion_name VARCHAR(255) NOT NULL,
    description TEXT NULL,
    discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (promotion_id),
    KEY idx_promotion_store_dates (store_id, start_date, end_date),
    CONSTRAINT chk_promotion_discount CHECK (discount_amount >= 0),
    CONSTRAINT chk_promotion_dates CHECK (end_date >= start_date),
    CONSTRAINT fk_promotion_store FOREIGN KEY (store_id) REFERENCES stores(store_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE booking (
    booking_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id INT NOT NULL,
    store_id BIGINT UNSIGNED NOT NULL,
    promotion_id BIGINT UNSIGNED NULL,
    booking_date DATE NOT NULL,
    booking_time TIME NOT NULL,
    people_count INT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    slip_image VARCHAR(500) NULL,
    payment_datetime DATETIME NULL,
    total_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (booking_id),
    KEY idx_booking_user_date (user_id, booking_date),
    KEY idx_booking_store_date (store_id, booking_date, booking_time),
    KEY idx_booking_promotion (promotion_id),
    CONSTRAINT chk_booking_people CHECK (people_count > 0),
    CONSTRAINT chk_booking_price CHECK (total_price >= 0),
    CONSTRAINT chk_booking_status CHECK (status IN ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED')),
    CONSTRAINT fk_booking_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_booking_store FOREIGN KEY (store_id) REFERENCES stores(store_id) ON DELETE CASCADE,
    CONSTRAINT fk_booking_promotion FOREIGN KEY (promotion_id) REFERENCES promotion(promotion_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE booking_tables (
    booking_id BIGINT UNSIGNED NOT NULL,
    table_id INT NOT NULL,
    PRIMARY KEY (booking_id, table_id),
    KEY idx_booking_tables_table (table_id),
    CONSTRAINT fk_booking_tables_booking FOREIGN KEY (booking_id) REFERENCES booking(booking_id) ON DELETE CASCADE,
    CONSTRAINT fk_booking_tables_table FOREIGN KEY (table_id) REFERENCES store_tables(table_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE login_log (
    login_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id INT NULL,
    admin_id INT NULL,
    login_method VARCHAR(20) NOT NULL,
    login_date DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ip_address VARCHAR(45) NULL,
    user_agent VARCHAR(512) NULL,
    PRIMARY KEY (login_id),
    KEY idx_login_log_user_date (user_id, login_date),
    KEY idx_login_log_admin_date (admin_id, login_date),
    CONSTRAINT chk_login_log_method CHECK (login_method IN ('PASSWORD', 'GOOGLE')),
    CONSTRAINT chk_login_log_actor CHECK ((user_id IS NOT NULL) <> (admin_id IS NOT NULL)),
    CONSTRAINT fk_login_log_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_login_log_admin FOREIGN KEY (admin_id) REFERENCES admins(admin_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE reports (
    report_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id INT NOT NULL,
    store_id BIGINT UNSIGNED NULL,
    booking_id BIGINT UNSIGNED NULL,
    response_admin_id INT NULL,
    detail TEXT NOT NULL,
    report_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    response_date DATETIME NULL,
    response_detail TEXT NULL,
    PRIMARY KEY (report_id),
    KEY idx_reports_user_date (user_id, report_date),
    KEY idx_reports_store (store_id),
    KEY idx_reports_booking (booking_id),
    KEY idx_reports_admin (response_admin_id),
    CONSTRAINT fk_reports_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_reports_store FOREIGN KEY (store_id) REFERENCES stores(store_id) ON DELETE SET NULL,
    CONSTRAINT fk_reports_booking FOREIGN KEY (booking_id) REFERENCES booking(booking_id) ON DELETE SET NULL,
    CONSTRAINT fk_reports_admin FOREIGN KEY (response_admin_id) REFERENCES admins(admin_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE review (
    review_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    booking_id BIGINT UNSIGNED NOT NULL,
    user_id INT NOT NULL,
    store_id BIGINT UNSIGNED NOT NULL,
    rating TINYINT UNSIGNED NOT NULL,
    review_text TEXT NULL,
    review_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    response TEXT NULL,
    response_date DATETIME NULL,
    PRIMARY KEY (review_id),
    UNIQUE KEY uq_review_booking (booking_id),
    KEY idx_review_store_date (store_id, review_date),
    KEY idx_review_user (user_id),
    CONSTRAINT chk_review_rating CHECK (rating BETWEEN 1 AND 5),
    CONSTRAINT fk_review_booking FOREIGN KEY (booking_id) REFERENCES booking(booking_id) ON DELETE CASCADE,
    CONSTRAINT fk_review_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_review_store FOREIGN KEY (store_id) REFERENCES stores(store_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE refresh_tokens, admin_refresh_tokens, audit_logs;
