-- Run this file in Supabase Dashboard -> SQL Editor before using shared groups.
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 60),
  invite_code text unique not null default substr(md5(random()::text || clock_timestamp()::text), 1, 10),
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 120),
  category text not null check (category in ('academic', 'fitness', 'misc')),
  points integer not null check (points in (2, 3, 4)),
  activity_date date not null default current_date,
  created_at timestamptz not null default now()
);

alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.activities enable row level security;

create or replace function public.is_group_member(target_group uuid)
returns boolean language sql security definer set search_path = public
as $$ select exists (select 1 from public.group_members where group_id = target_group and user_id = auth.uid()); $$;

create policy "members can view groups" on public.groups for select using (public.is_group_member(id));
create policy "authenticated users can create groups" on public.groups for insert with check (auth.uid() = owner_id);
create policy "owners can update groups" on public.groups for update using (auth.uid() = owner_id);
create policy "members can view memberships" on public.group_members for select using (public.is_group_member(group_id));
drop policy if exists "users can join groups" on public.group_members;
create policy "members can view activities" on public.activities for select using (public.is_group_member(group_id));
create policy "users can add their activities" on public.activities for insert with check (auth.uid() = user_id and public.is_group_member(group_id));
create policy "users can update their activities" on public.activities for update using (auth.uid() = user_id);
create policy "users can delete their activities" on public.activities for delete using (auth.uid() = user_id);

create or replace function public.create_cofap_team(team_name text)
returns table (id uuid, name text, invite_code text)
language plpgsql security definer set search_path = public
as $$
declare new_group public.groups;
begin
  if auth.uid() is null then raise exception 'You must be signed in'; end if;
  insert into public.groups (name, owner_id) values (team_name, auth.uid()) returning * into new_group;
  insert into public.group_members (group_id, user_id, role) values (new_group.id, auth.uid(), 'owner');
  return query select new_group.id, new_group.name, new_group.invite_code;
end;
$$;

create or replace function public.join_cofap_team(invite_code_input text)
returns table (id uuid, name text)
language plpgsql security definer set search_path = public
as $$
declare target_group public.groups;
begin
  if auth.uid() is null then raise exception 'You must be signed in'; end if;
  select * into target_group from public.groups where groups.invite_code = upper(trim(invite_code_input));
  if target_group.id is null then raise exception 'Team key not found'; end if;
  insert into public.group_members (group_id, user_id) values (target_group.id, auth.uid()) on conflict do nothing;
  return query select target_group.id, target_group.name;
end;
$$;

revoke all on function public.create_cofap_team(text) from public;
grant execute on function public.create_cofap_team(text) to authenticated;
revoke all on function public.join_cofap_team(text) from public;
grant execute on function public.join_cofap_team(text) to authenticated;