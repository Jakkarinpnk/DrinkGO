SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS users (
    id INT NOT NULL AUTO_INCREMENT,
    email VARCHAR(191) NOT NULL,
    password_hash VARCHAR(255) NULL,
    google_id VARCHAR(191) NULL,
    full_name VARCHAR(150) NOT NULL,
    phone VARCHAR(20) NULL,
    profile_img TEXT NULL,
    profile_image_url VARCHAR(500) NULL,
    role ENUM('user', 'member', 'owner', 'admin') NOT NULL DEFAULT 'member',
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    account_status ENUM('ACTIVE', 'SUSPENDED', 'BANNED') NOT NULL DEFAULT 'ACTIVE',
    email_verified_at DATETIME(3) NULL,
    suspended_until DATETIME(3) NULL,
    suspension_reason VARCHAR(500) NULL,
    password_changed_at DATETIME(3) NULL,
    last_login_at DATETIME(3) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    deleted_at DATETIME(3) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_users_email (email),
    UNIQUE KEY uq_users_google_id (google_id),
    KEY idx_users_role_status (role, account_status),
    KEY idx_users_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS profile_image_url VARCHAR(500) NULL AFTER profile_img,
    ADD COLUMN IF NOT EXISTS account_status ENUM('ACTIVE', 'SUSPENDED', 'BANNED') NOT NULL DEFAULT 'ACTIVE' AFTER role,
    ADD COLUMN IF NOT EXISTS email_verified_at DATETIME(3) NULL AFTER account_status,
    ADD COLUMN IF NOT EXISTS suspended_until DATETIME(3) NULL AFTER email_verified_at,
    ADD COLUMN IF NOT EXISTS suspension_reason VARCHAR(500) NULL AFTER suspended_until,
    ADD COLUMN IF NOT EXISTS password_changed_at DATETIME(3) NULL AFTER suspension_reason,
    ADD COLUMN IF NOT EXISTS last_login_at DATETIME(3) NULL AFTER password_changed_at,
    ADD COLUMN IF NOT EXISTS deleted_at DATETIME(3) NULL AFTER updated_at,
    ADD INDEX IF NOT EXISTS idx_users_role_status (role, account_status),
    ADD INDEX IF NOT EXISTS idx_users_deleted_at (deleted_at);

CREATE TABLE auth_identities (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id INT NOT NULL,
    provider ENUM('LOCAL', 'GOOGLE') NOT NULL,
    provider_subject VARCHAR(191) NOT NULL,
    provider_email VARCHAR(191) NULL,
    provider_email_verified TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uq_auth_identity_provider_subject (provider, provider_subject),
    UNIQUE KEY uq_auth_identity_user_provider (user_id, provider),
    CONSTRAINT fk_auth_identities_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id INT NOT NULL AUTO_INCREMENT,
    user_id INT NOT NULL,
    token VARCHAR(512) NULL,
    session_id CHAR(36) NULL,
    token_hash CHAR(64) NULL,
    expires_at DATETIME(3) NOT NULL,
    revoked_at DATETIME(3) NULL,
    replaced_by_token_id INT NULL,
    ip_address VARCHAR(45) NULL,
    user_agent VARCHAR(500) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uq_refresh_tokens_hash (token_hash),
    KEY idx_refresh_tokens_user_session (user_id, session_id),
    KEY idx_refresh_tokens_expires_at (expires_at),
    CONSTRAINT fk_refresh_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_refresh_tokens_replacement FOREIGN KEY (replaced_by_token_id) REFERENCES refresh_tokens(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE refresh_tokens
    ADD COLUMN IF NOT EXISTS session_id CHAR(36) NULL AFTER user_id,
    ADD COLUMN IF NOT EXISTS token_hash CHAR(64) NULL AFTER session_id,
    ADD COLUMN IF NOT EXISTS revoked_at DATETIME(3) NULL AFTER expires_at,
    ADD COLUMN IF NOT EXISTS replaced_by_token_id INT NULL AFTER revoked_at,
    ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45) NULL AFTER replaced_by_token_id,
    ADD COLUMN IF NOT EXISTS user_agent VARCHAR(500) NULL AFTER ip_address,
    ADD UNIQUE INDEX IF NOT EXISTS uq_refresh_tokens_hash (token_hash),
    ADD INDEX IF NOT EXISTS idx_refresh_tokens_user_session (user_id, session_id),
    ADD INDEX IF NOT EXISTS idx_refresh_tokens_expires_at (expires_at);

CREATE TABLE password_reset_otps (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id INT NOT NULL,
    otp_hash CHAR(64) NOT NULL,
    expires_at DATETIME(3) NOT NULL,
    used_at DATETIME(3) NULL,
    attempt_count SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    requested_ip VARCHAR(45) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    KEY idx_password_reset_user_created (user_id, created_at),
    KEY idx_password_reset_expires_at (expires_at),
    CONSTRAINT fk_password_reset_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE email_verifications (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id INT NOT NULL,
    pending_email VARCHAR(191) NULL,
    token_hash CHAR(64) NOT NULL,
    expires_at DATETIME(3) NOT NULL,
    verified_at DATETIME(3) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uq_email_verifications_token_hash (token_hash),
    KEY idx_email_verifications_user (user_id, created_at),
    CONSTRAINT fk_email_verifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE files (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    uploader_user_id INT NULL,
    file_kind ENUM('PROFILE_IMAGE', 'STORE_IMAGE', 'BUSINESS_DOCUMENT', 'MENU', 'PAYMENT_SLIP', 'REPORT_ATTACHMENT') NOT NULL,
    storage_key VARCHAR(500) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    size_bytes BIGINT UNSIGNED NOT NULL,
    sha256 CHAR(64) NOT NULL,
    scan_status ENUM('PENDING', 'CLEAN', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    deleted_at DATETIME(3) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_files_storage_key (storage_key),
    KEY idx_files_uploader_kind (uploader_user_id, file_kind),
    KEY idx_files_sha256 (sha256),
    CONSTRAINT fk_files_uploader FOREIGN KEY (uploader_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE store_categories (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(120) NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uq_store_categories_name (name),
    UNIQUE KEY uq_store_categories_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE stores (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    owner_user_id INT NOT NULL,
    name VARCHAR(180) NOT NULL,
    slug VARCHAR(191) NOT NULL,
    description TEXT NULL,
    phone VARCHAR(20) NOT NULL,
    line_url VARCHAR(500) NOT NULL,
    address_line TEXT NOT NULL,
    subdistrict VARCHAR(120) NULL,
    district VARCHAR(120) NULL,
    province VARCHAR(120) NOT NULL,
    postal_code VARCHAR(10) NULL,
    latitude DECIMAL(10,7) NOT NULL,
    longitude DECIMAL(10,7) NOT NULL,
    google_place_id VARCHAR(255) NULL,
    timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Bangkok',
    approval_status ENUM('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED') NOT NULL DEFAULT 'PENDING',
    service_status ENUM('OPEN', 'CLOSED_TEMPORARILY', 'CLOSED_PERMANENTLY') NOT NULL DEFAULT 'OPEN',
    is_public TINYINT(1) NOT NULL DEFAULT 0,
    reviewed_by_user_id INT NULL,
    reviewed_at DATETIME(3) NULL,
    review_reason VARCHAR(1000) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    deleted_at DATETIME(3) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_stores_slug (slug),
    KEY idx_stores_owner (owner_user_id),
    KEY idx_stores_discovery (approval_status, service_status, is_public),
    KEY idx_stores_location (province, district),
    KEY idx_stores_name (name),
    CONSTRAINT fk_stores_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_stores_reviewer FOREIGN KEY (reviewed_by_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE store_category_mappings (
    store_id BIGINT UNSIGNED NOT NULL,
    category_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (store_id, category_id),
    KEY idx_store_category_category (category_id, store_id),
    CONSTRAINT fk_store_category_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
    CONSTRAINT fk_store_category_category FOREIGN KEY (category_id) REFERENCES store_categories(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE owner_applications (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    applicant_user_id INT NOT NULL,
    store_id BIGINT UNSIGNED NOT NULL,
    status ENUM('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    submitted_at DATETIME(3) NULL,
    reviewed_by_user_id INT NULL,
    reviewed_at DATETIME(3) NULL,
    decision_reason VARCHAR(1000) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uq_owner_applications_store (store_id),
    KEY idx_owner_applications_queue (status, submitted_at),
    KEY idx_owner_applications_applicant (applicant_user_id, created_at),
    CONSTRAINT fk_owner_applications_applicant FOREIGN KEY (applicant_user_id) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_owner_applications_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
    CONSTRAINT fk_owner_applications_reviewer FOREIGN KEY (reviewed_by_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE store_hours (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    store_id BIGINT UNSIGNED NOT NULL,
    day_of_week TINYINT UNSIGNED NOT NULL COMMENT '0=Monday, 6=Sunday',
    is_closed TINYINT(1) NOT NULL DEFAULT 0,
    open_time TIME NULL,
    close_time TIME NULL,
    closes_next_day TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uq_store_hours_day (store_id, day_of_week),
    CONSTRAINT fk_store_hours_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE store_special_days (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    store_id BIGINT UNSIGNED NOT NULL,
    special_date DATE NOT NULL,
    name VARCHAR(150) NULL,
    is_closed TINYINT(1) NOT NULL DEFAULT 1,
    open_time TIME NULL,
    close_time TIME NULL,
    closes_next_day TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uq_store_special_day (store_id, special_date),
    CONSTRAINT fk_store_special_days_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE store_media (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    store_id BIGINT UNSIGNED NOT NULL,
    file_id BIGINT UNSIGNED NOT NULL,
    alt_text VARCHAR(255) NULL,
    sort_order INT UNSIGNED NOT NULL DEFAULT 0,
    is_cover TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uq_store_media_file (store_id, file_id),
    KEY idx_store_media_sort (store_id, is_cover, sort_order),
    CONSTRAINT fk_store_media_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
    CONSTRAINT fk_store_media_file FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE store_documents (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    store_id BIGINT UNSIGNED NOT NULL,
    file_id BIGINT UNSIGNED NOT NULL,
    document_type ENUM('COMMERCIAL_REGISTRATION', 'OTHER') NOT NULL DEFAULT 'COMMERCIAL_REGISTRATION',
    verification_status ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    reviewed_by_user_id INT NULL,
    reviewed_at DATETIME(3) NULL,
    rejection_reason VARCHAR(500) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uq_store_documents_file (store_id, file_id),
    KEY idx_store_documents_verification (store_id, verification_status),
    CONSTRAINT fk_store_documents_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
    CONSTRAINT fk_store_documents_file FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE RESTRICT,
    CONSTRAINT fk_store_documents_reviewer FOREIGN KEY (reviewed_by_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE menu_files (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    store_id BIGINT UNSIGNED NOT NULL,
    file_id BIGINT UNSIGNED NOT NULL,
    title VARCHAR(150) NOT NULL,
    sort_order INT UNSIGNED NOT NULL DEFAULT 0,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    deleted_at DATETIME(3) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_menu_files_file (store_id, file_id),
    KEY idx_menu_files_store_sort (store_id, sort_order),
    CONSTRAINT fk_menu_files_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
    CONSTRAINT fk_menu_files_file FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE store_payment_accounts (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    store_id BIGINT UNSIGNED NOT NULL,
    account_type_code VARCHAR(10) NOT NULL,
    bank_code VARCHAR(10) NULL,
    account_name_th VARCHAR(200) NULL,
    account_name_en VARCHAR(200) NULL,
    account_identifier_encrypted VARBINARY(512) NOT NULL,
    account_identifier_last4 VARCHAR(4) NOT NULL,
    encryption_key_version SMALLINT UNSIGNED NOT NULL DEFAULT 1,
    qr_image_url VARCHAR(500) NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    verified_at DATETIME(3) NULL,
    created_by_user_id INT NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    deleted_at DATETIME(3) NULL,
    PRIMARY KEY (id),
    KEY idx_store_payment_accounts_active (store_id, is_active, deleted_at),
    CONSTRAINT fk_store_payment_accounts_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
    CONSTRAINT fk_store_payment_accounts_creator FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE store_status_history (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    store_id BIGINT UNSIGNED NOT NULL,
    changed_by_user_id INT NULL,
    previous_approval_status ENUM('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED') NULL,
    new_approval_status ENUM('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED') NULL,
    previous_service_status ENUM('OPEN', 'CLOSED_TEMPORARILY', 'CLOSED_PERMANENTLY') NULL,
    new_service_status ENUM('OPEN', 'CLOSED_TEMPORARILY', 'CLOSED_PERMANENTLY') NULL,
    reason VARCHAR(1000) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    KEY idx_store_status_history_store (store_id, created_at),
    CONSTRAINT fk_store_status_history_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
    CONSTRAINT fk_store_status_history_actor FOREIGN KEY (changed_by_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE floor_plans (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    store_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(150) NOT NULL,
    width INT UNSIGNED NOT NULL DEFAULT 1200,
    height INT UNSIGNED NOT NULL DEFAULT 800,
    revision INT UNSIGNED NOT NULL DEFAULT 1,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    deleted_at DATETIME(3) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_floor_plans_store_name_revision (store_id, name, revision),
    KEY idx_floor_plans_active (store_id, is_active, deleted_at),
    CONSTRAINT fk_floor_plans_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE restaurant_tables (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    store_id BIGINT UNSIGNED NOT NULL,
    floor_plan_id BIGINT UNSIGNED NOT NULL,
    table_code VARCHAR(50) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    capacity SMALLINT UNSIGNED NOT NULL,
    booking_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    shape ENUM('RECTANGLE', 'CIRCLE', 'SQUARE') NOT NULL DEFAULT 'RECTANGLE',
    position_x DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    position_y DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    width DECIMAL(10,2) NOT NULL DEFAULT 100.00,
    height DECIMAL(10,2) NOT NULL DEFAULT 100.00,
    rotation_degrees DECIMAL(6,2) NOT NULL DEFAULT 0.00,
    operational_status ENUM('ACTIVE', 'DISABLED', 'MAINTENANCE') NOT NULL DEFAULT 'ACTIVE',
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    deleted_at DATETIME(3) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_restaurant_tables_code (store_id, table_code),
    KEY idx_restaurant_tables_floor (floor_plan_id, operational_status, deleted_at),
    KEY idx_restaurant_tables_capacity (store_id, capacity, operational_status),
    CONSTRAINT fk_restaurant_tables_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
    CONSTRAINT fk_restaurant_tables_floor_plan FOREIGN KEY (floor_plan_id) REFERENCES floor_plans(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE booking_policies (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    store_id BIGINT UNSIGNED NOT NULL,
    slot_duration_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 120,
    payment_hold_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 15,
    late_grace_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 30,
    cancellation_notice_hours SMALLINT UNSIGNED NOT NULL DEFAULT 72,
    minimum_advance_minutes INT UNSIGNED NOT NULL DEFAULT 60,
    maximum_advance_days SMALLINT UNSIGNED NOT NULL DEFAULT 90,
    minimum_party_size SMALLINT UNSIGNED NOT NULL DEFAULT 1,
    maximum_party_size SMALLINT UNSIGNED NULL,
    allow_multiple_tables TINYINT(1) NOT NULL DEFAULT 1,
    is_booking_enabled TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uq_booking_policies_store (store_id),
    CONSTRAINT fk_booking_policies_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE booking_periods (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    store_id BIGINT UNSIGNED NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    KEY idx_booking_periods_store_dates (store_id, start_date, end_date, is_active),
    CONSTRAINT fk_booking_periods_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE booking_slots (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    store_id BIGINT UNSIGNED NOT NULL,
    day_of_week TINYINT UNSIGNED NOT NULL COMMENT '0=Monday, 6=Sunday',
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    ends_next_day TINYINT(1) NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uq_booking_slots_store_day_start (store_id, day_of_week, start_time),
    KEY idx_booking_slots_lookup (store_id, day_of_week, is_active),
    CONSTRAINT fk_booking_slots_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE table_slot_blocks (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    restaurant_table_id BIGINT UNSIGNED NOT NULL,
    booking_date DATE NOT NULL,
    booking_slot_id BIGINT UNSIGNED NOT NULL,
    reason VARCHAR(500) NULL,
    created_by_user_id INT NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uq_table_slot_blocks (restaurant_table_id, booking_date, booking_slot_id),
    KEY idx_table_slot_blocks_date (booking_date, booking_slot_id),
    CONSTRAINT fk_table_slot_blocks_table FOREIGN KEY (restaurant_table_id) REFERENCES restaurant_tables(id) ON DELETE CASCADE,
    CONSTRAINT fk_table_slot_blocks_slot FOREIGN KEY (booking_slot_id) REFERENCES booking_slots(id) ON DELETE CASCADE,
    CONSTRAINT fk_table_slot_blocks_creator FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE promotions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    store_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(180) NOT NULL,
    description TEXT NULL,
    discount_percent DECIMAL(5,2) NOT NULL,
    usage_limit INT UNSIGNED NULL,
    starts_at DATETIME(3) NOT NULL,
    ends_at DATETIME(3) NOT NULL,
    status ENUM('DRAFT', 'ACTIVE', 'INACTIVE', 'EXPIRED') NOT NULL DEFAULT 'DRAFT',
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    deleted_at DATETIME(3) NULL,
    PRIMARY KEY (id),
    KEY idx_promotions_store_period (store_id, status, starts_at, ends_at),
    CONSTRAINT fk_promotions_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE promotion_tables (
    promotion_id BIGINT UNSIGNED NOT NULL,
    restaurant_table_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (promotion_id, restaurant_table_id),
    KEY idx_promotion_tables_table (restaurant_table_id, promotion_id),
    CONSTRAINT fk_promotion_tables_promotion FOREIGN KEY (promotion_id) REFERENCES promotions(id) ON DELETE CASCADE,
    CONSTRAINT fk_promotion_tables_table FOREIGN KEY (restaurant_table_id) REFERENCES restaurant_tables(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE reservations (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    booking_code VARCHAR(32) NOT NULL,
    member_user_id INT NOT NULL,
    store_id BIGINT UNSIGNED NOT NULL,
    booking_slot_id BIGINT UNSIGNED NOT NULL,
    promotion_id BIGINT UNSIGNED NULL,
    booking_date DATE NOT NULL,
    slot_start_at DATETIME(3) NOT NULL,
    slot_end_at DATETIME(3) NOT NULL,
    scheduled_close_at DATETIME(3) NOT NULL,
    party_size SMALLINT UNSIGNED NOT NULL,
    status ENUM('PENDING_PAYMENT', 'PAYMENT_REJECTED', 'CONFIRMED', 'EXPIRED', 'CANCELLED', 'NO_SHOW', 'COMPLETED') NOT NULL DEFAULT 'PENDING_PAYMENT',
    subtotal_amount DECIMAL(10,2) NOT NULL,
    discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    total_amount DECIMAL(10,2) NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'THB',
    payment_hold_minutes SMALLINT UNSIGNED NOT NULL,
    late_grace_minutes SMALLINT UNSIGNED NOT NULL,
    cancellation_notice_hours SMALLINT UNSIGNED NOT NULL,
    payment_account_snapshot JSON NOT NULL,
    promotion_snapshot JSON NULL,
    hold_expires_at DATETIME(3) NOT NULL,
    cancellation_deadline_at DATETIME(3) NOT NULL,
    cancelled_at DATETIME(3) NULL,
    cancellation_reason VARCHAR(500) NULL,
    refund_eligible_by_policy TINYINT(1) NULL,
    no_show_at DATETIME(3) NULL,
    no_show_marked_by_user_id INT NULL,
    completed_at DATETIME(3) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uq_reservations_booking_code (booking_code),
    KEY idx_reservations_member_created (member_user_id, created_at),
    KEY idx_reservations_store_date_status (store_id, booking_date, status),
    KEY idx_reservations_expiring_holds (status, hold_expires_at),
    KEY idx_reservations_auto_complete (status, scheduled_close_at),
    CONSTRAINT fk_reservations_member FOREIGN KEY (member_user_id) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_reservations_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE RESTRICT,
    CONSTRAINT fk_reservations_slot FOREIGN KEY (booking_slot_id) REFERENCES booking_slots(id) ON DELETE RESTRICT,
    CONSTRAINT fk_reservations_promotion FOREIGN KEY (promotion_id) REFERENCES promotions(id) ON DELETE SET NULL,
    CONSTRAINT fk_reservations_no_show_actor FOREIGN KEY (no_show_marked_by_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE reservation_tables (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    reservation_id BIGINT UNSIGNED NOT NULL,
    restaurant_table_id BIGINT UNSIGNED NOT NULL,
    table_code_snapshot VARCHAR(50) NOT NULL,
    display_name_snapshot VARCHAR(100) NOT NULL,
    capacity_snapshot SMALLINT UNSIGNED NOT NULL,
    price_snapshot DECIMAL(10,2) NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uq_reservation_tables_reservation_table (reservation_id, restaurant_table_id),
    KEY idx_reservation_tables_table (restaurant_table_id, reservation_id),
    CONSTRAINT fk_reservation_tables_reservation FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE,
    CONSTRAINT fk_reservation_tables_table FOREIGN KEY (restaurant_table_id) REFERENCES restaurant_tables(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE table_slot_allocations (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    reservation_id BIGINT UNSIGNED NOT NULL,
    restaurant_table_id BIGINT UNSIGNED NOT NULL,
    booking_date DATE NOT NULL,
    booking_slot_id BIGINT UNSIGNED NOT NULL,
    allocated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uq_table_slot_allocation (restaurant_table_id, booking_date, booking_slot_id),
    KEY idx_table_slot_allocations_reservation (reservation_id),
    KEY idx_table_slot_allocations_lookup (booking_date, booking_slot_id),
    CONSTRAINT fk_table_slot_allocations_reservation FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE,
    CONSTRAINT fk_table_slot_allocations_table FOREIGN KEY (restaurant_table_id) REFERENCES restaurant_tables(id) ON DELETE RESTRICT,
    CONSTRAINT fk_table_slot_allocations_slot FOREIGN KEY (booking_slot_id) REFERENCES booking_slots(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE reservation_status_history (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    reservation_id BIGINT UNSIGNED NOT NULL,
    from_status ENUM('PENDING_PAYMENT', 'PAYMENT_REJECTED', 'CONFIRMED', 'EXPIRED', 'CANCELLED', 'NO_SHOW', 'COMPLETED') NULL,
    to_status ENUM('PENDING_PAYMENT', 'PAYMENT_REJECTED', 'CONFIRMED', 'EXPIRED', 'CANCELLED', 'NO_SHOW', 'COMPLETED') NOT NULL,
    changed_by_user_id INT NULL,
    reason VARCHAR(500) NULL,
    metadata_json JSON NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    KEY idx_reservation_status_history (reservation_id, created_at),
    CONSTRAINT fk_reservation_status_history_reservation FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE,
    CONSTRAINT fk_reservation_status_history_actor FOREIGN KEY (changed_by_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE promotion_redemptions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    promotion_id BIGINT UNSIGNED NOT NULL,
    reservation_id BIGINT UNSIGNED NOT NULL,
    member_user_id INT NOT NULL,
    discount_amount DECIMAL(10,2) NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uq_promotion_redemptions_reservation (reservation_id),
    KEY idx_promotion_redemptions_usage (promotion_id, created_at),
    CONSTRAINT fk_promotion_redemptions_promotion FOREIGN KEY (promotion_id) REFERENCES promotions(id) ON DELETE RESTRICT,
    CONSTRAINT fk_promotion_redemptions_reservation FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE,
    CONSTRAINT fk_promotion_redemptions_member FOREIGN KEY (member_user_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE payments (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    reservation_id BIGINT UNSIGNED NOT NULL,
    slip_file_id BIGINT UNSIGNED NOT NULL,
    provider ENUM('SLIP2GO') NOT NULL DEFAULT 'SLIP2GO',
    status ENUM('PENDING', 'VERIFYING', 'VERIFIED', 'REJECTED', 'ERROR') NOT NULL DEFAULT 'PENDING',
    idempotency_key VARCHAR(100) NOT NULL,
    slip2go_code VARCHAR(20) NULL,
    slip2go_message VARCHAR(500) NULL,
    slip2go_reference_id VARCHAR(191) NULL,
    trans_ref VARCHAR(191) NULL,
    verified_amount DECIMAL(10,2) NULL,
    transferred_at DATETIME(3) NULL,
    receiver_snapshot JSON NULL,
    provider_response JSON NULL,
    verification_attempts SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    last_verified_at DATETIME(3) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uq_payments_idempotency_key (idempotency_key),
    UNIQUE KEY uq_payments_trans_ref (trans_ref),
    UNIQUE KEY uq_payments_slip2go_reference (slip2go_reference_id),
    KEY idx_payments_reservation_created (reservation_id, created_at),
    KEY idx_payments_status_updated (status, updated_at),
    CONSTRAINT fk_payments_reservation FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE RESTRICT,
    CONSTRAINT fk_payments_slip_file FOREIGN KEY (slip_file_id) REFERENCES files(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE reviews (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    reservation_id BIGINT UNSIGNED NOT NULL,
    store_id BIGINT UNSIGNED NOT NULL,
    member_user_id INT NOT NULL,
    comment TEXT NULL,
    status ENUM('PUBLISHED', 'HIDDEN', 'DELETED') NOT NULL DEFAULT 'PUBLISHED',
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    deleted_at DATETIME(3) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_reviews_reservation (reservation_id),
    KEY idx_reviews_store_status (store_id, status, created_at),
    KEY idx_reviews_member (member_user_id, created_at),
    CONSTRAINT fk_reviews_reservation FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE RESTRICT,
    CONSTRAINT fk_reviews_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE RESTRICT,
    CONSTRAINT fk_reviews_member FOREIGN KEY (member_user_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE review_ratings (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    review_id BIGINT UNSIGNED NOT NULL,
    category ENUM('FOOD', 'SERVICE', 'PLACE') NOT NULL,
    rating TINYINT UNSIGNED NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uq_review_ratings_category (review_id, category),
    CONSTRAINT fk_review_ratings_review FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE review_replies (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    review_id BIGINT UNSIGNED NOT NULL,
    owner_user_id INT NOT NULL,
    reply_text TEXT NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    deleted_at DATETIME(3) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_review_replies_review (review_id),
    CONSTRAINT fk_review_replies_review FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE,
    CONSTRAINT fk_review_replies_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE notifications (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id INT NOT NULL,
    notification_type ENUM('BOOKING_CONFIRMED', 'BOOKING_REMINDER', 'BOOKING_CANCELLED', 'PAYMENT_RESULT', 'STORE_APPLICATION', 'STORE_REPORT', 'SYSTEM') NOT NULL,
    title VARCHAR(200) NOT NULL,
    body TEXT NOT NULL,
    action_url VARCHAR(500) NULL,
    unique_key VARCHAR(191) NULL,
    read_at DATETIME(3) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uq_notifications_unique_key (unique_key),
    KEY idx_notifications_user_unread (user_id, read_at, created_at),
    CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE store_reports (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    report_code VARCHAR(32) NOT NULL,
    reporter_user_id INT NOT NULL,
    store_id BIGINT UNSIGNED NOT NULL,
    reservation_id BIGINT UNSIGNED NULL,
    subject VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    status ENUM('OPEN', 'INVESTIGATING', 'WAITING_OWNER', 'RESOLVED', 'DISMISSED') NOT NULL DEFAULT 'OPEN',
    assigned_admin_user_id INT NULL,
    resolved_at DATETIME(3) NULL,
    resolution_note TEXT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uq_store_reports_code (report_code),
    KEY idx_store_reports_queue (status, created_at),
    KEY idx_store_reports_store (store_id, created_at),
    KEY idx_store_reports_reporter (reporter_user_id, created_at),
    CONSTRAINT fk_store_reports_reporter FOREIGN KEY (reporter_user_id) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_store_reports_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE RESTRICT,
    CONSTRAINT fk_store_reports_reservation FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE SET NULL,
    CONSTRAINT fk_store_reports_admin FOREIGN KEY (assigned_admin_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE report_messages (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    store_report_id BIGINT UNSIGNED NOT NULL,
    sender_user_id INT NOT NULL,
    sender_role ENUM('MEMBER', 'OWNER', 'ADMIN') NOT NULL,
    message_text TEXT NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    deleted_at DATETIME(3) NULL,
    PRIMARY KEY (id),
    KEY idx_report_messages_report (store_report_id, created_at),
    CONSTRAINT fk_report_messages_report FOREIGN KEY (store_report_id) REFERENCES store_reports(id) ON DELETE CASCADE,
    CONSTRAINT fk_report_messages_sender FOREIGN KEY (sender_user_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE report_attachments (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    report_message_id BIGINT UNSIGNED NOT NULL,
    file_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uq_report_attachments_file (report_message_id, file_id),
    CONSTRAINT fk_report_attachments_message FOREIGN KEY (report_message_id) REFERENCES report_messages(id) ON DELETE CASCADE,
    CONSTRAINT fk_report_attachments_file FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE audit_logs (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    actor_user_id INT NULL,
    action VARCHAR(120) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id VARCHAR(100) NULL,
    before_data JSON NULL,
    after_data JSON NULL,
    ip_address VARCHAR(45) NULL,
    user_agent VARCHAR(500) NULL,
    request_id VARCHAR(100) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    KEY idx_audit_logs_entity (entity_type, entity_id, created_at),
    KEY idx_audit_logs_actor (actor_user_id, created_at),
    KEY idx_audit_logs_request (request_id),
    CONSTRAINT fk_audit_logs_actor FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE outbox_events (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    aggregate_type VARCHAR(100) NOT NULL,
    aggregate_id VARCHAR(100) NOT NULL,
    event_type VARCHAR(150) NOT NULL,
    payload JSON NOT NULL,
    available_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    processed_at DATETIME(3) NULL,
    attempt_count SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    last_error TEXT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    KEY idx_outbox_events_pending (processed_at, available_at),
    KEY idx_outbox_events_aggregate (aggregate_type, aggregate_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE background_jobs (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    job_type VARCHAR(100) NOT NULL,
    unique_key VARCHAR(191) NULL,
    payload JSON NOT NULL,
    status ENUM('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    run_at DATETIME(3) NOT NULL,
    locked_at DATETIME(3) NULL,
    locked_by VARCHAR(100) NULL,
    attempt_count SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    max_attempts SMALLINT UNSIGNED NOT NULL DEFAULT 5,
    last_error TEXT NULL,
    completed_at DATETIME(3) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uq_background_jobs_unique_key (unique_key),
    KEY idx_background_jobs_claim (status, run_at, locked_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
