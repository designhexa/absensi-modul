-- Migration: Allow 'tl' (Tenaga Lapangan) as a valid role in users table
-- Date: 2026-08-02
-- TL role: read-only akses ke Rekap OH & Omset per outlet serta Request & Retur
--
-- Idempoten: hanya drop & re-add constraint jika role 'tl' BELUM diizinkan.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname IN ('users_role_check', 'check_role')
      AND pg_get_constraintdef(oid) LIKE '%''tl''%'
  ) THEN
    -- Drop old check constraint (name may vary; try both common names)
    ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
    ALTER TABLE users DROP CONSTRAINT IF EXISTS check_role;

    -- Re-add constraint with 'tl' included
    ALTER TABLE users
      ADD CONSTRAINT users_role_check
      CHECK (role IN ('admin', 'outlet', 'produksi', 'gudang', 'tl'));
  END IF;
END $$;
