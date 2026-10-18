SET NAMES utf8mb4;
SET time_zone = '+00:00';

ALTER TABLE owner_applications
    DROP INDEX IF EXISTS uq_owner_applications_applicant,
    ADD COLUMN IF NOT EXISTS submission_fingerprint CHAR(64) NULL AFTER store_id;

UPDATE owner_applications oa
INNER JOIN stores s ON s.id = oa.store_id
SET oa.submission_fingerprint = SHA2(
    CONCAT_WS('|', LOWER(TRIM(s.name)), TRIM(s.phone), LOWER(TRIM(s.address_line))),
    256
)
WHERE oa.submission_fingerprint IS NULL;

ALTER TABLE owner_applications
    MODIFY COLUMN submission_fingerprint CHAR(64) NOT NULL,
    ADD COLUMN IF NOT EXISTS active_submission_fingerprint CHAR(64)
        AS (
            CASE
                WHEN status IN ('PENDING', 'APPROVED') THEN submission_fingerprint
                ELSE NULL
            END
        ) PERSISTENT,
    ADD UNIQUE INDEX IF NOT EXISTS uq_owner_applications_active_submission
        (applicant_user_id, active_submission_fingerprint);
