-- Stitch Start database.
-- Every table uses Row Level Security: each person can only see and change their own rows.

-- Machines a person has saved. machine_id points to a profile in src/core/machines.ts.
create table public.user_machines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  machine_id text not null check (char_length(machine_id) between 1 and 80),
  created_at timestamptz not null default now(),
  unique (user_id, machine_id)
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  machine_id text not null check (char_length(machine_id) between 1 and 80),
  title text not null check (char_length(title) between 1 and 200),
  project_type text not null check (char_length(project_type) <= 40),
  item text not null check (char_length(item) <= 40),
  letter_text text check (char_length(letter_text) <= 100),
  letter_height numeric check (letter_height > 0 and letter_height < 100),
  width numeric check (width > 0 and width < 100),
  height numeric check (height > 0 and height < 100),
  notes text check (char_length(notes) <= 2000),
  file_kind text check (file_kind in ('image', 'other')),
  file_ext text check (char_length(file_ext) <= 10),
  image_path text,
  advice text,
  advice_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index projects_user_created on public.projects (user_id, created_at desc);

-- Machines people searched for but we don't have yet. Only you (the owner) read these, in the dashboard.
create table public.machine_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default auth.uid() references auth.users (id) on delete set null,
  brand_model text not null check (char_length(brand_model) between 1 and 120),
  created_at timestamptz not null default now()
);

-- One row per "Ask Claude", used for the daily limit. Only the server reads or writes it.
create table public.ai_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index ai_usage_user_created on public.ai_usage (user_id, created_at desc);

-- Keep updated_at current.
create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger projects_touch before update on public.projects
  for each row execute function public.touch_updated_at();

-- ---------- Row Level Security ----------
alter table public.user_machines enable row level security;
alter table public.projects enable row level security;
alter table public.machine_requests enable row level security;
alter table public.ai_usage enable row level security;

create policy "Own machines: read" on public.user_machines for select to authenticated using (user_id = (select auth.uid()));
create policy "Own machines: add" on public.user_machines for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Own machines: remove" on public.user_machines for delete to authenticated using (user_id = (select auth.uid()));

create policy "Own projects: read" on public.projects for select to authenticated using (user_id = (select auth.uid()));
create policy "Own projects: add" on public.projects for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Own projects: edit" on public.projects for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Own projects: delete" on public.projects for delete to authenticated using (user_id = (select auth.uid()));

create policy "Request a machine" on public.machine_requests for insert to authenticated with check (user_id = (select auth.uid()));
-- ai_usage has no policies on purpose: only the server (service role) can touch it.

-- ---------- Design pictures ----------
-- Private bucket. Files live under a folder named after the person's user id.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('designs', 'designs', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic']);

create policy "Own designs: read" on storage.objects for select to authenticated
  using (bucket_id = 'designs' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Own designs: upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'designs' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Own designs: replace" on storage.objects for update to authenticated
  using (bucket_id = 'designs' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Own designs: delete" on storage.objects for delete to authenticated
  using (bucket_id = 'designs' and (storage.foldername(name))[1] = (select auth.uid())::text);
