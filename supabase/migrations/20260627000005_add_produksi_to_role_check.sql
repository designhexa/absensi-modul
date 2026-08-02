-- Migration: Allow 'produksi' as a valid role in users table
-- Date: 2026-06-27
-- Fix: users_role_check constraint was blocking role='produksi' inserts
--
-- Idempoten: hanya drop & re-add constraint jika role 'produksi' BELUM
-- diizinkan. Jika constraint sudah ada (baik dari migrasi berikutnya maupun
-- data yang lebih baru), migrasi ini dilewati agar tidak gagal menambahkan
-- constraint dengan daftar role yang lebih pendek dari data yang ada.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname IN ('users_role_check', 'check_role')
      AND pg_get_constraintdef(oid) LIKE '%''produksi''%'
  ) THEN
    -- Drop old check constraint (name may vary; try both common names)
    ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
    ALTER TABLE users DROP CONSTRAINT IF EXISTS check_role;

    -- Re-add constraint with 'produksi' included
    ALTER TABLE users
      ADD CONSTRAINT users_role_check
      CHECK (role IN ('admin', 'outlet', 'produksi'));
  END IF;
END $$;
