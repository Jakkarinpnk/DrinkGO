SET NAMES utf8mb4;
SET time_zone = '+00:00';

UPDATE users
SET account_status = CASE
    WHEN is_active = 0 THEN 'SUSPENDED'
    ELSE 'ACTIVE'
END
WHERE deleted_at IS NULL;

UPDATE users
SET role = 'member'
WHERE role = 'user' OR role IS NULL;

ALTER TABLE users
    MODIFY COLUMN email VARCHAR(191) NOT NULL,
    MODIFY COLUMN full_name VARCHAR(150) NOT NULL,
    MODIFY COLUMN role ENUM('member', 'owner', 'admin') NOT NULL DEFAULT 'member',
    MODIFY COLUMN account_status ENUM('ACTIVE', 'SUSPENDED', 'BANNED') NOT NULL DEFAULT 'ACTIVE';

INSERT IGNORE INTO auth_identities (
    user_id,
    provider,
    provider_subject,
    provider_email,
    provider_email_verified
)
SELECT
    id,
    'LOCAL',
    LOWER(TRIM(email)),
    LOWER(TRIM(email)),
    CASE WHEN email_verified_at IS NULL THEN 0 ELSE 1 END
FROM users
WHERE password_hash IS NOT NULL
  AND deleted_at IS NULL;

INSERT IGNORE INTO auth_identities (
    user_id,
    provider,
    provider_subject,
    provider_email,
    provider_email_verified
)
SELECT
    id,
    'GOOGLE',
    google_id,
    LOWER(TRIM(email)),
    1
FROM users
WHERE google_id IS NOT NULL
  AND deleted_at IS NULL;

ALTER TABLE refresh_tokens
    MODIFY COLUMN token VARCHAR(512) NULL;

UPDATE refresh_tokens
SET session_id = COALESCE(session_id, UUID()),
    token_hash = COALESCE(token_hash, SHA2(token, 256)),
    revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP(3)),
    token = NULL
WHERE token_hash IS NULL OR session_id IS NULL OR token IS NOT NULL;

ALTER TABLE refresh_tokens
    MODIFY COLUMN session_id CHAR(36) NOT NULL,
    MODIFY COLUMN token_hash CHAR(64) NOT NULL;
