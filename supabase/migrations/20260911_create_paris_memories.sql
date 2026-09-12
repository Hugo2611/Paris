-- Run this file in Supabase SQL Editor. Create Hugo and Marie in Auth first,
-- then give Hugo the app_metadata role shown at the end of this script.

create extension if not exists pgcrypto;

create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  title text not null check (char_length(title) between 1 and 140),
  description text not null default '',
  date date not null default current_date,
  -- Colonne multi-médias JSONB : [{ url: "...", type: "image"|"video" }]
  media jsonb not null default '[]'::jsonb,
  -- Colonnes historiques conservées pour rétrocompatibilité
  media_url text not null default '',
  media_type text not null default 'image' check (media_type in ('image', 'video')),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Assure l'existence de la colonne media si la table existait déjà auparavant
alter table public.memories add column if not exists media jsonb not null default '[]'::jsonb;

alter table public.memories enable row level security;
grant select, insert, update, delete on public.memories to authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

grant execute on function public.is_admin() to authenticated;

drop policy if exists "Authenticated users can read memories" on public.memories;
create policy "Authenticated users can read memories"
  on public.memories for select to authenticated using (true);

drop policy if exists "Admins can create memories" on public.memories;
create policy "Admins can create memories"
  on public.memories for insert to authenticated with check (public.is_admin());

drop policy if exists "Admins can update memories" on public.memories;
create policy "Admins can update memories"
  on public.memories for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins can delete memories" on public.memories;
create policy "Admins can delete memories"
  on public.memories for delete to authenticated using (public.is_admin());

insert into storage.buckets (id, name, public)
values ('media', 'media', false)
on conflict (id) do update set public = false;

drop policy if exists "Authenticated users can read media" on storage.objects;
create policy "Authenticated users can read media"
  on storage.objects for select to authenticated using (bucket_id = 'media');

drop policy if exists "Admins can upload media" on storage.objects;
create policy "Admins can upload media"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and public.is_admin());

drop policy if exists "Admins can update media" on storage.objects;
create policy "Admins can update media"
  on storage.objects for update to authenticated
  using (bucket_id = 'media' and public.is_admin())
  with check (bucket_id = 'media' and public.is_admin());

drop policy if exists "Admins can delete media" on storage.objects;
create policy "Admins can delete media"
  on storage.objects for delete to authenticated
  using (bucket_id = 'media' and public.is_admin());

-- After creating the two Auth users in Dashboard > Authentication > Users,
-- replace the emails below then execute these statements. The users must sign
-- out/in afterwards so their JWT receives the role.
-- update auth.users
-- set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb,
--     raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || '{"display_name":"Hugo"}'::jsonb
-- where email = 'hugo@your-domain.com';
-- update auth.users
-- set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"viewer"}'::jsonb,
--     raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || '{"display_name":"Marie"}'::jsonb
-- where email = 'marie@your-domain.com';
