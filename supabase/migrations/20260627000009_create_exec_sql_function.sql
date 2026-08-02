-- Migration: Create exec_sql function for running SQL via RPC
-- Date: 2026-06-27 (updated 2026-08-02)
-- ⚠️ SECURITY: Hanya grant EXECUTE ke service_role (bukan anon/authenticated).
--   Script run-migration.ts membaca VITE_SUPABASE_SERVICE_ROLE_KEY dari .env.
--   Jangan pernah grant ke anon — anon key bersifat publik di sisi klien!
--
-- Cara mendapatkan service_role key:
--   Supabase Dashboard → Project Settings → API → service_role key
--   Tambahkan ke .env: VITE_SUPABASE_SERVICE_ROLE_KEY=eyJ...
--
-- ⚠️ PENTING: search_path HARUS = public (bukan '').
--   Versi lama pakai SET search_path = '' → semua migrasi yang menyebut tabel
--   tanpa skema (ALTER TABLE users, dst.) gagal dengan "relation does not exist".
--   Dengan search_path = public, referensi tabel tanpa skema berfungsi normal.
--   Nama fungsi di-qualify eksplisit (public.exec_sql) agar aman saat dibuat
--   lewat fungsi lama yang search_path-nya masih kosong.

CREATE OR REPLACE FUNCTION public.exec_sql(sql_text text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  EXECUTE sql_text;
END;
$$;

-- ⛔ Hanya service_role — aman untuk script server-side
GRANT EXECUTE ON FUNCTION public.exec_sql TO service_role;
