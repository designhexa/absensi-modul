-- ==========================================
-- Test employee accounts for app validation
-- ==========================================

create table if not exists public.outlets (
  id text primary key,
  nama text not null,
  lokasi text not null default '-'
);

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

create table if not exists public.users (
  username text primary key,
  password text not null,
  nama text not null,
  role text not null default 'operational' check (role in ('admin', 'operational', 'development', 'management', 'marketing', 'design', 'finance', 'logistic', 'karyawan')),
  outlet_id text references public.outlets(id) on delete set null,
  karyawan_id text references public.karyawan(id) on delete set null
);

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

insert into public.karyawan (id, nama, posisi, role, outlet_id, gaji_pokok, bonus_omset, bonus_ulasan, bonus_oh, tunjangan_harian, overtime_rate, jam_masuk, jam_pulang)
values
  ('k-test-1', 'Test Pegawai 1', 'Kasir', 'karyawan', null, 17500, 0, 0, 0, 5000, 10000, '07:00', '14:00'),
  ('k-test-2', 'Test Pegawai 2', 'Kasir', 'karyawan', null, 17500, 0, 0, 0, 5000, 10000, '07:00', '14:00')
on conflict (id) do nothing;

insert into public.users (username, password, nama, role, outlet_id, karyawan_id)
values
  ('testpegawai1', 'pegawai123', 'Test Pegawai 1', 'karyawan', null, 'k-test-1'),
  ('testpegawai2', 'pegawai123', 'Test Pegawai 2', 'karyawan', null, 'k-test-2')
on conflict (username) do nothing;

-- Login test data:
-- 1) username: testpegawai1  password: pegawai123
-- 2) username: testpegawai2  password: pegawai123
