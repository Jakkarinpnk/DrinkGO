SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- Admins are operational accounts and are intentionally separated from public users.
CREATE TABLE admins (
    admin_id INT NOT NULL AUTO_INCREMENT,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(191) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    phone_number VARCHAR(20) NULL,
    admin_status ENUM('ACTIVE', 'SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (admin_id),
    UNIQUE KEY uq_admins_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO admins
    (admin_id, full_name, email, password_hash, phone_number, admin_status, created_at)
SELECT
    id,
    full_name,
    email,
    password_hash,
    phone,
    CASE WHEN account_status = 'ACTIVE' AND deleted_at IS NULL THEN 'ACTIVE' ELSE 'SUSPENDED' END,
    created_at
FROM users
WHERE role = 'admin';

-- Admin sessions use their own table so an admin_id can safely overlap a user_id.
CREATE TABLE admin_refresh_tokens (
    id INT NOT NULL AUTO_INCREMENT,
    admin_id INT NOT NULL,
    session_id CHAR(36) NOT NULL,
    token_hash CHAR(64) NOT NULL,
    token VARCHAR(512) NULL,
    expires_at DATETIME NOT NULL,
    revoked_at DATETIME(3) NULL,
    replaced_by_token_id INT NULL,
    ip_address VARCHAR(45) NULL,
    user_agent VARCHAR(500) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_admin_refresh_tokens_hash (token_hash),
    UNIQUE KEY uq_admin_refresh_tokens_legacy_token (token),
    KEY idx_admin_refresh_tokens_session (admin_id, session_id),
    KEY idx_admin_refresh_tokens_expiry (expires_at),
    CONSTRAINT fk_admin_refresh_tokens_admin
        FOREIGN KEY (admin_id) REFERENCES admins(admin_id) ON DELETE CASCADE,
    CONSTRAINT fk_admin_refresh_tokens_replacement
        FOREIGN KEY (replaced_by_token_id) REFERENCES admin_refresh_tokens(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO admin_refresh_tokens
    (id, admin_id, session_id, token_hash, token, expires_at, revoked_at,
     replaced_by_token_id, ip_address, user_agent, created_at)
SELECT
    rt.id, rt.user_id, rt.session_id, rt.token_hash, rt.token, rt.expires_at, rt.revoked_at,
    NULL, rt.ip_address, rt.user_agent, rt.created_at
FROM refresh_tokens rt
INNER JOIN users u ON u.id = rt.user_id
WHERE u.role = 'admin';

UPDATE admin_refresh_tokens art
INNER JOIN refresh_tokens rt ON rt.id = art.id
INNER JOIN admin_refresh_tokens replacement ON replacement.id = rt.replaced_by_token_id
SET art.replaced_by_token_id = replacement.id;

DELETE rt
FROM refresh_tokens rt
INNER JOIN users u ON u.id = rt.user_id
WHERE u.role = 'admin';

-- Columns that are exclusively review/administration actions now reference admins.
ALTER TABLE stores
    DROP FOREIGN KEY fk_stores_reviewer,
    CHANGE COLUMN reviewed_by_user_id reviewed_by_admin_id INT NULL;
ALTER TABLE stores
    ADD CONSTRAINT fk_stores_reviewer_admin
        FOREIGN KEY (reviewed_by_admin_id) REFERENCES admins(admin_id) ON DELETE SET NULL;

ALTER TABLE owner_applications
    DROP FOREIGN KEY fk_owner_applications_reviewer,
    CHANGE COLUMN reviewed_by_user_id reviewed_by_admin_id INT NULL;
ALTER TABLE owner_applications
    ADD CONSTRAINT fk_owner_applications_reviewer_admin
        FOREIGN KEY (reviewed_by_admin_id) REFERENCES admins(admin_id) ON DELETE SET NULL;

ALTER TABLE store_documents
    DROP FOREIGN KEY fk_store_documents_reviewer,
    CHANGE COLUMN reviewed_by_user_id reviewed_by_admin_id INT NULL;
ALTER TABLE store_documents
    ADD CONSTRAINT fk_store_documents_reviewer_admin
        FOREIGN KEY (reviewed_by_admin_id) REFERENCES admins(admin_id) ON DELETE SET NULL;

ALTER TABLE store_reports
    DROP FOREIGN KEY fk_store_reports_admin,
    CHANGE COLUMN assigned_admin_user_id assigned_admin_id INT NULL;
ALTER TABLE store_reports
    ADD CONSTRAINT fk_store_reports_assigned_admin
        FOREIGN KEY (assigned_admin_id) REFERENCES admins(admin_id) ON DELETE SET NULL;

-- Tables whose actor can be either a public user or an admin keep separate foreign keys.
ALTER TABLE audit_logs ADD COLUMN actor_admin_id INT NULL AFTER actor_user_id;
UPDATE audit_logs al
INNER JOIN users u ON u.id = al.actor_user_id AND u.role = 'admin'
SET al.actor_admin_id = al.actor_user_id, al.actor_user_id = NULL;
ALTER TABLE audit_logs
    ADD KEY idx_audit_logs_admin (actor_admin_id, created_at),
    ADD CONSTRAINT fk_audit_logs_admin
        FOREIGN KEY (actor_admin_id) REFERENCES admins(admin_id) ON DELETE SET NULL;

ALTER TABLE files ADD COLUMN uploader_admin_id INT NULL AFTER uploader_user_id;
UPDATE files f
INNER JOIN users u ON u.id = f.uploader_user_id AND u.role = 'admin'
SET f.uploader_admin_id = f.uploader_user_id, f.uploader_user_id = NULL;
ALTER TABLE files
    ADD CONSTRAINT fk_files_uploader_admin
        FOREIGN KEY (uploader_admin_id) REFERENCES admins(admin_id) ON DELETE SET NULL;

ALTER TABLE notifications
    MODIFY COLUMN user_id INT NULL,
    ADD COLUMN admin_id INT NULL AFTER user_id;
UPDATE notifications n
INNER JOIN users u ON u.id = n.user_id AND u.role = 'admin'
SET n.admin_id = n.user_id, n.user_id = NULL;
ALTER TABLE notifications
    ADD CONSTRAINT fk_notifications_admin
        FOREIGN KEY (admin_id) REFERENCES admins(admin_id) ON DELETE CASCADE;

ALTER TABLE report_messages
    MODIFY COLUMN sender_user_id INT NULL,
    ADD COLUMN sender_admin_id INT NULL AFTER sender_user_id;
UPDATE report_messages rm
INNER JOIN users u ON u.id = rm.sender_user_id AND u.role = 'admin'
SET rm.sender_admin_id = rm.sender_user_id, rm.sender_user_id = NULL;
ALTER TABLE report_messages
    ADD CONSTRAINT fk_report_messages_admin
        FOREIGN KEY (sender_admin_id) REFERENCES admins(admin_id) ON DELETE RESTRICT;

ALTER TABLE reservations ADD COLUMN no_show_marked_by_admin_id INT NULL AFTER no_show_marked_by_user_id;
UPDATE reservations r
INNER JOIN users u ON u.id = r.no_show_marked_by_user_id AND u.role = 'admin'
SET r.no_show_marked_by_admin_id = r.no_show_marked_by_user_id, r.no_show_marked_by_user_id = NULL;
ALTER TABLE reservations
    ADD CONSTRAINT fk_reservations_no_show_admin
        FOREIGN KEY (no_show_marked_by_admin_id) REFERENCES admins(admin_id) ON DELETE SET NULL;

ALTER TABLE reservation_status_history ADD COLUMN changed_by_admin_id INT NULL AFTER changed_by_user_id;
UPDATE reservation_status_history rsh
INNER JOIN users u ON u.id = rsh.changed_by_user_id AND u.role = 'admin'
SET rsh.changed_by_admin_id = rsh.changed_by_user_id, rsh.changed_by_user_id = NULL;
ALTER TABLE reservation_status_history
    ADD CONSTRAINT fk_reservation_status_history_admin
        FOREIGN KEY (changed_by_admin_id) REFERENCES admins(admin_id) ON DELETE SET NULL;

ALTER TABLE store_payment_accounts
    MODIFY COLUMN created_by_user_id INT NULL,
    ADD COLUMN created_by_admin_id INT NULL AFTER created_by_user_id;
UPDATE store_payment_accounts spa
INNER JOIN users u ON u.id = spa.created_by_user_id AND u.role = 'admin'
SET spa.created_by_admin_id = spa.created_by_user_id, spa.created_by_user_id = NULL;
ALTER TABLE store_payment_accounts
    ADD CONSTRAINT fk_store_payment_accounts_admin
        FOREIGN KEY (created_by_admin_id) REFERENCES admins(admin_id) ON DELETE RESTRICT;

ALTER TABLE store_status_history ADD COLUMN changed_by_admin_id INT NULL AFTER changed_by_user_id;
UPDATE store_status_history ssh
INNER JOIN users u ON u.id = ssh.changed_by_user_id AND u.role = 'admin'
SET ssh.changed_by_admin_id = ssh.changed_by_user_id, ssh.changed_by_user_id = NULL;
ALTER TABLE store_status_history
    ADD CONSTRAINT fk_store_status_history_admin
        FOREIGN KEY (changed_by_admin_id) REFERENCES admins(admin_id) ON DELETE SET NULL;

ALTER TABLE table_slot_blocks
    MODIFY COLUMN created_by_user_id INT NULL,
    ADD COLUMN created_by_admin_id INT NULL AFTER created_by_user_id;
UPDATE table_slot_blocks tsb
INNER JOIN users u ON u.id = tsb.created_by_user_id AND u.role = 'admin'
SET tsb.created_by_admin_id = tsb.created_by_user_id, tsb.created_by_user_id = NULL;
ALTER TABLE table_slot_blocks
    ADD CONSTRAINT fk_table_slot_blocks_admin
        FOREIGN KEY (created_by_admin_id) REFERENCES admins(admin_id) ON DELETE RESTRICT;

-- Google is represented directly by users.google_id in the approved account model.
UPDATE users u
INNER JOIN auth_identities ai ON ai.user_id = u.id AND ai.provider = 'GOOGLE'
SET u.google_id = COALESCE(u.google_id, ai.provider_subject)
WHERE u.role <> 'admin';

DELETE ev
FROM email_verifications ev
INNER JOIN users u ON u.id = ev.user_id
WHERE u.role = 'admin';

DELETE pro
FROM password_reset_otps pro
INNER JOIN users u ON u.id = pro.user_id
WHERE u.role = 'admin';

DROP TABLE auth_identities;

-- Admin rows have been copied and every admin reference has been moved above.
DELETE FROM users WHERE role = 'admin';

-- Restore the owner role for every user who has at least one approved active store.
ALTER TABLE users
    MODIFY COLUMN role ENUM('member', 'owner', 'admin') NOT NULL DEFAULT 'member';

UPDATE users u
SET u.role = CASE
    WHEN EXISTS (
        SELECT 1
        FROM stores s
        WHERE s.owner_user_id = u.id
          AND s.approval_status = 'APPROVED'
          AND s.deleted_at IS NULL
    ) THEN 'owner'
    ELSE 'member'
END;

UPDATE users
SET profile_image_url = COALESCE(profile_image_url, NULLIF(profile_img, ''));

UPDATE users
SET account_status = CASE
    WHEN account_status = 'ACTIVE' AND deleted_at IS NULL AND COALESCE(is_active, 1) = 1
      THEN 'ACTIVE'
    ELSE 'SUSPENDED'
END;

-- Renaming a referenced key must use InnoDB's in-place algorithm on MariaDB.
ALTER TABLE users
    ALGORITHM=INPLACE,
    CHANGE COLUMN id user_id INT NOT NULL AUTO_INCREMENT;

-- Final public user table contains exactly the approved account columns.
ALTER TABLE users
    CHANGE COLUMN phone phone_number VARCHAR(20) NULL,
    CHANGE COLUMN profile_image_url profile_image VARCHAR(500) NULL,
    MODIFY COLUMN role ENUM('member', 'owner') NOT NULL DEFAULT 'member',
    MODIFY COLUMN account_status ENUM('ACTIVE', 'SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
    DROP COLUMN profile_img,
    DROP COLUMN email_verified_at,
    DROP COLUMN suspended_until,
    DROP COLUMN suspension_reason,
    DROP COLUMN password_changed_at,
    DROP COLUMN last_login_at,
    DROP COLUMN is_active,
    DROP COLUMN updated_at,
    DROP COLUMN deleted_at;
