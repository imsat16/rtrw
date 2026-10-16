-- Status kepemilikan dokumen; data lama dimulai dengan nilai false.
alter table public.residents
  add column if not exists has_birth_certificate boolean not null default false,
  add column if not exists has_kia boolean not null default false,
  add column if not exists has_ktp boolean not null default false;
