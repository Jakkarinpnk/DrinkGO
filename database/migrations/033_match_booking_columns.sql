SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- A booking now stores the calendar date on which the customer arrives.
-- Release the old service-night index before shifting after-midnight dates.
ALTER TABLE booking
    DROP FOREIGN KEY fk_booking_promotion,
    DROP INDEX idx_booking_promotion,
    DROP INDEX uq_booking_table_night,
    DROP INDEX uq_booking_code,
    DROP INDEX uq_booking_request,
    DROP CONSTRAINT chk_booking_status;

UPDATE booking
SET booking_date = DATE(DATE_ADD(arrival_at, INTERVAL 7 HOUR))
WHERE arrival_at IS NOT NULL;

ALTER TABLE booking
    DROP COLUMN promotion_id,
    DROP COLUMN table_number,
    DROP COLUMN booking_code,
    DROP COLUMN contact_name,
    DROP COLUMN contact_phone,
    DROP COLUMN note,
    DROP COLUMN arrival_at,
    DROP COLUMN request_key,
    DROP COLUMN request_fingerprint,
    DROP COLUMN cancelled_at,
    DROP COLUMN completed_at,
    DROP COLUMN payment_datetime,
    DROP COLUMN reserved_table_id,
    MODIFY COLUMN table_id INT NULL AFTER store_id,
    ADD COLUMN booking_price DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER people_count,
    MODIFY COLUMN total_price DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER booking_price,
    MODIFY COLUMN status ENUM('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW') NOT NULL DEFAULT 'PENDING' AFTER total_price,
    MODIFY COLUMN slip_image VARCHAR(255) NULL AFTER status,
    MODIFY COLUMN created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER slip_image,
    ADD CONSTRAINT chk_booking_base_price CHECK (booking_price >= 0),
    ADD INDEX idx_booking_table_date (table_id, booking_date, status);
