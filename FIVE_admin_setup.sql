-- FIVE admin tools
-- Run this entire file in Supabase SQL Editor while signed in as project owner.
-- After it runs, add your own Supabase Auth user to public.five_admins using the
-- one-time bootstrap statement at the bottom of this file.

begin;

create table if not exists public.five_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.five_admins enable row level security;
revoke all on table public.five_admins from public, anon, authenticated;

create or replace function public.is_five_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.five_admins a
    where a.user_id = auth.uid()
  );
$function$;

create or replace function public.admin_list_submissions()
returns table (
  id uuid,
  name text,
  country text,
  instagram_url text,
  website_url text,
  status text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if not public.is_five_admin() then
    raise exception 'Admin access required';
  end if;

  return query
  select s.id, s.name, s.country, s.instagram_url, s.website_url,
         s.status::text, s.created_at
  from public.artist_submissions s
  order by
    case when s.status = 'pending'::public.submission_status then 0 else 1 end,
    s.created_at desc;
end;
$function$;

create or replace function public.admin_list_artists()
returns table (
  id uuid,
  name text,
  country text,
  status text,
  categories text[],
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if not public.is_five_admin() then
    raise exception 'Admin access required';
  end if;

  return query
  select a.id, a.name, a.country, a.status::text, a.categories, a.created_at
  from public.artists a
  order by
    case when a.status = 'approved'::public.artist_status then 0 else 1 end,
    a.name asc;
end;
$function$;

create or replace function public.admin_review_submission(
  p_submission_id uuid,
  p_decision text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  s public.artist_submissions%rowtype;
  v_artist_id uuid;
  v_slug text;
begin
  if not public.is_five_admin() then
    raise exception 'Admin access required';
  end if;

  if p_decision not in ('approved', 'rejected') then
    raise exception 'Decision must be approved or rejected';
  end if;

  select * into s
  from public.artist_submissions
  where id = p_submission_id
  for update;

  if not found then
    raise exception 'Submission not found';
  end if;

  if s.status <> 'pending'::public.submission_status then
    raise exception 'This submission has already been reviewed';
  end if;

  if p_decision = 'rejected' then
    update public.artist_submissions
    set status = 'rejected'::public.submission_status,
        reviewed_at = now()
    where id = p_submission_id;
    return null;
  end if;

  select a.id into v_artist_id
  from public.artists a
  where lower(a.name) = lower(s.name)
    and lower(a.country) = lower(s.country)
  order by (a.status = 'approved'::public.artist_status) desc
  limit 1;

  if v_artist_id is null then
    v_slug := trim(both '-' from regexp_replace(lower(s.name), '[^a-z0-9]+', '-', 'g'));
    if v_slug = '' then
      v_slug := 'artist';
    end if;
    if exists (select 1 from public.artists a where a.slug = v_slug) then
      v_slug := v_slug || '-' || left(replace(gen_random_uuid()::text, '-', ''), 8);
    end if;

    insert into public.artists (
      name, slug, country, instagram_url, website_url,
      status, approved_at, categories
    ) values (
      s.name, v_slug, s.country, s.instagram_url, s.website_url,
      'approved'::public.artist_status, now(), '{}'::text[]
    )
    returning id into v_artist_id;
  else
    update public.artists
    set status = 'approved'::public.artist_status,
        approved_at = coalesce(approved_at, now()),
        instagram_url = coalesce(nullif(s.instagram_url, ''), instagram_url),
        website_url = coalesce(nullif(s.website_url, ''), website_url)
    where id = v_artist_id;
  end if;

  update public.artist_submissions
  set status = 'approved'::public.submission_status,
      reviewed_at = now()
  where id = p_submission_id;

  return v_artist_id;
end;
$function$;

create or replace function public.admin_add_artist(
  p_name text,
  p_country text,
  p_instagram_url text default null,
  p_website_url text default null,
  p_image_url text default null,
  p_categories text[] default '{}'::text[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_slug text;
  v_artist_id uuid;
begin
  if not public.is_five_admin() then
    raise exception 'Admin access required';
  end if;

  if nullif(trim(p_name), '') is null or nullif(trim(p_country), '') is null then
    raise exception 'Artist name and country are required';
  end if;

  if exists (
    select 1 from public.artists a
    where lower(a.name) = lower(trim(p_name))
      and lower(a.country) = lower(trim(p_country))
  ) then
    raise exception 'An artist with this name and country already exists';
  end if;

  v_slug := trim(both '-' from regexp_replace(lower(trim(p_name)), '[^a-z0-9]+', '-', 'g'));
  if v_slug = '' then
    v_slug := 'artist';
  end if;
  if exists (select 1 from public.artists a where a.slug = v_slug) then
    v_slug := v_slug || '-' || left(replace(gen_random_uuid()::text, '-', ''), 8);
  end if;

  insert into public.artists (
    name, slug, country, instagram_url, website_url, image_url,
    status, approved_at, categories
  ) values (
    trim(p_name), v_slug, trim(p_country),
    nullif(trim(p_instagram_url), ''), nullif(trim(p_website_url), ''),
    nullif(trim(p_image_url), ''), 'approved'::public.artist_status,
    now(), coalesce(p_categories, '{}'::text[])
  )
  returning id into v_artist_id;

  return v_artist_id;
end;
$function$;

create or replace function public.admin_remove_artist(p_artist_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_call_count bigint;
begin
  if not public.is_five_admin() then
    raise exception 'Admin access required';
  end if;

  if not exists (select 1 from public.artists a where a.id = p_artist_id) then
    raise exception 'Artist not found';
  end if;

  select count(*) into v_call_count
  from public.calls c
  where c.artist_id = p_artist_id;

  if v_call_count > 0 then
    -- Preserve historical votes and joins; remove the artist from public/game use.
    update public.artists
    set status = 'rejected'::public.artist_status
    where id = p_artist_id;
    return 'archived';
  else
    delete from public.artists where id = p_artist_id;
    return 'deleted';
  end if;
end;
$function$;

revoke all on function public.is_five_admin() from public, anon;
revoke all on function public.admin_list_submissions() from public, anon;
revoke all on function public.admin_list_artists() from public, anon;
revoke all on function public.admin_review_submission(uuid, text) from public, anon;
revoke all on function public.admin_add_artist(text, text, text, text, text, text[]) from public, anon;
revoke all on function public.admin_remove_artist(uuid) from public, anon;

grant execute on function public.is_five_admin() to authenticated;
grant execute on function public.admin_list_submissions() to authenticated;
grant execute on function public.admin_list_artists() to authenticated;
grant execute on function public.admin_review_submission(uuid, text) to authenticated;
grant execute on function public.admin_add_artist(text, text, text, text, text, text[]) to authenticated;
grant execute on function public.admin_remove_artist(uuid) to authenticated;

commit;

-- ONE-TIME ADMIN SETUP:
-- Replace the email below with the email used to sign in to FIVE.
-- Run this separately after the migration, as the Supabase project owner.
insert into public.five_admins (user_id)
select id
from auth.users
where lower(email) = lower('YOUR_LOGIN_EMAIL_HERE')
on conflict (user_id) do nothing;

-- Verify that exactly your account was made an admin:
-- select u.email, a.user_id
-- from public.five_admins a
-- join auth.users u on u.id = a.user_id;
