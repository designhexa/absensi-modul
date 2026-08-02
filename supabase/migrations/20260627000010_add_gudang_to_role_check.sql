-- Migration: Allow 'gudang' as a valid role in users table
-- Date: 2026-07-25
-- Fix: users_role_check constraint was blocking role='gudang' inserts/updates
--
-- Idempoten: hanya drop & re-add constraint jika role 'gudang' BELUM
-- diizinkan. Jika constraint sudah ada (mis. dari migrasi 00000011 atau data
-- yang lebih baru), migrasi ini dilewati agar tidak gagal menambahkan
-- constraint dengan daftar role yang lebih pendek dari data yang ada.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname IN ('users_role_check', 'check_role')
      AND pg_get_constraintdef(oid) LIKE '%''gudang''%'
  ) THEN
    -- Drop old check constraint
    ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
    ALTER TABLE users DROP CONSTRAINT IF EXISTS check_role;

    -- Re-add constraint with 'gudang' included
    ALTER TABLE users
      ADD CONSTRAINT users_role_check
      CHECK (role IN ('admin', 'outlet', 'produksi', 'gudang'));
  END IF;
END $$;
