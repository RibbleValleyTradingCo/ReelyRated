-- Layer 13 – Angler leaderboard composite scoring
begin;

create or replace view public.angler_leaderboard as
with catch_ratings as (
  select
    c.id,
    c.user_id,
    c.title,
    c.image_url,
    c.species,
    c.conditions,
    c.weight,
    c.weight_unit,
    c.length,
    c.length_unit,
    c.location,
    c.visibility,
    c.hide_exact_spot,
    c.created_at,
    coalesce(avg(r.rating)::numeric, 0) as catch_avg_rating,
    coalesce(sum(r.rating)::numeric, 0) as sum_rating,
    count(r.rating) as catch_rating_count,
    case
      when c.weight is null then null
      when c.weight_unit = 'kg' then c.weight
      else c.weight * 0.45359237
    end as weight_kg,
    case
      when c.length is null then null
      when c.length_unit = 'cm' then c.length
      else c.length * 2.54
    end as length_cm
  from public.catches c
  left join public.ratings r on r.catch_id = c.id
  where c.visibility = 'public'
    and c.deleted_at is null
  group by c.id
),
angler_aggregate as (
  select
    cr.user_id,
    coalesce(sum(cr.sum_rating), 0) as total_rating_points,
    coalesce(sum(cr.catch_rating_count), 0) as rating_count,
    case when coalesce(sum(cr.catch_rating_count), 0) > 0 then coalesce(sum(cr.sum_rating), 0) / sum(cr.catch_rating_count) else 0 end as avg_rating,
    coalesce(max(cr.weight_kg), 0) as max_weight_kg,
    coalesce(max(cr.length_cm), 0) as max_length_cm
  from catch_ratings cr
  group by cr.user_id
),
max_values as (
  select
    max(avg_rating) as max_avg_rating,
    max(rating_count) as max_rating_count,
    max(max_weight_kg) as max_weight_kg,
    max(max_length_cm) as max_length_cm
  from angler_aggregate
),
weights as (
  -- Default weights; adjust here to retune the leaderboard mix
  select
    0.40::numeric as weight_avg_rating,
    0.20::numeric as weight_rating_count,
    0.25::numeric as weight_weight,
    0.15::numeric as weight_length
),
normalised_scores as (
  select
    agg.user_id,
    agg.avg_rating,
    agg.rating_count,
    agg.max_weight_kg,
    agg.max_length_cm,
    case when agg.avg_rating > 0 then agg.avg_rating / 10 else 0 end as avg_rating_score,
    case when mv.max_rating_count > 0 and agg.rating_count > 0
         then sqrt(agg.rating_count)::numeric / sqrt(mv.max_rating_count)
         else 0 end as rating_count_score,
    case when mv.max_weight_kg > 0 and agg.max_weight_kg > 0
         then ln(1 + agg.max_weight_kg) / ln(1 + mv.max_weight_kg)
         else 0 end as weight_score,
    case when mv.max_length_cm > 0 and agg.max_length_cm > 0
         then ln(1 + agg.max_length_cm) / ln(1 + mv.max_length_cm)
         else 0 end as length_score
  from angler_aggregate agg
  cross join max_values mv
),
best_catch as (
  select distinct on (cr.user_id)
    cr.user_id,
    cr.id as catch_id,
    cr.title,
    cr.image_url,
    cr.species,
    cr.conditions -> 'customFields' ->> 'species' as custom_species,
    cr.weight,
    cr.weight_unit,
    cr.length,
    cr.length_unit,
    cr.location,
    cr.visibility,
    cr.hide_exact_spot,
    cr.created_at,
    cr.catch_avg_rating,
    cr.catch_rating_count,
    cr.weight_kg,
    cr.length_cm,
    coalesce(cr.catch_avg_rating / 10, 0) * 0.5 +
      coalesce(ln(1 + coalesce(cr.weight_kg, 0)), 0) * 0.3 +
      coalesce(ln(1 + coalesce(cr.length_cm, 0)), 0) * 0.2 as catch_score
  from catch_ratings cr
  order by cr.user_id, catch_score desc nulls last, cr.created_at desc
)
select
  p.id as user_id,
  p.username,
  p.avatar_path,
  p.avatar_url,
  ns.avg_rating,
  ns.rating_count,
  ns.max_weight_kg,
  ns.max_length_cm,
  ns.avg_rating_score,
  ns.rating_count_score,
  ns.weight_score,
  ns.length_score,
  round(
    (ns.avg_rating_score * w.weight_avg_rating +
     ns.rating_count_score * w.weight_rating_count +
     ns.weight_score * w.weight_weight +
     ns.length_score * w.weight_length)::numeric,
    6
  ) as composite_score,
  w.weight_avg_rating,
  w.weight_rating_count,
  w.weight_weight,
  w.weight_length,
  bc.catch_id as top_catch_id,
  bc.title as top_catch_title,
  bc.image_url as top_catch_image_url,
  bc.species as top_catch_species,
  bc.custom_species as top_catch_custom_species,
  bc.weight as top_catch_weight,
  bc.weight_unit as top_catch_weight_unit,
  bc.length as top_catch_length,
  bc.length_unit as top_catch_length_unit,
  bc.location as top_catch_location,
  bc.visibility as top_catch_visibility,
  bc.hide_exact_spot as top_catch_hide_exact_spot,
  bc.created_at as top_catch_created_at
from normalised_scores ns
join public.profiles p on p.id = ns.user_id
cross join weights w
left join best_catch bc on bc.user_id = ns.user_id
order by composite_score desc nulls last;

comment on view public.angler_leaderboard is
  'Leaderboard view combining average ratings, rating counts, and personal best weight/length into a composite angler score.';

alter view public.angler_leaderboard
  set (security_invoker = true);

commit;
