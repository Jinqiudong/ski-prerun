-- Shared trips for Ski Pre-Run. Run once in the Supabase SQL editor.
-- The app only holds the publishable (anon) key, so the tables are closed to it; it goes through these
-- functions, which need the trip's id (a random uuid that travels in the share link). Nobody can list trips.

create table if not exists trips (
  id uuid primary key default gen_random_uuid(),
  data jsonb not null,               -- name, dates, passes, mountains
  updated_at timestamptz not null default now()
);
create table if not exists members (
  trip_id uuid not null references trips(id) on delete cascade,
  member_id text not null,           -- a random id kept on each phone
  name text not null,
  from_code text,                    -- the airport they fly from
  look jsonb,                        -- their rider's outfit, for their little figure
  joined_at timestamptz not null default now(),
  primary key (trip_id, member_id)
);
alter table trips enable row level security;
alter table members enable row level security;
revoke all on trips, members from anon, authenticated;

-- Make a trip (or update one you have the id of); returns its id.
create or replace function save_trip(p_id uuid, p_data jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  if length(p_data::text) > 20000 then raise exception 'too big'; end if;
  insert into trips (id, data) values (coalesce(p_id, gen_random_uuid()), p_data)
  on conflict (id) do update set data = excluded.data, updated_at = now()
  returning id into v;
  return v;
end $$;

-- A trip and who's on it.
create or replace function get_trip(p_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', t.id, 'data', t.data, 'updated_at', t.updated_at,
    'members', coalesce((select jsonb_agg(jsonb_build_object('id', m.member_id, 'name', m.name, 'from', m.from_code, 'look', m.look, 'joined', m.joined_at) order by m.joined_at)
                         from members m where m.trip_id = t.id), '[]'::jsonb))
  from trips t where t.id = p_id;
$$;

-- Join a trip, or change your own name / airport / look.
create or replace function join_trip(p_id uuid, p_member text, p_name text, p_from text, p_look jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from members where trip_id = p_id) >= 30 then raise exception 'full'; end if;
  insert into members (trip_id, member_id, name, from_code, look)
  values (p_id, left(p_member, 40), left(p_name, 20), left(upper(p_from), 3), p_look)
  on conflict (trip_id, member_id) do update set name = excluded.name, from_code = excluded.from_code, look = excluded.look;
end $$;

-- Leave a trip.
create or replace function leave_trip(p_id uuid, p_member text) returns void
language sql security definer set search_path = public as $$
  delete from members where trip_id = p_id and member_id = p_member;
$$;

grant execute on function save_trip(uuid, jsonb), get_trip(uuid), join_trip(uuid, text, text, text, jsonb), leave_trip(uuid, text) to anon;
