-- Migration: Add unique constraint on users.username
-- Date: 2026-06-27

-- First clean up any duplicate usernames (keep the one with karyawan_id if available)
DELETE FROM users a USING users b 
WHERE a.username = b.username 
  AND a.karyawan_id IS NULL 
  AND b.karyawan_id IS NOT NULL;

DELETE FROM users a USING users b 
WHERE a.username = b.username 
  AND a.ctid < b.ctid;

-- Add unique constraint (idempotent: lewati jika sudah ada)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_username_unique'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_username_unique UNIQUE (username);
  END IF;
END $$;
