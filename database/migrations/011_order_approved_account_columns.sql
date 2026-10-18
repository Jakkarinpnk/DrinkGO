SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- Keep the physical column order aligned with the approved Data Dictionary.
ALTER TABLE users
    MODIFY COLUMN full_name VARCHAR(150) NOT NULL AFTER user_id,
    MODIFY COLUMN email VARCHAR(191) NOT NULL AFTER full_name,
    MODIFY COLUMN password_hash VARCHAR(255) NULL AFTER email,
    MODIFY COLUMN phone_number VARCHAR(20) NULL AFTER password_hash,
    MODIFY COLUMN profile_image VARCHAR(500) NULL AFTER phone_number,
    MODIFY COLUMN google_id VARCHAR(255) NULL AFTER profile_image,
    MODIFY COLUMN role ENUM('member', 'owner') NOT NULL DEFAULT 'member' AFTER google_id,
    MODIFY COLUMN account_status ENUM('ACTIVE', 'SUSPENDED') NOT NULL DEFAULT 'ACTIVE' AFTER role,
    MODIFY COLUMN created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER account_status;
