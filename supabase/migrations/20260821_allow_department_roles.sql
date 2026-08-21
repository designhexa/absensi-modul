-- Allow the current department role model while retaining legacy karyawan rows.

begin;

alter table public.karyawan drop constraint if exists karyawan_role_check;
alter table public.users drop constraint if exists users_role_check;

alter table public.karyawan
  add constraint karyawan_role_check
  check (role in (
    'admin',
    'operational',
    'development',
    'management',
    'marketing',
    'design',
    'finance',
    'logistic',
    'karyawan'
  ));

alter table public.users
  add constraint users_role_check
  check (role in (
    'admin',
    'operational',
    'development',
    'management',
    'marketing',
    'design',
    'finance',
    'logistic',
    'karyawan'
  ));

commit;