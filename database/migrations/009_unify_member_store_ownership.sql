SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- Store ownership is derived from stores.owner_user_id. It is not an account role.
-- Revoke legacy owner sessions because their JWT role claim is no longer valid.
UPDATE refresh_tokens rt
INNER JOIN users u ON u.id = rt.user_id
SET rt.revoked_at = COALESCE(rt.revoked_at, UTC_TIMESTAMP(3))
WHERE u.role = 'owner';

UPDATE users
SET role = 'member', updated_at = UTC_TIMESTAMP(3)
WHERE role = 'owner';

ALTER TABLE users
    MODIFY COLUMN role ENUM('member', 'admin') NOT NULL DEFAULT 'member';
