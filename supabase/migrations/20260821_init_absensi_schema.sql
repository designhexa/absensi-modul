-- ==========================================
-- Absensi app schema for Supabase
-- ==========================================

create extension if not exists pgcrypto;

-- 1) Outlets
create table if not exists public.outlets (
  id text primary key,
  nama text not null,
  lokasi text not null default '-'
);

-- 2) Karyawan
create table if not exists public.karyawan (
  id text primary key,
  nama text not null,
  posisi text not null default 'Kasir',
  role text not null default 'operational' check (role in ('admin', 'operational', 'development', 'management', 'marketing', 'design', 'finance', 'logistic', 'karyawan')),
  outlet_id text references public.outlets(id) on delete set null,
  gaji_pokok numeric not null default 0,
  bonus_omset numeric not null default 0,
  bonus_ulasan numeric not null default 0,
  bonus_oh numeric not null default 0,
  tunjangan_harian numeric not null default 0,
  overtime_rate numeric not null default 0,
  jam_masuk text,
  jam_pulang text
);

-- 3) Users login/account table
create table if not exists public.users (
  username text primary key,
  password text not null,
  nama text not null,
  role text not null default 'operational' check (role in ('admin', 'operational', 'development', 'management', 'marketing', 'design', 'finance', 'logistic', 'karyawan')),
  outlet_id text references public.outlets(id) on delete set null,
  karyawan_id text references public.karyawan(id) on delete set null
);

-- 4) Absensi
create table if not exists public.absensi (
  id text primary key,
  tanggal date not null,
  karyawan_id text not null references public.karyawan(id) on delete cascade,
  jam_masuk text,
  jam_pulang text,
  status text not null check (status in ('Hadir', 'Izin', 'Sakit', 'Alpha')),
  catatan text,
  bonus numeric not null default 0,
  tunjangan numeric not null default 0,
  overtime numeric not null default 0
);

-- Helpful indexes
create index if not exists idx_karyawan_outlet_id on public.karyawan(outlet_id);
create index if not exists idx_users_outlet_id on public.users(outlet_id);
create index if not exists idx_users_karyawan_id on public.users(karyawan_id);
create index if not exists idx_absensi_karyawan_id on public.absensi(karyawan_id);
create index if not exists idx_absensi_tanggal on public.absensi(tanggal);

-- Optional: enable RLS but leave permissive for initial setup
alter table public.outlets enable row level security;
alter table public.karyawan enable row level security;
alter table public.users enable row level security;
alter table public.absensi enable row level security;

-- Allow anon and authenticated roles to read/write during development.
-- This is intentionally permissive because the app is using the anon key in the browser.
create policy if not exists "Allow all reads/writes for outlets" on public.outlets
for all using (true) with check (true);

create policy if not exists "Allow all reads/writes for karyawan" on public.karyawan
for all using (true) with check (true);

create policy if not exists "Allow all reads/writes for users" on public.users
for all using (true) with check (true);

create policy if not exists "Allow all reads/writes for absensi" on public.absensi
for all using (true) with check (true);

-- Seed default data for quick app startup
insert into public.outlets (id, nama, lokasi)
values
  ('o-gunung-gangsir', 'Gunung Gangsir', '-'),
  ('o-randu-pitu', 'Randu Pitu', '-'),
  ('o-kuti', 'Kuti', '-'),
  ('o-sidohwayah', 'Sidohwayah', '-'),
  ('o-gempeng', 'Gempeng', '-'),
  ('o-kesambi', 'Kesambi', '-'),
  ('o-permata', 'Permata', '-'),
  ('o-mca', 'MCA', '-'),
  ('o-sugihwaras', 'Sugihwaras', '-'),
  ('o-sidokare', 'Sidokare', '-'),
  ('o-kenongo', 'Kenongo', '-'),
  ('o-kepadangan', 'Kepadangan', '-'),
  ('o-pagerwojo', 'Pagerwojo', '-')
on conflict (id) do nothing;

insert into public.karyawan (id, nama, posisi, role, outlet_id, gaji_pokok, bonus_omset, bonus_ulasan, bonus_oh, tunjangan_harian, overtime_rate, jam_masuk, jam_pulang)
values
  ('k-o-gunung-gangsir-1', 'Staff Gunung Gangsir A', 'Kasir', 'karyawan', 'o-gunung-gangsir', 17500, 0, 0, 0, 5000, 10000, '07:00', '14:00'),
  ('k-o-randu-pitu-1', 'Staff Randu Pitu A', 'Kasir', 'karyawan', 'o-randu-pitu', 17500, 0, 0, 0, 5000, 10000, '07:00', '14:00'),
  ('k-o-kuti-1', 'Staff Kuti A', 'Kasir', 'karyawan', 'o-kuti', 17500, 0, 0, 0, 5000, 10000, '07:00', '14:00'),
  ('k-o-sidohwayah-1', 'Staff Sidohwayah A', 'Kasir', 'karyawan', 'o-sidohwayah', 17500, 0, 0, 0, 5000, 10000, '07:00', '14:00'),
  ('k-o-gempeng-1', 'Staff Gempeng A', 'Kasir', 'karyawan', 'o-gempeng', 17500, 0, 0, 0, 5000, 10000, '07:00', '14:00'),
  ('k-o-kesambi-1', 'Staff Kesambi A', 'Kasir', 'karyawan', 'o-kesambi', 17500, 0, 0, 0, 5000, 10000, '07:00', '14:00'),
  ('k-o-permata-1', 'Staff Permata A', 'Kasir', 'karyawan', 'o-permata', 17500, 0, 0, 0, 5000, 10000, '07:00', '14:00'),
  ('k-o-mca-1', 'Staff MCA A', 'Kasir', 'karyawan', 'o-mca', 17500, 0, 0, 0, 5000, 10000, '07:00', '14:00'),
  ('k-o-sugihwaras-1', 'Staff Sugihwaras A', 'Kasir', 'karyawan', 'o-sugihwaras', 17500, 0, 0, 0, 5000, 10000, '07:00', '14:00'),
  ('k-o-sidokare-1', 'Staff Sidokare A', 'Kasir', 'karyawan', 'o-sidokare', 17500, 0, 0, 0, 5000, 10000, '07:00', '14:00'),
  ('k-o-kenongo-1', 'Staff Kenongo A', 'Kasir', 'karyawan', 'o-kenongo', 17500, 0, 0, 0, 5000, 10000, '07:00', '14:00'),
  ('k-o-kepadangan-1', 'Staff Kepadangan A', 'Kasir', 'karyawan', 'o-kepadangan', 17500, 0, 0, 0, 5000, 10000, '07:00', '14:00'),
  ('k-o-pagerwojo-1', 'Staff Pagerwojo A', 'Kasir', 'karyawan', 'o-pagerwojo', 17500, 0, 0, 0, 5000, 10000, '07:00', '14:00')
on conflict (id) do nothing;

insert into public.users (username, password, nama, role, outlet_id, karyawan_id)
values
  ('admin', 'admin123', 'Administrator', 'admin', null, null),
  ('khazana', 'Fazana@10', 'Super Admin', 'admin', null, null),
  ('pegawai1', 'pegawai123', 'Gunung Gangsir', 'karyawan', 'o-gunung-gangsir', 'k-o-gunung-gangsir-1'),
  ('pegawai2', 'pegawai123', 'Randu Pitu', 'karyawan', 'o-randu-pitu', 'k-o-randu-pitu-1'),
  ('pegawai3', 'pegawai123', 'Kuti', 'karyawan', 'o-kuti', 'k-o-kuti-1'),
  ('pegawai4', 'pegawai123', 'Sidohwayah', 'karyawan', 'o-sidohwayah', 'k-o-sidohwayah-1'),
  ('pegawai5', 'pegawai123', 'Gempeng', 'karyawan', 'o-gempeng', 'k-o-gempeng-1'),
  ('pegawai6', 'pegawai123', 'Kesambi', 'karyawan', 'o-kesambi', 'k-o-kesambi-1'),
  ('pegawai7', 'pegawai123', 'Permata', 'karyawan', 'o-permata', 'k-o-permata-1'),
  ('pegawai8', 'pegawai123', 'MCA', 'karyawan', 'o-mca', 'k-o-mca-1'),
  ('pegawai9', 'pegawai123', 'Sugihwaras', 'karyawan', 'o-sugihwaras', 'k-o-sugihwaras-1'),
  ('pegawai10', 'pegawai123', 'Sidokare', 'karyawan', 'o-sidokare', 'k-o-sidokare-1'),
  ('pegawai11', 'pegawai123', 'Kenongo', 'karyawan', 'o-kenongo', 'k-o-kenongo-1'),
  ('pegawai12', 'pegawai123', 'Kepadangan', 'karyawan', 'o-kepadangan', 'k-o-kepadangan-1'),
  ('pegawai13', 'pegawai123', 'Pagerwojo', 'karyawan', 'o-pagerwojo', 'k-o-pagerwojo-1')
on conflict (username) do nothing;

-- A small empty absensi table to allow app boot safely
-- Real attendance records can be inserted later.
