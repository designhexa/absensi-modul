-- Allow the browser client (anon/authenticated) to use the attendance tables.
-- Run this in Supabase SQL Editor if RLS currently hides the seeded rows.

alter table public.departemen enable row level security;
alter table public.karyawan enable row level security;
alter table public.users enable row level security;
alter table public.absensi enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'departemen' and policyname = 'absensi_departemen_access') then
    create policy absensi_departemen_access on public.departemen for all to anon, authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'karyawan' and policyname = 'absensi_karyawan_access') then
    create policy absensi_karyawan_access on public.karyawan for all to anon, authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'users' and policyname = 'absensi_users_access') then
    create policy absensi_users_access on public.users for all to anon, authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'absensi' and policyname = 'absensi_records_access') then
    create policy absensi_records_access on public.absensi for all to anon, authenticated using (true) with check (true);
  end if;
end
$$;
