-- Seed the 13 departments and their initial employee accounts.
-- Safe to rerun: existing rows are preserved.

begin;

insert into public.departemen (id, nama, lokasi)
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

insert into public.karyawan (
  id, nama, posisi, role, departemen_id, gaji_pokok,
  bonus_omset, bonus_ulasan, bonus_oh, tunjangan_harian,
  overtime_rate, jam_masuk, jam_pulang
)
select
  'k-' || d.id || '-1',
  'Staff ' || d.nama || ' A',
  'Kasir',
  case mod(row_number() over (order by d.id) - 1, 4)
    when 0 then 'operational'
    when 1 then 'development'
    when 2 then 'management'
    else 'marketing'
  end,
  d.id,
  17500, 0, 0, 0, 5000, 10000, '07:00', '14:00'
from public.departemen d
where d.id like 'o-%'
on conflict (id) do nothing;

insert into public.users (username, password, nama, role, departemen_id, karyawan_id)
select
  'pegawai' || row_number() over (order by d.id),
  'pegawai123',
  d.nama,
  k.role,
  d.id,
  k.id
from public.departemen d
join public.karyawan k on k.id = 'k-' || d.id || '-1'
where d.id like 'o-%'
on conflict (username) do nothing;

insert into public.users (username, password, nama, role, departemen_id, karyawan_id)
values
  ('admin', 'admin123', 'Administrator', 'admin', null, null),
  ('khazana', 'Fazana@10', 'Super Admin', 'admin', null, null)
on conflict (username) do nothing;

commit;
