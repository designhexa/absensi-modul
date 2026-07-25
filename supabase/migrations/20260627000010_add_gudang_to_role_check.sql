-- Migration: Allow 'gudang' as a valid role in users table
-- Date: 2026-07-25
-- Fix: users_role_check constraint was blocking role='gudang' inserts/updates

-- Drop old check constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users DROP CONSTRAINT IF EXISTS check_role;

-- Re-add constraint with 'gudang' included
ALTER TABLE users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'outlet', 'produksi', 'gudang'));
