SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- Nullable additions preserve legacy bookings which have no table assignment.
ALTER TABLE booking
    ADD COLUMN table_id INT NULL,
    ADD COLUMN table_number VARCHAR(20) NULL,
    ADD COLUMN booking_code VARCHAR(40) NULL,
    ADD COLUMN contact_name VARCHAR(150) NULL,
    ADD COLUMN contact_phone VARCHAR(15) NULL,
    ADD COLUMN note VARCHAR(1000) NULL,
    ADD COLUMN arrival_at DATETIME NULL COMMENT 'UTC; booking_date is the Bangkok service date',
    ADD COLUMN request_key CHAR(36) NULL,
    ADD COLUMN request_fingerprint CHAR(64) NULL,
    ADD COLUMN cancelled_at DATETIME NULL,
    ADD COLUMN completed_at DATETIME NULL,
    ADD COLUMN reserved_table_id INT GENERATED ALWAYS AS
        (CASE WHEN status <> 'CANCELLED' THEN table_id ELSE NULL END) STORED,
    ADD UNIQUE KEY uq_booking_table_night (reserved_table_id, booking_date),
    ADD UNIQUE KEY uq_booking_code (booking_code),
    ADD UNIQUE KEY uq_booking_request (user_id, request_key),
    ADD CONSTRAINT fk_booking_table FOREIGN KEY (table_id)
        REFERENCES store_tables(table_id) ON DELETE RESTRICT;
