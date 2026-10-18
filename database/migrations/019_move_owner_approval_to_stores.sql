SET NAMES utf8mb4;
SET time_zone = '+00:00';

ALTER TABLE stores
    ADD COLUMN approval_status ENUM('PENDING', 'APPROVED', 'REJECTED')
        NOT NULL DEFAULT 'PENDING' AFTER status,
    ADD KEY idx_stores_approval_status (approval_status, created_at);

UPDATE stores s
LEFT JOIN owner_applications oa ON oa.store_id = s.store_id
SET s.approval_status = CASE
    WHEN oa.status IN ('PENDING', 'APPROVED', 'REJECTED') THEN oa.status
    WHEN s.status = 'REJECTED' THEN 'REJECTED'
    WHEN s.status = 'PENDING' THEN 'PENDING'
    ELSE 'APPROVED'
END;

DROP TABLE owner_applications;
