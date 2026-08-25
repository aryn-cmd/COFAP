-- ============================================================================
-- COFAP full schema — run this whole file in Supabase Dashboard -> SQL Editor.
-- Idempotent: safe to paste again after future edits.
-- ============================================================================

-- ============================================================================
-- 1. CORE TABLES
-- ============================================================================
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 60),
  invite_code text unique not null default substr(md5(random()::text || clock_timestamp()::text), 1, 10),
  owner_id uuid not null references auth.users(id) on delete cascade,
  max_members integer not null default 12,
  created_at timestamptz not null default now()
);
alter table public.groups add column if not exists max_members integer not null default 12;
alter table public.groups drop constraint if exists groups_max_members_check;
alter table public.groups add constraint groups_max_members_check check (max_members between 10 and 12);

create table if not exists public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  leave_requested_at timestamptz,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
alter table public.group_members add column if not exists leave_requested_at timestamptz;

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 120),
  category text not null check (category in ('academic', 'fitness', 'misc')),
  points numeric(6,1) not null default 0,
  hours numeric(4,1),
  description text,
  description_visible boolean not null default true,
  activity_date date not null default current_date,
  created_at timestamptz not null default now()
);
alter table public.activities add column if not exists description text;
alter table public.activities add column if not exists description_visible boolean not null default true;
alter table public.activities add column if not exists hours numeric(4,1);
alter table public.activities drop constraint if exists activities_description_check;
alter table public.activities add constraint activities_description_check check (description is null or char_length(description) <= 280);
alter table public.activities drop constraint if exists activities_hours_check;
alter table public.activities add constraint activities_hours_check check (hours is null or hours > 0);
alter table public.activities alter column points type numeric(6,1) using points::numeric(6,1);
alter table public.activities drop constraint if exists activities_points_check;
alter table public.activities add constraint activities_points_check check (points > 0);

-- ============================================================================
-- 2. PROFILES — nickname + phone are optional; email lives only in auth.users
--    and is never duplicated here, so there's nothing for the app to edit.
-- ============================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(full_name) between 2 and 80),
  organization text not null check (char_length(organization) between 2 and 100),
  nickname text check (nickname is null or char_length(nickname) <= 40),
  phone_number text check (phone_number is null or char_length(phone_number) <= 20),
  bio text check (bio is null or char_length(bio) <= 280),
  is_admin boolean not null default false,
  team_notifications_enabled boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.profiles add column if not exists nickname text;
alter table public.profiles add column if not exists phone_number text;

-- ============================================================================
-- 3. HELPER FUNCTIONS
-- ============================================================================
-- "Active" membership = not on a completed 30-day leave. Someone who has
-- requested to leave stays a full member (counts toward capacity, appears on
-- the leaderboard, keeps access) until their notice period actually elapses.
create or replace function public.is_group_member(target_group uuid)
returns boolean language sql security definer set search_path = public stable
as $$
  select exists (
    select 1 from public.group_members
    where group_id = target_group
      and user_id = auth.uid()
      and (leave_requested_at is null or leave_requested_at + interval '30 days' > now())
  );
$$;

create or replace function public.is_admin()
returns boolean language sql security definer set search_path = public stable
as $$ select coalesce((select is_admin from public.profiles where id = auth.uid()), false); $$;

create or replace function public.shares_group_with(target_user uuid)
returns boolean language sql security definer set search_path = public stable
as $$
  select exists (
    select 1 from public.group_members gm1
    join public.group_members gm2 on gm1.group_id = gm2.group_id
    where gm1.user_id = auth.uid() and gm2.user_id = target_user
  );
$$;

create or replace function public.prevent_privilege_escalation()
returns trigger language plpgsql as $$
begin
  if new.is_admin is distinct from old.is_admin and not public.is_admin() then
    new.is_admin := old.is_admin;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_prevent_privilege_escalation on public.profiles;
create trigger trg_prevent_privilege_escalation
  before update on public.profiles
  for each row execute function public.prevent_privilege_escalation();

-- ============================================================================
-- 4. ACTIVITY POINTS — computed server-side, never trusted from the client.
--    Academic = 1 point per hour, capped at 8 hours per person per day.
--    Fitness = flat 3. Misc = flat 2.
-- ============================================================================
create or replace function public.enforce_activity_points()
returns trigger language plpgsql security definer set search_path = public
as $$
declare total_today numeric;
begin
  if new.category = 'academic' then
    if new.hours is null or new.hours <= 0 then
      raise exception 'Academic tasks need a positive number of hours';
    end if;
    select coalesce(sum(hours), 0) into total_today
      from public.activities
      where user_id = new.user_id and group_id = new.group_id and category = 'academic' and activity_date = new.activity_date;
    if total_today + new.hours > 8 then
      raise exception 'Academic hours for % are capped at 8/day (already logged %)', new.activity_date, total_today;
    end if;
    new.points := new.hours;
  elsif new.category = 'fitness' then
    new.points := 3;
  elsif new.category = 'misc' then
    new.points := 2;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_enforce_activity_points on public.activities;
create trigger trg_enforce_activity_points
  before insert on public.activities
  for each row execute function public.enforce_activity_points();

-- ============================================================================
-- 5. ROW LEVEL SECURITY
-- ============================================================================
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.activities enable row level security;
alter table public.profiles enable row level security;

drop policy if exists "members can view groups" on public.groups;
create policy "members can view groups" on public.groups for select using (public.is_group_member(id) or public.is_admin());
drop policy if exists "authenticated users can create groups" on public.groups;
create policy "authenticated users can create groups" on public.groups for insert with check (auth.uid() = owner_id);
drop policy if exists "owners can update groups" on public.groups;
create policy "owners can update groups" on public.groups for update using (auth.uid() = owner_id);

drop policy if exists "members can view memberships" on public.group_members;
create policy "members can view memberships" on public.group_members for select using (public.is_group_member(group_id) or public.is_admin());

drop policy if exists "members can view activities" on public.activities;
create policy "members can view activities" on public.activities for select using (public.is_group_member(group_id) or public.is_admin());
drop policy if exists "users can add their activities" on public.activities;
create policy "users can add their activities" on public.activities for insert with check (auth.uid() = user_id and public.is_group_member(group_id));
-- Deliberately no UPDATE or DELETE policy: activities are immutable once
-- logged. RLS defaults to deny when a table has no policy for a command, so
-- this is the entire enforcement — nobody, including the author, can edit
-- or remove a logged task afterwards.
drop policy if exists "users can update their activities" on public.activities;
drop policy if exists "users can delete their activities" on public.activities;

drop policy if exists "profiles: self, teammates, or admin can view" on public.profiles;
create policy "profiles: self, teammates, or admin can view" on public.profiles
  for select using (id = auth.uid() or public.shares_group_with(id) or public.is_admin());
drop policy if exists "profiles: user can insert own row" on public.profiles;
create policy "profiles: user can insert own row" on public.profiles for insert with check (id = auth.uid());
drop policy if exists "profiles: user can update own row" on public.profiles;
create policy "profiles: user can update own row" on public.profiles for update using (id = auth.uid());

-- ============================================================================
-- 6. TEAM CREATE / JOIN — capacity-checked (10-12, owner's choice at creation)
-- ============================================================================
create or replace function public.create_cofap_team(team_name text, team_size integer default 12)
returns table (id uuid, name text, invite_code text, max_members integer)
language plpgsql security definer set search_path = public
as $$
declare new_group public.groups; capped integer;
begin
  if auth.uid() is null then raise exception 'You must be signed in'; end if;
  capped := greatest(10, least(12, coalesce(team_size, 12)));
  insert into public.groups (name, owner_id, max_members) values (team_name, auth.uid(), capped) returning * into new_group;
  insert into public.group_members (group_id, user_id, role) values (new_group.id, auth.uid(), 'owner');
  return query select new_group.id, new_group.name, new_group.invite_code, new_group.max_members;
end;
$$;

create or replace function public.join_cofap_team(invite_code_input text)
returns table (id uuid, name text)
language plpgsql security definer set search_path = public
as $$
declare target_group public.groups; active_count integer;
begin
  if auth.uid() is null then raise exception 'You must be signed in'; end if;
  select * into target_group from public.groups where groups.invite_code = upper(trim(invite_code_input));
  if target_group.id is null then raise exception 'Team key not found'; end if;
  select count(*) into active_count from public.group_members
    where group_id = target_group.id and (leave_requested_at is null or leave_requested_at + interval '30 days' > now());
  if active_count >= target_group.max_members then
    raise exception 'This team is full (% / % members)', active_count, target_group.max_members;
  end if;
  insert into public.group_members (group_id, user_id) values (target_group.id, auth.uid()) on conflict do nothing;
  return query select target_group.id, target_group.name;
end;
$$;

revoke all on function public.create_cofap_team(text, integer) from public;
grant execute on function public.create_cofap_team(text, integer) to authenticated;
revoke all on function public.join_cofap_team(text) from public;
grant execute on function public.join_cofap_team(text) to authenticated;

-- ============================================================================
-- 7. LEAVING A TEAM — 30-day notice, cancellable any time before it lands
-- ============================================================================
create or replace function public.request_leave_team(target_group uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'You must be signed in'; end if;
  update public.group_members set leave_requested_at = now()
    where group_id = target_group and user_id = auth.uid() and leave_requested_at is null;
  if not found then raise exception 'No active membership to leave, or a leave request is already pending'; end if;
end;
$$;

create or replace function public.cancel_leave_team(target_group uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'You must be signed in'; end if;
  update public.group_members set leave_requested_at = null
    where group_id = target_group and user_id = auth.uid() and leave_requested_at is not null;
  if not found then raise exception 'No pending leave request to cancel'; end if;
end;
$$;

revoke all on function public.request_leave_team(uuid) from public;
grant execute on function public.request_leave_team(uuid) to authenticated;
revoke all on function public.cancel_leave_team(uuid) from public;
grant execute on function public.cancel_leave_team(uuid) to authenticated;

-- Nightly cleanup once a leave's 30 days are actually up. Enforcement of
-- "you've left" is already immediate via is_group_member() above the moment
-- the 30 days pass — this just tidies the row away. Requires pg_cron; if
-- your project can't enable it, everything above still works correctly
-- without this, just with stale rows lingering in group_members.
create or replace function public.finalize_departed_members()
returns void language sql security definer set search_path = public
as $$
  delete from public.group_members
  where leave_requested_at is not null and leave_requested_at + interval '30 days' <= now();
$$;

-- This whole block is wrapped so that if pg_cron isn't available on your
-- plan/region (a permission or "extension not available" error), it's
-- caught and logged as a NOTICE instead of aborting the rest of this script.
-- Everything above this point works correctly without pg_cron regardless.
do $$
begin
  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'pg_cron could not be enabled automatically (%). Enable it manually from Database > Extensions if you want automatic cleanup of completed 30-day leaves; everything else in this schema works fine without it.', sqlerrm;
  end;
end $$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      if not exists (select 1 from cron.job where jobname = 'cofap-finalize-leaves') then
        perform cron.schedule('cofap-finalize-leaves', '0 3 * * *', $job$select public.finalize_departed_members();$job$);
      end if;
    exception when others then
      raise notice 'pg_cron is enabled but scheduling the cleanup job failed (%). You can schedule it yourself later from the SQL editor.', sqlerrm;
    end;
  end if;
end $$;

-- ============================================================================
-- 8. LEADERBOARD & TEAM OVERVIEW
-- ============================================================================
create or replace function public.get_team_leaderboard(target_group uuid)
returns table (user_id uuid, full_name text, organization text, points numeric)
language sql security definer set search_path = public stable
as $$
  select p.id, p.full_name, p.organization, coalesce(sum(a.points), 0)::numeric(8,1) as points
  from public.group_members gm
  join public.profiles p on p.id = gm.user_id
  left join public.activities a on a.user_id = gm.user_id and a.group_id = gm.group_id
  where gm.group_id = target_group
    and public.is_group_member(target_group)
    and (gm.leave_requested_at is null or gm.leave_requested_at + interval '30 days' > now())
  group by p.id, p.full_name, p.organization
  order by points desc, p.full_name asc;
$$;
grant execute on function public.get_team_leaderboard(uuid) to authenticated;

create or replace function public.get_my_teams_overview()
returns table (
  group_id uuid, name text, invite_code text, max_members integer,
  role text, leave_requested_at timestamptz, active_member_count bigint, joined_at timestamptz
)
language sql security definer set search_path = public stable
as $$
  select g.id, g.name, g.invite_code, g.max_members, gm.role, gm.leave_requested_at,
    (select count(*) from public.group_members gm2
       where gm2.group_id = g.id
         and (gm2.leave_requested_at is null or gm2.leave_requested_at + interval '30 days' > now())) as active_member_count,
    gm.joined_at
  from public.group_members gm
  join public.groups g on g.id = gm.group_id
  where gm.user_id = auth.uid();
$$;
grant execute on function public.get_my_teams_overview() to authenticated;

-- Team activity feed with per-task privacy enforced server-side (not just
-- hidden in the UI): a hidden description comes back as null for anyone but
-- its author, with has_description telling the frontend "there was one, it's
-- just private" versus "nothing was written".
create or replace function public.get_team_activity_feed(target_group uuid, limit_count integer default 40)
returns table (
  id uuid, user_id uuid, full_name text, title text, category text,
  points numeric, hours numeric, activity_date date, created_at timestamptz,
  description text, has_description boolean
)
language sql security definer set search_path = public stable
as $$
  select a.id, a.user_id, p.full_name, a.title, a.category, a.points, a.hours, a.activity_date, a.created_at,
    case when a.description_visible or a.user_id = auth.uid() then a.description else null end as description,
    (a.description is not null) as has_description
  from public.activities a
  join public.profiles p on p.id = a.user_id
  where a.group_id = target_group and public.is_group_member(target_group)
  order by a.created_at desc
  limit limit_count;
$$;
grant execute on function public.get_team_activity_feed(uuid, integer) to authenticated;

-- ============================================================================
-- 9. NOTIFICATIONS — broadcast (you -> everyone) and team (member -> team)
-- ============================================================================
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('broadcast', 'team')),
  group_id uuid references public.groups(id) on delete cascade,
  sender_id uuid references auth.users(id) on delete set null,
  title text not null check (char_length(title) between 1 and 80),
  message text not null check (char_length(message) between 1 and 400),
  created_at timestamptz not null default now(),
  constraint team_scope_requires_group check (scope <> 'team' or group_id is not null)
);
alter table public.notifications enable row level security;

create table if not exists public.notification_reads (
  notification_id uuid not null references public.notifications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (notification_id, user_id)
);
alter table public.notification_reads enable row level security;

drop policy if exists "notifications: readable by target audience" on public.notifications;
create policy "notifications: readable by target audience" on public.notifications
  for select using (scope = 'broadcast' or (scope = 'team' and public.is_group_member(group_id)) or public.is_admin());
drop policy if exists "notifications: admin broadcasts, members post to their own team" on public.notifications;
create policy "notifications: admin broadcasts, members post to their own team" on public.notifications
  for insert with check (
    sender_id = auth.uid()
    and ((scope = 'broadcast' and public.is_admin()) or (scope = 'team' and public.is_group_member(group_id)))
  );
drop policy if exists "notification_reads: own rows only" on public.notification_reads;
create policy "notification_reads: own rows only" on public.notification_reads
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

do $$
begin
  begin
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
    ) then
      alter publication supabase_realtime add table public.notifications;
    end if;
  exception when others then
    raise notice 'Could not add notifications to realtime publication automatically (%). You can turn this on from Database > Replication in the dashboard; the app still works without live push, it just won''t update notifications instantly.', sqlerrm;
  end;
end $$;

-- ============================================================================
-- 10. ADMIN ACCESS FOR YOU — never a key in the app. Sign up in the app with
--     the email you'll use as admin, THEN run this once from here:
--
--     update public.profiles set is_admin = true
--     where id = (select id from auth.users where email = 'you@example.com');
--
--     The trigger in section 3 blocks is_admin from ever being flipped
--     through the app itself, from any account.
-- ============================================================================

-- ============================================================================
-- 11. VERIFICATION — run this by itself after the script above to confirm
--     everything actually landed. Expect 7 tables and 8 functions.
-- ============================================================================
-- select table_name from information_schema.tables
--   where table_schema = 'public' and table_name in
--   ('groups','group_members','activities','profiles','notifications','notification_reads')
--   order by table_name;
--
-- select routine_name from information_schema.routines
--   where routine_schema = 'public' and routine_name in
--   ('is_group_member','is_admin','create_cofap_team','join_cofap_team',
--    'request_leave_team','cancel_leave_team','get_team_leaderboard',
--    'get_my_teams_overview','get_team_activity_feed')
--   order by routine_name;
