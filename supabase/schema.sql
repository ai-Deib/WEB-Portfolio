create table if not exists public.portfolio_groups (
  name text primary key check (char_length(name) between 1 and 40),
  display_order integer not null check (display_order >= 0)
);

create table if not exists public.portfolio_projects (
  id text primary key,
  title text not null check (char_length(title) between 1 and 80),
  category text not null references public.portfolio_groups(name) on update cascade on delete restrict,
  description text not null default '',
  client text not null default '',
  year text not null,
  file_type text not null,
  media_path text not null,
  poster_path text,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists portfolio_projects_public_order
  on public.portfolio_projects (archived, created_at desc);

create table if not exists public.portfolio_socials (
  id text primary key,
  name text not null check (char_length(name) between 1 and 40),
  handle text not null default '',
  url text not null,
  logo_preset text not null default 'website',
  logo_path text,
  display_order integer not null default 0 check (display_order >= 0)
);

create table if not exists public.studio_login_attempts (
  ip_hash text primary key,
  attempts integer not null default 0 check (attempts >= 0),
  window_started_at timestamptz not null default now()
);

create index if not exists studio_login_attempts_window
  on public.studio_login_attempts (window_started_at);

alter table public.portfolio_groups enable row level security;
alter table public.portfolio_projects enable row level security;
alter table public.portfolio_socials enable row level security;
alter table public.studio_login_attempts enable row level security;

revoke all on public.portfolio_groups from anon, authenticated;
revoke all on public.portfolio_projects from anon, authenticated;
revoke all on public.portfolio_socials from anon, authenticated;
revoke all on public.studio_login_attempts from anon, authenticated;
grant all on public.portfolio_groups to service_role;
grant all on public.portfolio_projects to service_role;
grant all on public.portfolio_socials to service_role;
grant all on public.studio_login_attempts to service_role;

insert into public.portfolio_groups (name, display_order)
values
  ('Documentary', 0),
  ('Longform', 1),
  ('Motion Graphics', 2),
  ('SaaS', 3),
  ('Shortform', 4),
  ('Typography', 5)
on conflict (name) do nothing;

insert into public.portfolio_socials (id, name, handle, url, logo_preset, display_order)
values
  ('social-instagram', 'Instagram', '@xairo.studio', 'https://instagram.com/', 'instagram', 0),
  ('social-youtube', 'YouTube', 'youtube.com/@xairo', 'https://youtube.com/', 'youtube', 1),
  ('social-x', 'X / Twitter', '@xairo', 'https://x.com/', 'x', 2),
  ('social-email', 'Email', 'hello@xairo.studio', 'mailto:hello@xairo.studio', 'email', 3)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'portfolio-media',
  'portfolio-media',
  true,
  52428800,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'video/mp4']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.delete_portfolio_group(group_name text, reassign_to text)
returns void
language plpgsql
as $$
declare
  group_count integer;
  project_count integer;
begin
  lock table public.portfolio_groups in exclusive mode;
  select count(*) into group_count from public.portfolio_groups;
  if group_count <= 1 then
    raise exception 'At least one portfolio group must remain.';
  end if;
  if not exists (select 1 from public.portfolio_groups where name = group_name) then
    raise exception 'The portfolio group no longer exists.';
  end if;
  if reassign_to is not null and not exists (
    select 1 from public.portfolio_groups where name = reassign_to and name <> group_name
  ) then
    raise exception 'Choose another existing group for these projects.';
  end if;

  select count(*) into project_count from public.portfolio_projects where category = group_name;
  if project_count > 0 and reassign_to is null then
    raise exception 'Choose a destination group for the assigned projects.';
  end if;
  if project_count > 0 then
    update public.portfolio_projects set category = reassign_to where category = group_name;
  end if;
  delete from public.portfolio_groups where name = group_name;
end;
$$;

create or replace function public.reset_portfolio_socials(social_items jsonb)
returns void
language plpgsql
as $$
begin
  if jsonb_typeof(social_items) is distinct from 'array' then
    raise exception 'Social links must be supplied as a list.';
  end if;
  delete from public.portfolio_socials;
  insert into public.portfolio_socials (id, name, handle, url, logo_preset, logo_path, display_order)
  select item.id, item.name, coalesce(item.handle, ''), item.url, coalesce(item.logo_preset, 'website'),
    item.logo_path, coalesce(item.display_order, 0)
  from jsonb_to_recordset(social_items) as item(
    id text,
    name text,
    handle text,
    url text,
    logo_preset text,
    logo_path text,
    display_order integer
  );
end;
$$;

create or replace function public.record_studio_failed_login(p_ip_hash text)
returns integer
language plpgsql
as $$
declare
  current_attempts integer;
begin
  delete from public.studio_login_attempts
  where window_started_at < now() - interval '1 day';

  insert into public.studio_login_attempts as existing (ip_hash, attempts, window_started_at)
  values (p_ip_hash, 1, now())
  on conflict (ip_hash) do update set
    attempts = case
      when existing.window_started_at <= now() - interval '15 minutes' then 1
      else existing.attempts + 1
    end,
    window_started_at = case
      when existing.window_started_at <= now() - interval '15 minutes' then now()
      else existing.window_started_at
    end
  returning attempts into current_attempts;
  return current_attempts;
end;
$$;

create or replace function public.clear_studio_failed_logins(p_ip_hash text)
returns void
language sql
as $$
  delete from public.studio_login_attempts where studio_login_attempts.ip_hash = p_ip_hash;
$$;

revoke all on function public.delete_portfolio_group(text, text) from public, anon, authenticated;
revoke all on function public.reset_portfolio_socials(jsonb) from public, anon, authenticated;
revoke all on function public.record_studio_failed_login(text) from public, anon, authenticated;
revoke all on function public.clear_studio_failed_logins(text) from public, anon, authenticated;
grant execute on function public.delete_portfolio_group(text, text) to service_role;
grant execute on function public.reset_portfolio_socials(jsonb) to service_role;
grant execute on function public.record_studio_failed_login(text) to service_role;
grant execute on function public.clear_studio_failed_logins(text) to service_role;
