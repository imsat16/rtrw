-- Pemulihan satu kali untuk akun Authentication yang masih ada tetapi tidak
-- mempunyai profile. Jalankan melalui Supabase SQL Editor.
insert into public.profiles (
  id,
  email,
  display_name,
  role_id,
  created_at,
  updated_at
)
select
  u.id,
  u.email,
  'Superadmin',
  mr.id,
  now(),
  now()
from auth.users u
cross join public.master_roles mr
where u.id = '4f1a9b4a-72d4-4074-aa03-52ad9cce2bac'::uuid
  and u.email = 'superadmin@mailnesia.com'
  and mr.code = 'superadmin'
on conflict (id) do update set
  email = excluded.email,
  display_name = excluded.display_name,
  role_id = excluded.role_id,
  province_id = null,
  city_id = null,
  district_id = null,
  village_id = null,
  rw_id = null,
  rt_id = null,
  updated_at = now();

-- Lindungi profil Superadmin dari penghapusan langsung maupun penghapusan
-- auth.users yang akan melakukan cascade ke public.profiles.
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

revoke all on function app_private.prevent_superadmin_profile_delete() from public, anon, authenticated;
drop trigger if exists profiles_protect_superadmin_delete on public.profiles;
create trigger profiles_protect_superadmin_delete
before delete on public.profiles
for each row execute function app_private.prevent_superadmin_profile_delete();

-- Batasi penghapusan lewat Data API. Superadmin, akun aktif, dan akun di luar
-- scope tetap tidak dapat dihapus.
drop policy if exists "profiles scoped delete" on public.profiles;
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

-- Hasil wajib satu baris dengan role_code = superadmin.
select
  p.id,
  p.email,
  p.display_name,
  mr.code as role_code
from public.profiles p
join public.master_roles mr on mr.id = p.role_id
where p.id = '4f1a9b4a-72d4-4074-aa03-52ad9cce2bac'::uuid;
