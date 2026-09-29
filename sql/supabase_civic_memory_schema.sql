-- =============================================================================
-- CITIXEN UX(tm) — Supabase / PostGIS reference schema for Civic Memory(tm)
-- =============================================================================
--
-- STATUS: This is a REFERENCE SCRIPT, not a connected/deployed database.
-- Nothing in this repository currently talks to Postgres, Supabase, or
-- PostGIS — api/_lib/store.js is an in-memory JS module (see its own header
-- comment), which is an honest, documented stand-in for exactly this schema.
-- This file is what you run on a real Supabase project once one exists,
-- to replace that in-memory store with the real thing. Until then, running
-- this against nothing does nothing; it isn't wired into the app.
--
-- Scope: the two pieces requested for the "backend contract" —
--   1. trg_check_incident_proximity — a 15-meter/same-category duplicate
--      flag on report insert (mirrors the app's existing client-side
--      "15m proximity deduplication check" concept, done properly at the
--      database layer instead).
--   2. civic_hex_coverage_v1 — an ST_HexagonGrid-backed view that rolls
--      real report geometry up into the hex/geo-hatch coverage grid the
--      Map & Feed tab's overlay (and the Analytics "Geo-Hatch Coverage
--      Engine" card) render client-side today from mock/seed data.
--
-- Apply with: psql "$SUPABASE_DB_URL" -f sql/supabase_civic_memory_schema.sql
-- (or paste into the Supabase SQL editor). Review before running on a
-- database with existing data — this file assumes a fresh `reports` table.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 0. EXTENSION
-- -----------------------------------------------------------------------------
create extension if not exists postgis;

-- -----------------------------------------------------------------------------
-- 1. CORE TABLE
-- -----------------------------------------------------------------------------
-- Mirrors the shape api/_lib/store.js's WARD_TICKETS/cases already use
-- (category, stage/status, ward, resolution timing, verified proof photo),
-- plus the real geometry column the in-memory store has no room for.
create table if not exists public.reports (
  id                uuid primary key default gen_random_uuid(),
  report_ref        text not null,                       -- public-facing id, e.g. "W4-7f3c" (see makeReportId() in store.js)
  category          text not null,                        -- Pothole | Streetlight | Signage | Sidewalk | Drainage | ...
  state             text not null,
  city              text not null,
  ward              text not null,
  geog              geography(point, 4326) not null,      -- device GPS at submission time; never exposed at full precision publicly (see fuzzed-coordinate note below)
  stage             text not null default 'submitted'     -- submitted -> dispatched -> resolved
                      check (stage in ('submitted','dispatched','resolved')),
  verified          boolean,                               -- null until resolved; true only with a server-verified on-site proof photo
  resolution_hours  numeric,
  duplicate_of      uuid references public.reports(id),   -- set by trg_check_incident_proximity when a near-duplicate is detected; NOT auto-rejected
  device_token_hash text,                                  -- hash of x-device-token, never the raw token (rate-limiting/abuse signal only — see zero-PII note in store.js)
  created_at        timestamptz not null default now()
);

create index if not exists reports_geog_gix on public.reports using gist (geog);
create index if not exists reports_ward_idx on public.reports (state, city, ward);
create index if not exists reports_stage_idx on public.reports (stage);

comment on column public.reports.geog is
  'Full-precision device GPS at submission. The PUBLIC-facing map (index.html/app.html) '
  'rounds/fuzzes this before display — see fuzzCoord() in index.html — matching the '
  'product''s "no account required, no personal data retained" promise. Do not select '
  'this column directly into a public API response; expose only a rounded copy.';

-- -----------------------------------------------------------------------------
-- 2. trg_check_incident_proximity — 15m / same-category duplicate flag
-- -----------------------------------------------------------------------------
-- Flags, does not block: a citizen submitting a genuine second/worse photo
-- of the same hazard shouldn't be rejected outright, and dispatch staff may
-- still want the new report as corroboration. This sets duplicate_of on the
-- NEW row instead of raising an exception, mirroring the app's existing
-- "Flag Urgent Safety Hazard" override pattern (a flagged match doesn't
-- silently disappear, a human/dispatcher still sees and decides).
create or replace function public.trg_check_incident_proximity()
returns trigger
language plpgsql
as $$
declare
  match_id uuid;
begin
  select r.id into match_id
  from public.reports r
  where r.stage <> 'resolved'
    and r.category = new.category
    and r.ward = new.ward
    and ST_DWithin(r.geog, new.geog, 15)  -- 15 meters, per product spec
  order by r.created_at desc
  limit 1;

  if match_id is not null then
    new.duplicate_of := match_id;
  end if;

  return new;
end;
$$;

drop trigger if exists check_incident_proximity on public.reports;
create trigger check_incident_proximity
  before insert on public.reports
  for each row
  execute function public.trg_check_incident_proximity();

-- -----------------------------------------------------------------------------
-- 3. civic_hex_coverage_v1 — real ST_HexagonGrid coverage rollup
-- -----------------------------------------------------------------------------
-- Requires PostGIS 3.1+ (ST_HexagonGrid). Generates a hex grid across the
-- bounding box of all reports in a ward and rolls up real report counts per
-- cell — the server-side equivalent of the client's mock coverage grid
-- (api/_lib/store.js's buildWard4Cells()/mockCoverageCells()) and the Map &
-- Feed tab's Leaflet geo-hatch overlay. `cell_size_m` is a parameter, not
-- hardcoded, so it can match whichever tier (Ward/Municipal/National) the
-- client requests.
create or replace function public.civic_hex_coverage(
  p_state text,
  p_city text,
  p_ward text,
  p_cell_size_m numeric default 150
)
returns table (
  hex_geom geometry,
  cell_status text,       -- 'active_hazard' | 'resolved' | 'uncharted'
  report_count integer
)
language sql
stable
as $$
  with bounds as (
    select ST_Expand(ST_Extent(geog::geometry), p_cell_size_m / 111320.0) as bbox
    from public.reports
    where state = p_state and city = p_city and ward = p_ward
  ),
  grid as (
    select (ST_HexagonGrid(p_cell_size_m, bbox)).geom as hex_geom
    from bounds
  ),
  joined as (
    select
      g.hex_geom,
      r.id as report_id,
      r.stage
    from grid g
    left join public.reports r
      on r.state = p_state and r.city = p_city and r.ward = p_ward
      and ST_Contains(g.hex_geom, r.geog::geometry)
  )
  select
    hex_geom,
    case
      when count(report_id) filter (where stage <> 'resolved') > 0 then 'active_hazard'
      when count(report_id) > 0 then 'resolved'
      else 'uncharted'
    end as cell_status,
    count(report_id)::int as report_count
  from joined
  group by hex_geom;
$$;

-- Convenience view for the *currently seeded* La Crosse Ward 4 demo data —
-- once real rows exist, call civic_hex_coverage() directly with the
-- jurisdiction you want instead of relying on this fixed view.
create or replace view public.civic_hex_coverage_v1 as
  select * from public.civic_hex_coverage('wi', 'la-crosse', 'ward-4', 150);

-- -----------------------------------------------------------------------------
-- 4. OPTIONAL — x-matrix-role row-level security starting point
-- -----------------------------------------------------------------------------
-- The frontend's x-matrix-role header (citixen | public_official | city_worker)
-- has no server-side enforcement yet anywhere in this repo (it isn't sent by
-- app.html/index.html today). This policy is illustrative only — it assumes
-- Supabase Auth JWTs carry a `matrix_role` custom claim, which nothing in
-- this codebase currently sets. Do not enable until that claim actually
-- exists; an enabled RLS policy with no matching claim will lock out every
-- request, including legitimate ones.
--
-- alter table public.reports enable row level security;
--
-- create policy "citizens can insert reports"
--   on public.reports for insert
--   with check (true); -- zero-account by design — no citizen-identity check to make
--
-- create policy "only city_worker/public_official can update stage"
--   on public.reports for update
--   using (auth.jwt() ->> 'matrix_role' in ('city_worker','public_official'));

commit;
