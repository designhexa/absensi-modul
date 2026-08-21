-- Normalize employee roles, merge legacy bonus columns, and remove position.

begin;

alter table public.karyawan add column if not exists bonus numeric not null default 0;

-- Remove the legacy checks before writing the new role values.
alter table public.karyawan drop constraint if exists karyawan_role_check;
alter table public.users drop constraint if exists users_role_check;

-- Preserve the old three bonus values as one total before dropping their columns.
update public.karyawan
set bonus = coalesce(bonus, 0)
  + coalesce(bonus_omset, 0)
  + coalesce(bonus_ulasan, 0)
  + coalesce(bonus_oh, 0);

-- Convert existing roles to the new four-role model.
update public.karyawan
set role = case
  when role = 'admin' then 'admin'
  when role = 'management' then 'management'
  when role = 'supervisi' then 'supervisi'
  else 'staff'
end;

update public.users
set role = case
  when role = 'admin' then 'admin'
  when role = 'management' then 'management'
  when role = 'supervisi' then 'supervisi'
  else 'staff'
end;

alter table public.karyawan
  add constraint karyawan_role_check
  check (role in ('admin', 'management', 'supervisi', 'staff'));

alter table public.users
  add constraint users_role_check
  check (role in ('admin', 'management', 'supervisi', 'staff'));

alter table public.karyawan drop column if exists posisi;
alter table public.karyawan drop column if exists bonus_omset;
alter table public.karyawan drop column if exists bonus_ulasan;
alter table public.karyawan drop column if exists bonus_oh;

commit;
