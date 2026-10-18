ALTER TABLE password_reset_otps
    ADD COLUMN IF NOT EXISTS verified_at DATETIME(3) NULL AFTER expires_at,
    ADD COLUMN IF NOT EXISTS reset_token_hash CHAR(64) NULL AFTER verified_at,
    ADD COLUMN IF NOT EXISTS reset_token_expires_at DATETIME(3) NULL AFTER reset_token_hash,
    ADD UNIQUE INDEX IF NOT EXISTS uq_password_reset_token_hash (reset_token_hash);
