begin;

drop view if exists public.catches_safe;

create view public.catches_safe as
select
  c.id,
  c.user_id,
  c.session_id,
  c.title,
  c.description,
  c.image_url,
  c.gallery_photos,
  c.video_url,
  c.location,
  c.species,
  c.weight,
  c.weight_unit,
  c.length,
  c.length_unit,
  c.peg_or_swim,
  c.water_type,
  c.method,
  c.bait_used,
  c.equipment_used,
  c.caught_at,
  c.time_of_day,
  case
    when c.hide_exact_spot is true
      and (auth.uid() is null or auth.uid() <> c.user_id)
    then
      case
        when c.conditions is null then null
        else (c.conditions::jsonb - 'gps')
      end
    else c.conditions
  end as conditions,
  c.tags,
  c.visibility,
  c.hide_exact_spot,
  c.allow_ratings,
  c.created_at,
  c.updated_at
from public.catches c;

grant usage on schema public to authenticated, anon;
grant select on public.catches_safe to authenticated, anon;

comment on view public.catches_safe is
  'Privacy-aware projection of catches that strips conditions.gps for non-owners when hide_exact_spot is true.';

commit;
