SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE store_tables (
    table_id INT NOT NULL AUTO_INCREMENT,
    store_id BIGINT UNSIGNED NOT NULL,
    table_number VARCHAR(20) NOT NULL,
    seat_capacity INT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (table_id),
    UNIQUE KEY uq_store_tables_number (store_id, table_number),
    KEY idx_store_tables_status (store_id, status),
    CONSTRAINT chk_store_tables_seat_capacity CHECK (seat_capacity > 0),
    CONSTRAINT chk_store_tables_status CHECK (status IN ('ACTIVE', 'INACTIVE')),
    CONSTRAINT fk_store_tables_store
        FOREIGN KEY (store_id) REFERENCES stores(store_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE booking_settings (
    booking_setting_id INT NOT NULL AUTO_INCREMENT,
    store_id BIGINT UNSIGNED NOT NULL,
    booking_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    cancel_before_days INT NOT NULL DEFAULT 0,
    late_grace_minutes INT NOT NULL DEFAULT 0,
    daily_booking_release_time TIME NOT NULL DEFAULT '00:30:00',
    is_booking_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    cancellation_policy_text TEXT NULL,
    booking_policy_text TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (booking_setting_id),
    UNIQUE KEY uq_booking_settings_store (store_id),
    CONSTRAINT chk_booking_settings_price CHECK (booking_price >= 0),
    CONSTRAINT chk_booking_settings_cancel_days CHECK (cancel_before_days >= 0),
    CONSTRAINT chk_booking_settings_late_minutes CHECK (late_grace_minutes >= 0),
    CONSTRAINT chk_booking_settings_enabled CHECK (is_booking_enabled IN (0, 1)),
    CONSTRAINT fk_booking_settings_store
        FOREIGN KEY (store_id) REFERENCES stores(store_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE booking_special_settings (
    special_setting_id INT NOT NULL AUTO_INCREMENT,
    store_id BIGINT UNSIGNED NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    booking_status VARCHAR(20) NOT NULL,
    note TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (special_setting_id),
    KEY idx_booking_special_settings_dates (store_id, start_date, end_date),
    CONSTRAINT chk_booking_special_settings_dates CHECK (end_date >= start_date),
    CONSTRAINT chk_booking_special_settings_status CHECK (booking_status IN ('OPEN', 'CLOSED')),
    CONSTRAINT fk_booking_special_settings_store
        FOREIGN KEY (store_id) REFERENCES stores(store_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
