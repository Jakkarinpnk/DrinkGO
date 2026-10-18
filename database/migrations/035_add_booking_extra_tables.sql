SET NAMES utf8mb4;

-- Keep booking's twelve columns unchanged. One booking owns the total guest count;
-- its table_id is the first table and these rows reserve any additional tables.
CREATE TABLE booking_extra_tables (
    booking_id BIGINT UNSIGNED NOT NULL,
    table_id INT NOT NULL,
    PRIMARY KEY (booking_id, table_id),
    KEY idx_booking_extra_tables_table (table_id),
    CONSTRAINT fk_booking_extra_tables_booking FOREIGN KEY (booking_id)
        REFERENCES booking(booking_id) ON DELETE CASCADE,
    CONSTRAINT fk_booking_extra_tables_table FOREIGN KEY (table_id)
        REFERENCES store_tables(table_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
