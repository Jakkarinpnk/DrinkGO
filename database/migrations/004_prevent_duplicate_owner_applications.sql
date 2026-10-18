SET NAMES utf8mb4;
SET time_zone = '+00:00';

ALTER TABLE owner_applications
    ADD UNIQUE INDEX IF NOT EXISTS uq_owner_applications_applicant (applicant_user_id);
