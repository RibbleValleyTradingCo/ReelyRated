-- Layer 14 – Leaderboard composite catch scoring
begin;

-- ---------------------------------------------------------------------------
-- Supporting indexes to keep leaderboard queries fast as the dataset grows.
-- ---------------------------------------------------------------------------
create index if not exists idx_catches_visibility_created
  on public.catches (created_at desc)
  where visibility = 'public'::public.visibility_type;

create index if not exists idx_catches_species_weight
  on public.catches (species, weight)
  where visibility = 'public'::public.visibility_type
    and weight is not null;

create index if not exists idx_ratings_catch_id
  on public.ratings (catch_id);

-- ---------------------------------------------------------------------------
-- Drop dependent helper views before rebuilding the detailed view.
-- ---------------------------------------------------------------------------
drop view if exists public.leaderboard_top_10;
drop view if exists public.leaderboard_by_species;
drop view if exists public.leaderboard_scores_detailed;

create view public.leaderboard_scores_detailed as
with base_catches as (
  select
    c.id,
    c.user_id,
    c.title,
    c.species,
    c.weight,
    c.weight_unit,
    c.length,
    c.length_unit,
    c.image_url,
    c.gallery_photos,
    c.video_url,
    c.tags,
    c.conditions,
    c.description,
    c.location,
    c.method,
    c.water_type,
    c.caught_at,
    c.time_of_day,
    c.created_at,
    coalesce(array_length(c.gallery_photos, 1), 0) as gallery_count,
    case
      when c.weight is null then null
      when c.weight_unit = 'kg' then c.weight
      when c.weight_unit = 'lb_oz' then c.weight * 0.45359237
      else c.weight
    end as weight_kg,
    case
      when c.length is null then null
      when c.length_unit = 'cm' then c.length
      when c.length_unit = 'in' then c.length * 2.54
      else c.length
    end as length_cm
  from public.catches c
  where c.visibility = 'public'::public.visibility_type
),
species_weight_window as (
  select
    bc.species,
    percentile_cont(0.5) within group (order by bc.weight_kg) as weight_p50,
    percentile_cont(0.9) within group (order by bc.weight_kg) as weight_p90
  from base_catches bc
  where bc.weight_kg is not null
    and coalesce(bc.caught_at::timestamptz, bc.created_at) >= (now() - interval '365 days')
  group by bc.species
),
ratings_summary as (
  select
    r.catch_id,
    avg(r.rating)::numeric as avg_rating,
    count(r.rating) as rating_count
  from public.ratings r
  group by r.catch_id
),
scored_catches as (
  select
    bc.*,
    coalesce(rs.avg_rating, 0)::numeric as avg_rating,
    coalesce(rs.rating_count, 0) as rating_count,
    sw.weight_p50,
    sw.weight_p90,
    p.username as owner_username,
    p.avatar_path as owner_avatar_path,
    p.avatar_url as owner_avatar_url
  from base_catches bc
  left join ratings_summary rs on rs.catch_id = bc.id
  left join species_weight_window sw on sw.species = bc.species
  left join public.profiles p on p.id = bc.user_id
),
scored_with_components as (
  select
    sc.*,
    case
      when sc.weight_kg is null or sc.weight_kg <= 0 then 0::numeric
      when sc.weight_p50 is null or sc.weight_p50 <= 0 then 0::numeric
      when sc.weight_p90 is null or sc.weight_p90 <= sc.weight_p50 then
        least((sc.weight_kg / sc.weight_p50) * 35::numeric, 35::numeric)
      when sc.weight_kg >= sc.weight_p90 then 35::numeric
      when sc.weight_kg >= sc.weight_p50 then
        17.5::numeric +
        ((sc.weight_kg - sc.weight_p50) / (sc.weight_p90 - sc.weight_p50)) * (35::numeric - 17.5::numeric)
      else (sc.weight_kg / sc.weight_p50) * 17.5::numeric
    end as weight_score,
    case
      when sc.rating_count < 1 then 0::numeric
      else least(
        (sc.avg_rating * 3::numeric) * sqrt(sc.rating_count::double precision)::numeric,
        30::numeric
      )
    end as rating_score,
    (
      (case
         when sc.image_url is not null and btrim(sc.image_url) <> '' then 8
         else 0
       end)
      +
      (case
         when sc.gallery_count >= 4 then 10
         when sc.gallery_count >= 2 then 6
         else 0
       end)
      +
      (case
         when sc.video_url is not null and btrim(sc.video_url) <> '' then 2
         else 0
       end)
    )::numeric as evidence_score,
    (
      (case when sc.species is not null and sc.species <> 'other'::public.species_type then 1 else 0 end) +
      (case when sc.weight is not null then 1 else 0 end) +
      (case when sc.length is not null then 1 else 0 end) +
      (case when sc.location is not null and btrim(sc.location) <> '' then 1 else 0 end) +
      (case when sc.method is not null and btrim(sc.method) <> '' then 1 else 0 end) +
      (case when sc.water_type is not null and btrim(sc.water_type) <> '' then 1 else 0 end) +
      (case when sc.conditions ->> 'waterClarity' is not null and btrim(sc.conditions ->> 'waterClarity') <> '' then 1 else 0 end) +
      (case when sc.caught_at is not null then 1 else 0 end) +
      (case when sc.description is not null and char_length(btrim(sc.description)) > 20 then 1 else 0 end) +
      (case when coalesce(array_length(sc.tags, 1), 0) >= 1 then 1 else 0 end) +
      (case when sc.conditions ->> 'weather' is not null and btrim(sc.conditions ->> 'weather') <> '' then 1 else 0 end) +
      (case when sc.time_of_day is not null then 1 else 0 end)
    ) as completeness_hits
  from scored_catches sc
),
final_components as (
  select
    swc.*,
    (case
       when swc.completeness_hits >= 10 then 15
       when swc.completeness_hits >= 8 then 12
       when swc.completeness_hits >= 6 then 9
       when swc.completeness_hits >= 4 then 6
       when swc.completeness_hits >= 2 then 3
       else 0
     end)::numeric as completeness_score
  from scored_with_components swc
)
select
  fc.id,
  fc.user_id,
  fc.owner_username,
  fc.owner_avatar_path,
  fc.owner_avatar_url,
  fc.title,
  fc.species,
  fc.weight,
  fc.weight_unit,
  fc.length,
  fc.length_unit,
  fc.image_url,
  fc.location,
  fc.method,
  fc.water_type,
  fc.description,
  fc.gallery_photos,
  fc.tags,
  fc.video_url,
  fc.conditions,
  fc.caught_at,
  fc.created_at,
  fc.avg_rating,
  fc.rating_count,
  fc.weight_score,
  fc.rating_score,
  fc.evidence_score,
  fc.completeness_score,
  round(
    (fc.weight_score + fc.rating_score + fc.evidence_score + fc.completeness_score)::numeric,
    1
  ) as total_score
from final_components fc
order by total_score desc nulls last, fc.created_at desc;

comment on view public.leaderboard_scores_detailed is
  'Per-catch leaderboard scores combining weight, ratings, evidence, and completeness into a 0–100 composite.';

-- ---------------------------------------------------------------------------
-- Helper views for species filtering and homepage highlights.
-- ---------------------------------------------------------------------------
create or replace view public.leaderboard_by_species as
select *
from public.leaderboard_scores_detailed
order by species, total_score desc nulls last, created_at desc;

comment on view public.leaderboard_by_species is
  'Leaderboard view ordered by species, then total score, for filtered leaderboards.';

create or replace view public.leaderboard_top_10 as
select
  id,
  user_id,
  title,
  species,
  weight,
  weight_unit,
  image_url,
  created_at,
  total_score
from public.leaderboard_scores_detailed
order by total_score desc nulls last, created_at desc
limit 10;

comment on view public.leaderboard_top_10 is
  'Lightweight leaderboard slice exposing only the top 10 scored catches.';

commit;
