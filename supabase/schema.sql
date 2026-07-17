create extension if not exists pgcrypto;

create schema if not exists app_private;

-- Master role aplikasi. Kode bersifat stabil dan tidak boleh ditambah dari UI.
create table if not exists public.master_roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null unique,
  scope_level text not null check (scope_level in ('all', 'rw', 'rt')),
  sort_order smallint not null unique
);

insert into public.master_roles (id, code, label, scope_level, sort_order) values
  ('1deaec79-1b39-4d30-8bb3-f343153a7098', 'superadmin', 'Superadmin', 'all', 1),
  ('4a4dcbe2-5029-41a9-a298-019339161af4', 'ketua_rw', 'Ketua RW', 'rw', 2),
  ('7186947b-ed0c-4226-bdb1-d9ca10aaa5df', 'ketua_rt', 'Ketua RT', 'rt', 3),
  ('e46aaf56-57e9-4547-926b-9f5648daaeaa', 'staff_rw', 'Staff RW', 'rw', 4),
  ('8c0fe781-efcd-4129-a319-0b3262193128', 'staff_rt', 'Staff RT', 'rt', 5)
on conflict (code) do update set
  label = excluded.label,
  scope_level = excluded.scope_level,
  sort_order = excluded.sort_order;

-- Master wilayah dinormalisasi per level agar relasi induk jelas dan tidak ada
-- kolom type/parent yang ambigu seperti pada tabel regions lama.
create table if not exists public.master_provinces (
  id uuid primary key default gen_random_uuid(),
  code text unique,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.master_cities (
  id uuid primary key default gen_random_uuid(),
  province_id uuid not null references public.master_provinces(id) on delete restrict,
  code text unique,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (province_id, name)
);

create table if not exists public.master_districts (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.master_cities(id) on delete restrict,
  code text unique,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (city_id, name)
);

create table if not exists public.master_villages (
  id uuid primary key default gen_random_uuid(),
  district_id uuid not null references public.master_districts(id) on delete restrict,
  code text unique,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (district_id, name)
);

create table if not exists public.master_rws (
  id uuid primary key default gen_random_uuid(),
  village_id uuid not null references public.master_villages(id) on delete restrict,
  code text,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (village_id, code),
  unique (village_id, name)
);

create table if not exists public.master_rts (
  id uuid primary key default gen_random_uuid(),
  rw_id uuid not null references public.master_rws(id) on delete restrict,
  code text,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (rw_id, code),
  unique (rw_id, name)
);

-- Migrasi data master lama dengan mempertahankan UUID agar data operasional dan
-- profile yang sudah ada tetap menunjuk wilayah yang sama.
do $$
begin
  if to_regclass('public.regions') is not null then
    insert into public.master_provinces (id, code, name, created_at, updated_at)
    select id, code, name, created_at, updated_at from public.regions where type = 'province'
    on conflict (id) do nothing;

    insert into public.master_cities (id, province_id, code, name, created_at, updated_at)
    select id, province_id, code, name, created_at, updated_at
    from public.regions where type = 'city' and province_id is not null
    on conflict (id) do nothing;

    insert into public.master_districts (id, city_id, code, name, created_at, updated_at)
    select id, city_id, code, name, created_at, updated_at
    from public.regions where type = 'district' and city_id is not null
    on conflict (id) do nothing;

    insert into public.master_villages (id, district_id, code, name, created_at, updated_at)
    select id, district_id, code, name, created_at, updated_at
    from public.regions where type = 'village' and district_id is not null
    on conflict (id) do nothing;

    insert into public.master_rws (id, village_id, code, name, created_at, updated_at)
    select id, village_id, code, name, created_at, updated_at
    from public.regions where type = 'rw' and village_id is not null
    on conflict (id) do nothing;

    insert into public.master_rts (id, rw_id, code, name, created_at, updated_at)
    select id, rw_id, code, name, created_at, updated_at
    from public.regions where type = 'rt' and rw_id is not null
    on conflict (id) do nothing;
  end if;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null,
  role_id uuid not null references public.master_roles(id),
  province_id uuid references public.master_provinces(id) on delete restrict,
  city_id uuid references public.master_cities(id) on delete restrict,
  district_id uuid references public.master_districts(id) on delete restrict,
  village_id uuid references public.master_villages(id) on delete restrict,
  rw_id uuid references public.master_rws(id) on delete restrict,
  rt_id uuid references public.master_rts(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Upgrade profiles dari schema lama (role: superadmin/rw/rt) ke role_id.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'role'
  ) then
    alter table public.profiles add column if not exists role_id uuid;
    update public.profiles
    set role_id = mr.id
    from public.master_roles mr
    where mr.code = case profiles.role
      when 'rw' then 'ketua_rw'
      when 'rt' then 'ketua_rt'
      else 'superadmin' end
      and profiles.role_id is null;
  end if;
end $$;

alter table public.profiles alter column role_id set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_role_id_fkey') then
    alter table public.profiles
      add constraint profiles_role_id_fkey foreign key (role_id) references public.master_roles(id);
  end if;
end $$;

create table if not exists public.master_permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  module text not null,
  label text not null,
  description text not null default '',
  sort_order smallint not null unique
);

insert into public.master_permissions (id, code, module, label, description, sort_order) values
  ('ad864be7-230a-403c-8c5b-c94ec7df0d81', 'dashboard.view', 'dashboard', 'Lihat Dashboard', 'Melihat ringkasan data kependudukan.', 1),
  ('8df63b66-f426-4793-b805-35628c785840', 'regions.view', 'regions', 'Lihat Master Wilayah', 'Melihat halaman dan daftar master wilayah.', 2),
  ('21f560a5-f3d4-44bf-a366-6f3f6c423e83', 'regions.manage', 'regions', 'Kelola Master Wilayah', 'Menambah, mengubah, dan menghapus master wilayah sesuai scope.', 3),
  ('f1ffb9f8-8569-4730-a087-f72f13721342', 'users.view', 'users', 'Lihat Pengguna', 'Melihat pengguna dalam scope wilayah.', 4),
  ('44642194-8fb3-4c89-95cd-fa5089d4f76a', 'users.manage', 'users', 'Kelola Pengguna', 'Menambah, mengubah, dan menghapus pengguna dalam scope.', 5),
  ('b6e0fc4c-3350-4ab3-968c-e7ca46eaea54', 'families.view', 'families', 'Lihat KK dan Warga', 'Melihat KK, warga, dan mutasi dalam scope.', 6),
  ('af01987d-d0e8-4d69-9661-0b7df0d5b374', 'families.manage', 'families', 'Kelola KK dan Warga', 'Menambah dan mengubah KK, warga, serta mutasi.', 7),
  ('8589b523-bbdf-4596-851e-492237ab1462', 'reports.view', 'reports', 'Lihat Laporan', 'Melihat halaman laporan kependudukan.', 8),
  ('1b7d4cdc-13f0-4fda-a881-14468d836f68', 'reports.export', 'reports', 'Export Laporan', 'Membuat dan mencatat export XLSX.', 9),
  ('beb05e3a-3e34-4db7-b590-c433bfdc462c', 'rbac.manage', 'security', 'Kelola RBAC', 'Mengubah permission default role dan override pengguna.', 10)
on conflict (code) do update set
  module = excluded.module,
  label = excluded.label,
  description = excluded.description,
  sort_order = excluded.sort_order;

create table if not exists public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  role_id uuid not null references public.master_roles(id) on delete cascade,
  permission_id uuid not null references public.master_permissions(id) on delete cascade,
  allowed boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (role_id, permission_id)
);

create table if not exists public.user_permissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  permission_id uuid not null references public.master_permissions(id) on delete cascade,
  allowed boolean not null,
  updated_at timestamptz not null default now(),
  unique (user_id, permission_id)
);

-- Default permission dapat diubah Superadmin dari UI. INSERT ini hanya mengisi
-- kombinasi yang belum ada sehingga perubahan admin tidak tertimpa saat rerun.
insert into public.role_permissions (role_id, permission_id, allowed)
select r.id, p.id, true from public.master_roles r cross join public.master_permissions p
where r.code = 'superadmin'
on conflict (role_id, permission_id) do nothing;

insert into public.role_permissions (role_id, permission_id, allowed)
select r.id, p.id, true
from public.master_roles r
join public.master_permissions p on (
  (r.code = 'ketua_rw' and p.code in ('dashboard.view', 'regions.view', 'regions.manage', 'users.view', 'users.manage', 'families.view', 'families.manage', 'reports.view', 'reports.export'))
  or (r.code = 'ketua_rt' and p.code in ('dashboard.view', 'families.view', 'families.manage', 'reports.view', 'reports.export'))
  or (r.code in ('staff_rw', 'staff_rt') and p.code in ('dashboard.view', 'families.view', 'families.manage', 'reports.view', 'reports.export'))
  or (r.code = 'staff_rw' and p.code = 'regions.view')
)
on conflict (role_id, permission_id) do nothing;

create table if not exists public.family_cards (
  id uuid primary key default gen_random_uuid(),
  kk_number text not null unique,
  head_name text not null,
  address text not null,
  province_id uuid references public.master_provinces(id) on delete restrict,
  city_id uuid references public.master_cities(id) on delete restrict,
  district_id uuid references public.master_districts(id) on delete restrict,
  village_id uuid references public.master_villages(id) on delete restrict,
  rw_id uuid references public.master_rws(id) on delete restrict,
  rt_id uuid references public.master_rts(id) on delete restrict,
  registered_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.residents (
  id uuid primary key default gen_random_uuid(),
  family_card_id uuid not null references public.family_cards(id) on delete cascade,
  kk_number text not null,
  nik text not null unique,
  full_name text not null,
  gender text not null check (gender in ('L', 'P')),
  birth_place text not null,
  birth_date date not null,
  religion text not null,
  education text not null default '',
  occupation text not null default '',
  marital_status text not null,
  family_relationship text not null,
  citizenship text not null default 'WNI',
  father_name text not null default '',
  mother_name text not null default '',
  address text not null,
  stay_since date,
  moved_out_at date,
  resident_status text not null check (resident_status in ('tetap', 'sementara')),
  province_id uuid references public.master_provinces(id) on delete restrict,
  city_id uuid references public.master_cities(id) on delete restrict,
  district_id uuid references public.master_districts(id) on delete restrict,
  village_id uuid references public.master_villages(id) on delete restrict,
  rw_id uuid references public.master_rws(id) on delete restrict,
  rt_id uuid references public.master_rts(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.resident_mutations (
  id uuid primary key default gen_random_uuid(),
  resident_id uuid references public.residents(id) on delete set null,
  resident_name text not null,
  gender text not null check (gender in ('L', 'P')),
  mutation_type text not null check (mutation_type in ('lahir', 'mati', 'pindah', 'datang')),
  mutation_date date not null,
  note text,
  resident_status text not null check (resident_status in ('tetap', 'sementara')),
  province_id uuid references public.master_provinces(id) on delete restrict,
  city_id uuid references public.master_cities(id) on delete restrict,
  district_id uuid references public.master_districts(id) on delete restrict,
  village_id uuid references public.master_villages(id) on delete restrict,
  rw_id uuid references public.master_rws(id) on delete restrict,
  rt_id uuid references public.master_rts(id) on delete restrict,
  created_at timestamptz not null default now()
);

-- Membuat KK dan kepala keluarga secara atomik. SECURITY INVOKER memastikan
-- permission dan scope tetap diperiksa oleh RLS milik pengguna pemanggil.
create or replace function public.create_family_card_with_head(
  p_kk_number text,
  p_head_nik text,
  p_head_name text,
  p_address text,
  p_gender text,
  p_birth_place text,
  p_birth_date date,
  p_religion text,
  p_marital_status text,
  p_registered_at date,
  p_province_id uuid,
  p_city_id uuid,
  p_district_id uuid,
  p_village_id uuid,
  p_rw_id uuid,
  p_rt_id uuid
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  new_family_card_id uuid;
begin
  insert into public.family_cards (
    kk_number, head_name, address, registered_at,
    province_id, city_id, district_id, village_id, rw_id, rt_id
  ) values (
    trim(p_kk_number), trim(p_head_name), trim(p_address), p_registered_at,
    p_province_id, p_city_id, p_district_id, p_village_id, p_rw_id, p_rt_id
  ) returning id into new_family_card_id;

  insert into public.residents (
    family_card_id, kk_number, nik, full_name, gender, birth_place, birth_date,
    religion, education, occupation, marital_status, family_relationship,
    citizenship, father_name, mother_name, address, resident_status,
    province_id, city_id, district_id, village_id, rw_id, rt_id
  ) values (
    new_family_card_id, trim(p_kk_number), trim(p_head_nik), trim(p_head_name),
    p_gender, trim(p_birth_place), p_birth_date, trim(p_religion), '', '',
    trim(p_marital_status), 'Kepala Keluarga', 'WNI', '', '', trim(p_address), 'tetap',
    p_province_id, p_city_id, p_district_id, p_village_id, p_rw_id, p_rt_id
  );

  return new_family_card_id;
end;
$$;

create table if not exists public.report_exports (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  month int not null check (month between 1 and 12),
  year int not null check (year between 2020 and 2100),
  rw_id uuid references public.master_rws(id) on delete restrict,
  rt_id uuid references public.master_rts(id) on delete restrict,
  total_residents int not null default 0,
  created_at timestamptz not null default now()
);

create or replace function app_private.current_profile_role()
returns text language sql security definer set search_path = '' stable
as $$
  select mr.code
  from public.profiles p
  join public.master_roles mr on mr.id = p.role_id
  where p.id = (select auth.uid())
$$;

create or replace function app_private.current_profile_rw_id()
returns uuid language sql security definer set search_path = '' stable
as $$ select rw_id from public.profiles where id = (select auth.uid()) $$;

create or replace function app_private.current_profile_rt_id()
returns uuid language sql security definer set search_path = '' stable
as $$ select rt_id from public.profiles where id = (select auth.uid()) $$;

create or replace function app_private.has_permission(requested_permission text)
returns boolean language sql security definer set search_path = '' stable
as $$
  select coalesce(
    (select up.allowed
     from public.user_permissions up
     join public.master_permissions mp on mp.id = up.permission_id
     where up.user_id = (select auth.uid()) and mp.code = requested_permission),
    (select rp.allowed
     from public.role_permissions rp
     join public.profiles p on p.role_id = rp.role_id
     join public.master_permissions mp on mp.id = rp.permission_id
     where p.id = (select auth.uid()) and mp.code = requested_permission),
    false
  ) or app_private.current_profile_role() = 'superadmin'
$$;

create or replace function app_private.can_access_scope(target_rw_id uuid, target_rt_id uuid)
returns boolean language sql security definer set search_path = '' stable
as $$
  select case
    when app_private.current_profile_role() = 'superadmin' then true
    when app_private.current_profile_role() in ('ketua_rw', 'staff_rw')
      then target_rw_id = app_private.current_profile_rw_id()
    when app_private.current_profile_role() in ('ketua_rt', 'staff_rt')
      then target_rt_id = app_private.current_profile_rt_id()
    else false
  end
$$;

create or replace function app_private.prevent_superadmin_profile_delete()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if exists (
    select 1 from public.master_roles
    where id = old.role_id and code = 'superadmin'
  ) then
    raise exception 'Akun Superadmin tidak dapat dihapus.';
  end if;
  return old;
end;
$$;

drop trigger if exists profiles_protect_superadmin_delete on public.profiles;
create trigger profiles_protect_superadmin_delete
before delete on public.profiles
for each row execute function app_private.prevent_superadmin_profile_delete();

create or replace function app_private.apply_resident_mutation()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.resident_id is not null then
    if new.mutation_type in ('pindah', 'mati') then
      update public.residents set moved_out_at = new.mutation_date, updated_at = now()
      where id = new.resident_id;
    elsif new.mutation_type = 'datang' then
      update public.residents set moved_out_at = null, updated_at = now()
      where id = new.resident_id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists resident_mutations_apply on public.resident_mutations;
create trigger resident_mutations_apply after insert on public.resident_mutations
for each row execute function app_private.apply_resident_mutation();

revoke all on schema app_private from public, anon;
grant usage on schema app_private to authenticated;
revoke all on all functions in schema app_private from public, anon;
grant execute on function app_private.current_profile_role() to authenticated;
grant execute on function app_private.current_profile_rw_id() to authenticated;
grant execute on function app_private.current_profile_rt_id() to authenticated;
grant execute on function app_private.has_permission(text) to authenticated;
grant execute on function app_private.can_access_scope(uuid, uuid) to authenticated;

grant select on public.master_roles, public.master_permissions to authenticated;
grant select, insert, update, delete on public.role_permissions to authenticated;
grant select, insert, update, delete on public.user_permissions to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.master_provinces, public.master_cities,
  public.master_districts, public.master_villages, public.master_rws, public.master_rts to authenticated;
grant select, insert, update, delete on public.family_cards, public.residents,
  public.resident_mutations to authenticated;
grant select, insert on public.report_exports to authenticated;
revoke all on function public.create_family_card_with_head(
  text, text, text, text, text, text, date, text, text, date,
  uuid, uuid, uuid, uuid, uuid, uuid
) from public, anon;
grant execute on function public.create_family_card_with_head(
  text, text, text, text, text, text, date, text, text, date,
  uuid, uuid, uuid, uuid, uuid, uuid
) to authenticated;

alter table public.master_roles enable row level security;
alter table public.master_permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_permissions enable row level security;
alter table public.profiles enable row level security;
alter table public.master_provinces enable row level security;
alter table public.master_cities enable row level security;
alter table public.master_districts enable row level security;
alter table public.master_villages enable row level security;
alter table public.master_rws enable row level security;
alter table public.master_rts enable row level security;
alter table public.family_cards enable row level security;
alter table public.residents enable row level security;
alter table public.resident_mutations enable row level security;
alter table public.report_exports enable row level security;

-- Menjaga file schema dapat dijalankan ulang tanpa policy duplikat. Hanya policy
-- milik aplikasi pada tabel yang dikelola file ini yang dibersihkan.
do $$
declare
  policy_row record;
begin
  for policy_row in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'master_roles', 'master_permissions', 'role_permissions', 'user_permissions',
        'profiles', 'master_provinces', 'master_cities', 'master_districts',
        'master_villages', 'master_rws', 'master_rts', 'family_cards', 'residents',
        'resident_mutations', 'report_exports'
      )
  loop
    execute format('drop policy if exists %I on %I.%I', policy_row.policyname, policy_row.schemaname, policy_row.tablename);
  end loop;
end $$;

create policy "master roles read" on public.master_roles for select to authenticated using (true);
create policy "master permissions read" on public.master_permissions for select to authenticated using (true);
create policy "role permissions read" on public.role_permissions for select to authenticated using (true);
create policy "role permissions manage" on public.role_permissions for all to authenticated
using (app_private.current_profile_role() = 'superadmin')
with check (
  app_private.current_profile_role() = 'superadmin'
  and role_id <> (select id from public.master_roles where code = 'superadmin')
);
create policy "user permissions read" on public.user_permissions for select to authenticated
using (user_id = (select auth.uid()) or app_private.current_profile_role() = 'superadmin');
create policy "user permissions manage" on public.user_permissions for all to authenticated
using (app_private.current_profile_role() = 'superadmin')
with check (
  app_private.current_profile_role() = 'superadmin'
  and not exists (
    select 1 from public.profiles p join public.master_roles mr on mr.id = p.role_id
    where p.id = user_id and mr.code = 'superadmin'
  )
);

create policy "profiles scoped read" on public.profiles for select to authenticated
using (
  id = (select auth.uid())
  or (app_private.has_permission('users.view') and app_private.can_access_scope(rw_id, rt_id))
);
create policy "profiles scoped insert" on public.profiles for insert to authenticated
with check (
  app_private.has_permission('users.manage') and (
    app_private.current_profile_role() = 'superadmin'
    or (
      app_private.current_profile_role() = 'ketua_rw'
      and role_id in (select id from public.master_roles where code in ('ketua_rt', 'staff_rw', 'staff_rt'))
      and rw_id = app_private.current_profile_rw_id()
    )
  )
);
create policy "profiles scoped update" on public.profiles for update to authenticated
using (app_private.has_permission('users.manage') and app_private.can_access_scope(rw_id, rt_id))
with check (
  app_private.has_permission('users.manage') and (
    app_private.current_profile_role() = 'superadmin'
    or (
      app_private.current_profile_role() = 'ketua_rw'
      and role_id in (select id from public.master_roles where code in ('ketua_rt', 'staff_rw', 'staff_rt'))
      and rw_id = app_private.current_profile_rw_id()
    )
  )
);
create policy "profiles scoped delete" on public.profiles for delete to authenticated
using (
  id <> (select auth.uid())
  and role_id <> (select id from public.master_roles where code = 'superadmin')
  and app_private.has_permission('users.manage')
  and app_private.can_access_scope(rw_id, rt_id)
  and (
    app_private.current_profile_role() = 'superadmin'
    or role_id in (select id from public.master_roles where code in ('ketua_rt', 'staff_rw', 'staff_rt'))
  )
);

create policy "provinces read" on public.master_provinces for select to authenticated using (true);
create policy "cities read" on public.master_cities for select to authenticated using (true);
create policy "districts read" on public.master_districts for select to authenticated using (true);
create policy "villages read" on public.master_villages for select to authenticated using (true);
create policy "rws scoped read" on public.master_rws for select to authenticated
using (
  app_private.current_profile_role() = 'superadmin'
  or id = app_private.current_profile_rw_id()
);
create policy "rts scoped read" on public.master_rts for select to authenticated
using (
  app_private.current_profile_role() = 'superadmin'
  or (
    app_private.current_profile_role() in ('ketua_rw', 'staff_rw')
    and rw_id = app_private.current_profile_rw_id()
  )
  or (
    app_private.current_profile_role() in ('ketua_rt', 'staff_rt')
    and id = app_private.current_profile_rt_id()
  )
);
create policy "provinces manage" on public.master_provinces for all to authenticated
using (app_private.current_profile_role() = 'superadmin' and app_private.has_permission('regions.manage'))
with check (app_private.current_profile_role() = 'superadmin' and app_private.has_permission('regions.manage'));
create policy "cities manage" on public.master_cities for all to authenticated
using (app_private.current_profile_role() = 'superadmin' and app_private.has_permission('regions.manage'))
with check (app_private.current_profile_role() = 'superadmin' and app_private.has_permission('regions.manage'));
create policy "districts manage" on public.master_districts for all to authenticated
using (app_private.current_profile_role() = 'superadmin' and app_private.has_permission('regions.manage'))
with check (app_private.current_profile_role() = 'superadmin' and app_private.has_permission('regions.manage'));
create policy "villages manage" on public.master_villages for all to authenticated
using (app_private.current_profile_role() = 'superadmin' and app_private.has_permission('regions.manage'))
with check (app_private.current_profile_role() = 'superadmin' and app_private.has_permission('regions.manage'));
create policy "rws manage" on public.master_rws for all to authenticated
using (app_private.current_profile_role() = 'superadmin' and app_private.has_permission('regions.manage'))
with check (app_private.current_profile_role() = 'superadmin' and app_private.has_permission('regions.manage'));
create policy "rts manage" on public.master_rts for all to authenticated
using (
  app_private.has_permission('regions.manage') and (
    app_private.current_profile_role() = 'superadmin'
    or (app_private.current_profile_role() = 'ketua_rw' and rw_id = app_private.current_profile_rw_id())
  )
)
with check (
  app_private.has_permission('regions.manage') and (
    app_private.current_profile_role() = 'superadmin'
    or (app_private.current_profile_role() = 'ketua_rw' and rw_id = app_private.current_profile_rw_id())
  )
);

create policy "family cards read" on public.family_cards for select to authenticated
using (app_private.has_permission('families.view') and app_private.can_access_scope(rw_id, rt_id));
create policy "family cards write" on public.family_cards for all to authenticated
using (app_private.has_permission('families.manage') and app_private.can_access_scope(rw_id, rt_id))
with check (app_private.has_permission('families.manage') and app_private.can_access_scope(rw_id, rt_id));
create policy "residents read" on public.residents for select to authenticated
using (app_private.has_permission('families.view') and app_private.can_access_scope(rw_id, rt_id));
create policy "residents write" on public.residents for all to authenticated
using (app_private.has_permission('families.manage') and app_private.can_access_scope(rw_id, rt_id))
with check (app_private.has_permission('families.manage') and app_private.can_access_scope(rw_id, rt_id));
create policy "mutations read" on public.resident_mutations for select to authenticated
using (app_private.has_permission('families.view') and app_private.can_access_scope(rw_id, rt_id));
create policy "mutations write" on public.resident_mutations for all to authenticated
using (app_private.has_permission('families.manage') and app_private.can_access_scope(rw_id, rt_id))
with check (app_private.has_permission('families.manage') and app_private.can_access_scope(rw_id, rt_id));
create policy "report exports read" on public.report_exports for select to authenticated
using (app_private.has_permission('reports.view') and app_private.can_access_scope(rw_id, rt_id));
create policy "report exports insert" on public.report_exports for insert to authenticated
with check (app_private.has_permission('reports.export') and app_private.can_access_scope(rw_id, rt_id));

insert into storage.buckets (id, name, public) values ('resident-documents', 'resident-documents', false)
on conflict (id) do nothing;

drop policy if exists "resident documents scoped read" on storage.objects;
drop policy if exists "resident documents scoped insert" on storage.objects;
drop policy if exists "resident documents scoped update" on storage.objects;
drop policy if exists "resident documents scoped delete" on storage.objects;
create policy "resident documents scoped read" on storage.objects for select to authenticated
using (
  bucket_id = 'resident-documents' and app_private.has_permission('families.view') and
  app_private.can_access_scope((storage.foldername(name))[1]::uuid, (storage.foldername(name))[2]::uuid)
);
create policy "resident documents scoped insert" on storage.objects for insert to authenticated
with check (
  bucket_id = 'resident-documents' and app_private.has_permission('families.manage') and
  app_private.can_access_scope((storage.foldername(name))[1]::uuid, (storage.foldername(name))[2]::uuid)
);
create policy "resident documents scoped update" on storage.objects for update to authenticated
using (
  bucket_id = 'resident-documents' and app_private.has_permission('families.manage') and
  app_private.can_access_scope((storage.foldername(name))[1]::uuid, (storage.foldername(name))[2]::uuid)
)
with check (
  bucket_id = 'resident-documents' and app_private.has_permission('families.manage') and
  app_private.can_access_scope((storage.foldername(name))[1]::uuid, (storage.foldername(name))[2]::uuid)
);
create policy "resident documents scoped delete" on storage.objects for delete to authenticated
using (
  bucket_id = 'resident-documents' and app_private.has_permission('families.manage') and
  app_private.can_access_scope((storage.foldername(name))[1]::uuid, (storage.foldername(name))[2]::uuid)
);

create index if not exists master_cities_province_idx on public.master_cities(province_id);
create index if not exists master_districts_city_idx on public.master_districts(city_id);
create index if not exists master_villages_district_idx on public.master_villages(district_id);
create index if not exists master_rws_village_idx on public.master_rws(village_id);
create index if not exists master_rts_rw_idx on public.master_rts(rw_id);
create index if not exists profiles_scope_idx on public.profiles(rw_id, rt_id);
create index if not exists family_cards_scope_idx on public.family_cards(rw_id, rt_id);
create index if not exists residents_scope_idx on public.residents(rw_id, rt_id);
create index if not exists resident_mutations_scope_date_idx on public.resident_mutations(rw_id, rt_id, mutation_date);

-- Bersihkan objek legacy setelah data berhasil disalin. Policy lama dilepas agar
-- kolom role dan tabel regions tidak meninggalkan dua sumber kebenaran.
drop policy if exists "profiles read own or superadmin" on public.profiles;
drop policy if exists "profiles managed by superadmin" on public.profiles;
drop policy if exists "profiles managed by rw for own rt" on public.profiles;
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'role'
  ) then
    alter table public.profiles drop column role cascade;
  end if;
end $$;
drop table if exists public.regions cascade;
drop table if exists public.roles cascade;

-- Guardrail: semua PK/FK aplikasi yang memakai nama id atau *_id wajib UUID.
do $$
declare
  invalid_column record;
begin
  select table_name, column_name, data_type into invalid_column
  from information_schema.columns
  where table_schema = 'public'
    and table_name in (
      'master_roles', 'master_permissions', 'role_permissions', 'user_permissions',
      'profiles', 'master_provinces', 'master_cities', 'master_districts',
      'master_villages', 'master_rws', 'master_rts', 'family_cards', 'residents',
      'resident_mutations', 'report_exports'
    )
    and (column_name = 'id' or column_name like '%\_id' escape '\')
    and data_type <> 'uuid'
  limit 1;

  if found then
    raise exception 'Kolom %.% wajib UUID, tetapi bertipe %',
      invalid_column.table_name, invalid_column.column_name, invalid_column.data_type;
  end if;
end $$;
