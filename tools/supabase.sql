-- Shared trips for Ski Pre-Run. Paste the whole file into the Supabase SQL editor and run it; it is safe
-- to run again (it only adds what is missing and replaces the functions).
--
-- The app only holds the publishable (anon) key, so the tables are closed to it; it goes through these
-- functions, which need the trip's id (a random uuid that travels in the share link). Nobody can list
-- trips. A member is a random id kept on each phone; no accounts.
--
-- A trip is split into sections, each with an owner (a member). The owner's edits apply at once; anyone
-- else's become proposals the owner accepts or declines. Everyone can edit the gear list.
-- Sections and the keys of trip.data they hold:
--   plan   days, maybe, routes, meet     which resort each day, where we might ski, routes, meeting points
--   stay   stay                          lodging
--   dates  name, from, to, passes        the trip itself
--   people                               who's in (the members table)
--   gear   gear                          open to everyone
-- Flights are each member's own (members.from_code, members.travel).

create table if not exists trips (
  id uuid primary key default gen_random_uuid(),
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table trips add column if not exists created_by text;
alter table trips add column if not exists owners jsonb not null default '{}'::jsonb;  -- section → member id
alter table trips add column if not exists version int not null default 0;

create table if not exists members (
  trip_id uuid not null references trips(id) on delete cascade,
  member_id text not null,
  name text not null,
  from_code text,
  look jsonb,
  joined_at timestamptz not null default now(),
  primary key (trip_id, member_id)
);
alter table members add column if not exists travel jsonb;  -- their own flight or drive

create table if not exists proposals (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  member_id text not null,             -- who proposed it
  section text not null,
  patch jsonb not null,                -- keys of trip.data to set
  summary text not null,               -- e.g. "周六 Copper → Winter Park"
  note text,                           -- why
  replies jsonb not null default '[]'::jsonb,
  status text not null default 'open', -- open, accepted, declined
  decided_by text,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index if not exists proposals_trip on proposals (trip_id, status);

create table if not exists events (
  id bigint generated always as identity primary key,
  trip_id uuid not null references trips(id) on delete cascade,
  member_id text,
  text text not null,
  at timestamptz not null default now()
);
create index if not exists events_trip on events (trip_id, at desc);

alter table trips enable row level security;
alter table members enable row level security;
alter table proposals enable row level security;
alter table events enable row level security;
revoke all on trips, members, proposals, events from anon, authenticated;

-- The old single-writer functions give way to the ones below.
drop function if exists save_trip(uuid, jsonb);
drop function if exists join_trip(uuid, text, text, text, jsonb);
drop function if exists leave_trip(uuid, text);

-- The keys of trip.data a section holds.
create or replace function section_keys(p_section text) returns text[]
language sql immutable as $$
  select case p_section
    when 'plan' then array['days', 'maybe', 'routes', 'meet']
    when 'stay' then array['stay']
    when 'dates' then array['name', 'from', 'to', 'passes']
    when 'gear' then array['gear']
    else array[]::text[] end;
$$;

create or replace function owner_of(p_trip uuid, p_section text) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(t.owners ->> p_section, t.created_by) from trips t where t.id = p_trip;
$$;

create or replace function is_member(p_trip uuid, p_member text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from members where trip_id = p_trip and member_id = p_member);
$$;

-- Keep the latest 100 changes per trip.
create or replace function log_event(p_trip uuid, p_member text, p_text text) returns void
language sql security definer set search_path = public as $$
  insert into events (trip_id, member_id, text) values (p_trip, p_member, left(p_text, 200));
  delete from events where trip_id = p_trip and id not in (select id from events where trip_id = p_trip order by at desc limit 100);
$$;

-- Start a trip: the maker joins it and owns every section. Returns its id.
create or replace function create_trip(p_member text, p_name text, p_from text, p_look jsonb, p_data jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  if length(p_data::text) > 20000 then raise exception 'too big'; end if;
  insert into trips (data, created_by) values (p_data, left(p_member, 40)) returning id into v;
  insert into members (trip_id, member_id, name, from_code, look) values (v, left(p_member, 40), left(p_name, 20), left(upper(p_from), 3), p_look);
  perform log_event(v, p_member, p_name || ' 建了这个行程');
  return v;
end $$;

-- The whole trip: data, owners, who's on it, open proposals, the latest changes.
create or replace function get_trip(p_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', t.id, 'data', t.data, 'owners', t.owners, 'created_by', t.created_by, 'version', t.version, 'updated_at', t.updated_at,
    'members', coalesce((select jsonb_agg(jsonb_build_object('id', m.member_id, 'name', m.name, 'from', m.from_code, 'look', m.look, 'travel', m.travel, 'joined', m.joined_at) order by m.joined_at)
                         from members m where m.trip_id = t.id), '[]'::jsonb),
    'proposals', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'by', p.member_id, 'section', p.section, 'patch', p.patch, 'summary', p.summary, 'note', p.note, 'replies', p.replies, 'at', p.created_at) order by p.created_at)
                           from proposals p where p.trip_id = t.id and p.status = 'open'), '[]'::jsonb),
    'events', coalesce((select jsonb_agg(x.e) from (select jsonb_build_object('by', member_id, 'text', text, 'at', at) as e from events where trip_id = t.id order by at desc limit 30) x), '[]'::jsonb))
  from trips t where t.id = p_id;
$$;

-- Change a section. The owner's change (or anyone's, for gear) applies at once; anyone else's becomes a
-- proposal. Returns {applied, version} or {applied: false, proposal}.
create or replace function edit_trip(p_id uuid, p_member text, p_section text, p_patch jsonb, p_summary text, p_note text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare k text; pid uuid; ver int;
begin
  if not is_member(p_id, p_member) then raise exception 'not a member'; end if;
  for k in select jsonb_object_keys(p_patch) loop
    if not k = any(section_keys(p_section)) then raise exception 'key % is not in section %', k, p_section; end if;
  end loop;
  if p_section = 'gear' or owner_of(p_id, p_section) = p_member then
    update trips set data = data || p_patch, version = version + 1, updated_at = now() where id = p_id returning version into ver;
    if (select length(data::text) from trips where id = p_id) > 20000 then raise exception 'too big'; end if;
    perform log_event(p_id, p_member, p_summary);
    return jsonb_build_object('applied', true, 'version', ver);
  end if;
  insert into proposals (trip_id, member_id, section, patch, summary, note)
  values (p_id, p_member, p_section, p_patch, left(p_summary, 200), left(p_note, 300)) returning id into pid;
  perform log_event(p_id, p_member, '提议：' || p_summary);
  return jsonb_build_object('applied', false, 'proposal', pid);
end $$;

-- The section's owner accepts or declines a proposal, with an optional reply.
create or replace function decide_proposal(p_id uuid, p_member text, p_proposal uuid, p_accept boolean, p_reply text) returns void
language plpgsql security definer set search_path = public as $$
declare pr proposals;
begin
  select * into pr from proposals where id = p_proposal and trip_id = p_id and status = 'open';
  if pr.id is null then raise exception 'no such proposal'; end if;
  if owner_of(p_id, pr.section) is distinct from p_member then raise exception 'not the owner'; end if;
  if p_accept then update trips set data = data || pr.patch, version = version + 1, updated_at = now() where id = p_id; end if;
  update proposals set status = case when p_accept then 'accepted' else 'declined' end, decided_by = p_member, decided_at = now(),
    replies = case when coalesce(p_reply, '') = '' then replies else replies || jsonb_build_array(jsonb_build_object('by', p_member, 'text', left(p_reply, 300), 'at', now())) end
  where id = p_proposal;
  perform log_event(p_id, p_member, (case when p_accept then '接受了：' else '没采纳：' end) || pr.summary);
end $$;

-- Reply to a proposal without deciding it.
create or replace function reply_proposal(p_id uuid, p_member text, p_proposal uuid, p_text text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_member(p_id, p_member) then raise exception 'not a member'; end if;
  update proposals set replies = replies || jsonb_build_array(jsonb_build_object('by', p_member, 'text', left(p_text, 300), 'at', now()))
  where id = p_proposal and trip_id = p_id and status = 'open';
end $$;

-- Hand a section to someone on the trip. The trip's maker or the section's owner can.
create or replace function set_owner(p_id uuid, p_member text, p_section text, p_new text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_section not in ('plan', 'stay', 'dates', 'people') then raise exception 'no such section'; end if;
  if p_member is distinct from (select created_by from trips where id = p_id) and owner_of(p_id, p_section) is distinct from p_member then raise exception 'not allowed'; end if;
  if not is_member(p_id, p_new) then raise exception 'not a member'; end if;
  update trips set owners = owners || jsonb_build_object(p_section, p_new), version = version + 1, updated_at = now() where id = p_id;
  perform log_event(p_id, p_member, p_section || ' → ' || (select name from members where trip_id = p_id and member_id = p_new));
end $$;

-- Join a trip by its link, or change your own name / airport / look / travel.
create or replace function join_trip(p_id uuid, p_member text, p_name text, p_from text, p_look jsonb, p_travel jsonb default null) returns void
language plpgsql security definer set search_path = public as $$
declare fresh boolean;
begin
  if not exists (select 1 from trips where id = p_id) then raise exception 'no such trip'; end if;
  fresh := not is_member(p_id, p_member);
  if fresh and (select count(*) from members where trip_id = p_id) >= 30 then raise exception 'full'; end if;
  insert into members (trip_id, member_id, name, from_code, look, travel)
  values (p_id, left(p_member, 40), left(p_name, 20), left(upper(p_from), 3), p_look, p_travel)
  on conflict (trip_id, member_id) do update set name = excluded.name, from_code = excluded.from_code, look = excluded.look, travel = coalesce(excluded.travel, members.travel);
  if fresh then perform log_event(p_id, p_member, p_name || ' 加入了'); end if;
end $$;

-- Leave a trip yourself, or (the people section's owner) take someone off it.
create or replace function leave_trip(p_id uuid, p_member text, p_who text default null) returns void
language plpgsql security definer set search_path = public as $$
declare who text := coalesce(p_who, p_member); nm text;
begin
  if who <> p_member and owner_of(p_id, 'people') is distinct from p_member then raise exception 'not allowed'; end if;
  select name into nm from members where trip_id = p_id and member_id = who;
  delete from members where trip_id = p_id and member_id = who;
  if nm is not null then perform log_event(p_id, p_member, nm || ' 离开了'); end if;
end $$;

revoke all on function section_keys(text), owner_of(uuid, text), is_member(uuid, text), log_event(uuid, text, text) from public, anon, authenticated;
grant execute on function create_trip(text, text, text, jsonb, jsonb), get_trip(uuid), edit_trip(uuid, text, text, jsonb, text, text),
  decide_proposal(uuid, text, uuid, boolean, text), reply_proposal(uuid, text, uuid, text), set_owner(uuid, text, text, text),
  join_trip(uuid, text, text, text, jsonb, jsonb), leave_trip(uuid, text, text) to anon;
