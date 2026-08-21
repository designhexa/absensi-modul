-- Rename the legacy outlet database objects to the department terminology.
-- Data and IDs are preserved; this only changes table and column names.

begin;

do $$
begin
  if to_regclass('public.outlets') is not null
     and to_regclass('public.departemen') is null then
    alter table public.outlets rename to departemen;
  end if;
end
$$;

do $$
begin
  if to_regclass('public.karyawan') is not null
     and exists (
       select 1 from information_schema.columns
       where table_schema = 'public'
         and table_name = 'karyawan'
         and column_name = 'outlet_id'
     )
     and not exists (
       select 1 from information_schema.columns
       where table_schema = 'public'
         and table_name = 'karyawan'
         and column_name = 'departemen_id'
     ) then
    alter table public.karyawan rename column outlet_id to departemen_id;
  end if;

  if to_regclass('public.users') is not null
     and exists (
       select 1 from information_schema.columns
       where table_schema = 'public'
         and table_name = 'users'
         and column_name = 'outlet_id'
     )
     and not exists (
       select 1 from information_schema.columns
       where table_schema = 'public'
         and table_name = 'users'
         and column_name = 'departemen_id'
     ) then
    alter table public.users rename column outlet_id to departemen_id;
  end if;
end
$$;

alter index if exists public.idx_karyawan_outlet_id
  rename to idx_karyawan_departemen_id;
alter index if exists public.idx_users_outlet_id
  rename to idx_users_departemen_id;

commit;
