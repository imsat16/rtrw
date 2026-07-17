create extension if not exists pgcrypto;

create schema if not exists app_private;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null,
  role text not null check (role in ('superadmin', 'rw', 'rt')),
  province_id uuid,
  city_id uuid,
  district_id uuid,
  village_id uuid,
  rw_id uuid,
  rt_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.roles (
  id text primary key,
  label text not null
);

insert into public.roles (id, label) values
  ('superadmin', 'Superadmin'),
  ('rw', 'Ketua RW'),
  ('rt', 'Ketua RT')
on conflict (id) do update set label = excluded.label;

do $$
declare
  con record;
begin
  for con in
    select conname from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%role%'
  loop
    execute format('alter table public.profiles drop constraint %I', con.conname);
  end loop;
end $$;

alter table public.profiles drop constraint if exists profiles_role_fkey;
alter table public.profiles
  add constraint profiles_role_fkey foreign key (role) references public.roles(id);

create table if not exists public.regions (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('province', 'city', 'district', 'village', 'rw', 'rt')),
  name text not null,
  code text,
  parent_id uuid references public.regions(id) on delete set null,
  province_id uuid,
  city_id uuid,
  district_id uuid,
  village_id uuid,
  rw_id uuid,
  rt_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.family_cards (
  id uuid primary key default gen_random_uuid(),
  kk_number text not null,
  head_name text not null,
  address text not null,
  province_id uuid,
  city_id uuid,
  district_id uuid,
  village_id uuid,
  rw_id uuid,
  rt_id uuid,
  registered_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'family_cards_kk_number_key') then
    alter table public.family_cards add constraint family_cards_kk_number_key unique (kk_number);
  end if;
end $$;

create table if not exists public.residents (
  id uuid primary key default gen_random_uuid(),
  family_card_id uuid not null references public.family_cards(id) on delete cascade,
  kk_number text not null,
  nik text not null,
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
  province_id uuid,
  city_id uuid,
  district_id uuid,
  village_id uuid,
  rw_id uuid,
  rt_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'residents_nik_key') then
    alter table public.residents add constraint residents_nik_key unique (nik);
  end if;
end $$;

create table if not exists public.resident_mutations (
  id uuid primary key default gen_random_uuid(),
  resident_id uuid references public.residents(id) on delete set null,
  resident_name text not null,
  gender text not null check (gender in ('L', 'P')),
  mutation_type text not null check (mutation_type in ('lahir', 'mati', 'pindah', 'datang')),
  mutation_date date not null,
  note text,
  resident_status text not null check (resident_status in ('tetap', 'sementara')),
  province_id uuid,
  city_id uuid,
  district_id uuid,
  village_id uuid,
  rw_id uuid,
  rt_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.report_exports (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  month int not null check (month between 1 and 12),
  year int not null check (year between 2020 and 2100),
  rw_id uuid,
  rt_id uuid,
  total_residents int not null default 0,
  created_at timestamptz not null default now()
);

create or replace function app_private.current_profile_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function app_private.current_profile_rw_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select rw_id from public.profiles where id = auth.uid()
$$;

create or replace function app_private.current_profile_rt_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select rt_id from public.profiles where id = auth.uid()
$$;

create or replace function app_private.apply_resident_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.resident_id is not null then
    if new.mutation_type in ('pindah', 'mati') then
      update public.residents
      set moved_out_at = new.mutation_date,
          updated_at = now()
      where id = new.resident_id;
    elsif new.mutation_type = 'datang' then
      update public.residents
      set moved_out_at = null,
          updated_at = now()
      where id = new.resident_id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists resident_mutations_apply on public.resident_mutations;
create trigger resident_mutations_apply
after insert on public.resident_mutations
for each row execute function app_private.apply_resident_mutation();

grant usage on schema app_private to authenticated;
grant execute on function app_private.current_profile_role() to authenticated;
grant execute on function app_private.current_profile_rw_id() to authenticated;
grant execute on function app_private.current_profile_rt_id() to authenticated;

grant select, insert, update, delete on public.profiles to authenticated;
grant select on public.roles to authenticated;
grant select, insert, update, delete on public.regions to authenticated;
grant select, insert, update, delete on public.family_cards to authenticated;
grant select, insert, update, delete on public.residents to authenticated;
grant select, insert, update, delete on public.resident_mutations to authenticated;
grant select, insert on public.report_exports to authenticated;

alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.regions enable row level security;
alter table public.family_cards enable row level security;
alter table public.residents enable row level security;
alter table public.resident_mutations enable row level security;
alter table public.report_exports enable row level security;

drop policy if exists "profiles read own or superadmin" on public.profiles;
create policy "profiles read own or superadmin"
on public.profiles for select to authenticated
using (id = auth.uid() or app_private.current_profile_role() = 'superadmin');

drop policy if exists "profiles managed by superadmin" on public.profiles;
create policy "profiles managed by superadmin"
on public.profiles for all to authenticated
using (app_private.current_profile_role() = 'superadmin')
with check (app_private.current_profile_role() = 'superadmin');

drop policy if exists "profiles managed by rw for own rt" on public.profiles;
create policy "profiles managed by rw for own rt"
on public.profiles for all to authenticated
using (
  app_private.current_profile_role() = 'rw'
  and role = 'rt'
  and rw_id = app_private.current_profile_rw_id()
)
with check (
  app_private.current_profile_role() = 'rw'
  and role = 'rt'
  and rw_id = app_private.current_profile_rw_id()
);

drop policy if exists "roles read authenticated" on public.roles;
create policy "roles read authenticated"
on public.roles for select to authenticated
using (true);

drop policy if exists "regions read authenticated" on public.regions;
create policy "regions read authenticated"
on public.regions for select to authenticated
using (true);

drop policy if exists "regions write by role" on public.regions;
create policy "regions write by role"
on public.regions for all to authenticated
using (
  app_private.current_profile_role() = 'superadmin'
  or (
    app_private.current_profile_role() = 'rw'
    and type = 'rt'
    and rw_id = app_private.current_profile_rw_id()
  )
)
with check (
  app_private.current_profile_role() = 'superadmin'
  or (
    app_private.current_profile_role() = 'rw'
    and type = 'rt'
    and rw_id = app_private.current_profile_rw_id()
  )
);

drop policy if exists "family cards scoped read" on public.family_cards;
create policy "family cards scoped read"
on public.family_cards for select to authenticated
using (
  app_private.current_profile_role() = 'superadmin'
  or (app_private.current_profile_role() = 'rw' and rw_id = app_private.current_profile_rw_id())
  or (app_private.current_profile_role() = 'rt' and rt_id = app_private.current_profile_rt_id())
);

drop policy if exists "family cards scoped write" on public.family_cards;
create policy "family cards scoped write"
on public.family_cards for all to authenticated
using (
  app_private.current_profile_role() = 'superadmin'
  or (app_private.current_profile_role() = 'rw' and rw_id = app_private.current_profile_rw_id())
  or (app_private.current_profile_role() = 'rt' and rt_id = app_private.current_profile_rt_id())
)
with check (
  app_private.current_profile_role() = 'superadmin'
  or (app_private.current_profile_role() = 'rw' and rw_id = app_private.current_profile_rw_id())
  or (app_private.current_profile_role() = 'rt' and rt_id = app_private.current_profile_rt_id())
);

drop policy if exists "residents scoped read" on public.residents;
create policy "residents scoped read"
on public.residents for select to authenticated
using (
  app_private.current_profile_role() = 'superadmin'
  or (app_private.current_profile_role() = 'rw' and rw_id = app_private.current_profile_rw_id())
  or (app_private.current_profile_role() = 'rt' and rt_id = app_private.current_profile_rt_id())
);

drop policy if exists "residents scoped write" on public.residents;
create policy "residents scoped write"
on public.residents for all to authenticated
using (
  app_private.current_profile_role() = 'superadmin'
  or (app_private.current_profile_role() = 'rw' and rw_id = app_private.current_profile_rw_id())
  or (app_private.current_profile_role() = 'rt' and rt_id = app_private.current_profile_rt_id())
)
with check (
  app_private.current_profile_role() = 'superadmin'
  or (app_private.current_profile_role() = 'rw' and rw_id = app_private.current_profile_rw_id())
  or (app_private.current_profile_role() = 'rt' and rt_id = app_private.current_profile_rt_id())
);

drop policy if exists "mutations scoped read" on public.resident_mutations;
create policy "mutations scoped read"
on public.resident_mutations for select to authenticated
using (
  app_private.current_profile_role() = 'superadmin'
  or (app_private.current_profile_role() = 'rw' and rw_id = app_private.current_profile_rw_id())
  or (app_private.current_profile_role() = 'rt' and rt_id = app_private.current_profile_rt_id())
);

drop policy if exists "mutations scoped write" on public.resident_mutations;
create policy "mutations scoped write"
on public.resident_mutations for all to authenticated
using (
  app_private.current_profile_role() = 'superadmin'
  or (app_private.current_profile_role() = 'rw' and rw_id = app_private.current_profile_rw_id())
  or (app_private.current_profile_role() = 'rt' and rt_id = app_private.current_profile_rt_id())
)
with check (
  app_private.current_profile_role() = 'superadmin'
  or (app_private.current_profile_role() = 'rw' and rw_id = app_private.current_profile_rw_id())
  or (app_private.current_profile_role() = 'rt' and rt_id = app_private.current_profile_rt_id())
);

drop policy if exists "report exports scoped" on public.report_exports;
create policy "report exports scoped"
on public.report_exports for all to authenticated
using (
  app_private.current_profile_role() = 'superadmin'
  or (app_private.current_profile_role() = 'rw' and rw_id = app_private.current_profile_rw_id())
  or (app_private.current_profile_role() = 'rt' and rt_id = app_private.current_profile_rt_id())
)
with check (
  app_private.current_profile_role() = 'superadmin'
  or (app_private.current_profile_role() = 'rw' and rw_id = app_private.current_profile_rw_id())
  or (app_private.current_profile_role() = 'rt' and rt_id = app_private.current_profile_rt_id())
);

insert into storage.buckets (id, name, public)
values ('resident-documents', 'resident-documents', false)
on conflict (id) do nothing;

-- Documents must be uploaded under the path "{rw_id}/{rt_id}/filename" so
-- these policies can scope access the same way every other table does.
drop policy if exists "resident documents authenticated read" on storage.objects;
drop policy if exists "resident documents authenticated insert" on storage.objects;
drop policy if exists "resident documents authenticated update" on storage.objects;
drop policy if exists "resident documents authenticated delete" on storage.objects;

drop policy if exists "resident documents scoped read" on storage.objects;
create policy "resident documents scoped read"
on storage.objects for select to authenticated
using (
  bucket_id = 'resident-documents'
  and (
    app_private.current_profile_role() = 'superadmin'
    or (
      app_private.current_profile_role() = 'rw'
      and (storage.foldername(name))[1] = app_private.current_profile_rw_id()::text
    )
    or (
      app_private.current_profile_role() = 'rt'
      and (storage.foldername(name))[1] = app_private.current_profile_rw_id()::text
      and (storage.foldername(name))[2] = app_private.current_profile_rt_id()::text
    )
  )
);

drop policy if exists "resident documents scoped insert" on storage.objects;
create policy "resident documents scoped insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'resident-documents'
  and (
    app_private.current_profile_role() = 'superadmin'
    or (
      app_private.current_profile_role() = 'rw'
      and (storage.foldername(name))[1] = app_private.current_profile_rw_id()::text
    )
    or (
      app_private.current_profile_role() = 'rt'
      and (storage.foldername(name))[1] = app_private.current_profile_rw_id()::text
      and (storage.foldername(name))[2] = app_private.current_profile_rt_id()::text
    )
  )
);

drop policy if exists "resident documents scoped update" on storage.objects;
create policy "resident documents scoped update"
on storage.objects for update to authenticated
using (
  bucket_id = 'resident-documents'
  and (
    app_private.current_profile_role() = 'superadmin'
    or (
      app_private.current_profile_role() = 'rw'
      and (storage.foldername(name))[1] = app_private.current_profile_rw_id()::text
    )
    or (
      app_private.current_profile_role() = 'rt'
      and (storage.foldername(name))[1] = app_private.current_profile_rw_id()::text
      and (storage.foldername(name))[2] = app_private.current_profile_rt_id()::text
    )
  )
)
with check (
  bucket_id = 'resident-documents'
  and (
    app_private.current_profile_role() = 'superadmin'
    or (
      app_private.current_profile_role() = 'rw'
      and (storage.foldername(name))[1] = app_private.current_profile_rw_id()::text
    )
    or (
      app_private.current_profile_role() = 'rt'
      and (storage.foldername(name))[1] = app_private.current_profile_rw_id()::text
      and (storage.foldername(name))[2] = app_private.current_profile_rt_id()::text
    )
  )
);

drop policy if exists "resident documents scoped delete" on storage.objects;
create policy "resident documents scoped delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'resident-documents'
  and (
    app_private.current_profile_role() = 'superadmin'
    or (
      app_private.current_profile_role() = 'rw'
      and (storage.foldername(name))[1] = app_private.current_profile_rw_id()::text
    )
    or (
      app_private.current_profile_role() = 'rt'
      and (storage.foldername(name))[1] = app_private.current_profile_rw_id()::text
      and (storage.foldername(name))[2] = app_private.current_profile_rt_id()::text
    )
  )
);

create index if not exists regions_type_idx on public.regions(type);
create index if not exists regions_parent_id_idx on public.regions(parent_id);
create index if not exists family_cards_rw_rt_idx on public.family_cards(rw_id, rt_id);
create index if not exists residents_rw_rt_idx on public.residents(rw_id, rt_id);
create index if not exists resident_mutations_rw_rt_date_idx on public.resident_mutations(rw_id, rt_id, mutation_date);
