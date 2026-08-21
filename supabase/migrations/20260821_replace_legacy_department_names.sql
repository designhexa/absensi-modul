-- Replace the legacy location names with the seven application departments.
-- Existing attendance records remain intact.

begin;

insert into public.departemen (id, nama, lokasi)
values
  ('d-management', 'management', '-'),
  ('d-design', 'design', '-'),
  ('d-marketing', 'marketing', '-'),
  ('d-development', 'development', '-'),
  ('d-operational', 'operational', '-'),
  ('d-finance', 'finance', '-'),
  ('d-logistic', 'logistic', '-')
on conflict (id) do update set nama = excluded.nama;

with departments as (
  select
    id,
    nama,
    row_number() over (order by case id
      when 'd-management' then 1
      when 'd-design' then 2
      when 'd-marketing' then 3
      when 'd-development' then 4
      when 'd-operational' then 5
      when 'd-finance' then 6
      when 'd-logistic' then 7
    end) as urutan
  from public.departemen
  where id like 'd-%'
), ranked as (
  select
    k.id,
    row_number() over (order by k.id) as urutan_pegawai
  from public.karyawan k
), assignments as (
  select
    r.id,
    d.id as departemen_id,
    d.nama as departemen_nama,
    r.urutan_pegawai
  from ranked r
  join departments d
    on d.urutan = ((r.urutan_pegawai - 1) % 7) + 1
)
update public.karyawan k
set
  departemen_id = r.departemen_id,
  nama = 'Pegawai ' || r.departemen_nama || ' ' || r.urutan_pegawai
from assignments r
where k.id = r.id;

update public.users u
set
  departemen_id = k.departemen_id,
  nama = k.nama
from public.karyawan k
where u.karyawan_id = k.id;

delete from public.departemen
where id like 'o-%';

commit;