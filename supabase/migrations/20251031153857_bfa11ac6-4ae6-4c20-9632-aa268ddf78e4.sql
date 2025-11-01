-- Add new fields to catches table for comprehensive catch logging

-- Add species enum
CREATE TYPE public.species_type AS ENUM (
  'carp',
  'mirror_carp',
  'common_carp',
  'barbel',
  'pike',
  'perch',
  'trout',
  'tench',
  'bream',
  'catfish',
  'other'
);

-- Add weight unit enum
CREATE TYPE public.weight_unit AS ENUM ('lb_oz', 'kg');

-- Add length unit enum
CREATE TYPE public.length_unit AS ENUM ('cm', 'in');

-- Add water type enum
CREATE TYPE public.water_type AS ENUM (
  'commercial',
  'club',
  'river',
  'canal',
  'stillwater'
);

-- Add method enum
CREATE TYPE public.fishing_method AS ENUM (
  'waggler',
  'feeder',
  'pole',
  'stalking',
  'surface',
  'lure',
  'deadbait',
  'fly',
  'other'
);

-- Add time of day enum
CREATE TYPE public.time_of_day AS ENUM (
  'morning',
  'afternoon',
  'evening',
  'night'
);

-- Add weather enum
CREATE TYPE public.weather_type AS ENUM (
  'sunny',
  'overcast',
  'raining',
  'windy'
);

-- Add water clarity enum
CREATE TYPE public.water_clarity AS ENUM (
  'clear',
  'coloured',
  'unknown'
);

-- Add visibility enum
CREATE TYPE public.visibility_type AS ENUM (
  'public',
  'followers',
  'private'
);

-- Add new columns to catches table
ALTER TABLE public.catches
  ADD COLUMN species species_type,
  ADD COLUMN weight DECIMAL(10,2),
  ADD COLUMN weight_unit weight_unit DEFAULT 'lb_oz',
  ADD COLUMN length DECIMAL(10,2),
  ADD COLUMN length_unit length_unit DEFAULT 'cm',
  ADD COLUMN water_type water_type,
  ADD COLUMN method fishing_method,
  ADD COLUMN peg_or_swim TEXT,
  ADD COLUMN time_of_day time_of_day,
  ADD COLUMN conditions JSONB DEFAULT '{}',
  ADD COLUMN tags TEXT[] DEFAULT '{}',
  ADD COLUMN gallery_photos TEXT[] DEFAULT '{}',
  ADD COLUMN video_url TEXT,
  ADD COLUMN visibility visibility_type DEFAULT 'public',
  ADD COLUMN hide_exact_spot BOOLEAN DEFAULT false,
  ADD COLUMN allow_ratings BOOLEAN DEFAULT true;

-- Add indexes for filtering
CREATE INDEX idx_catches_species ON public.catches(species);
CREATE INDEX idx_catches_water_type ON public.catches(water_type);
CREATE INDEX idx_catches_visibility ON public.catches(visibility);
CREATE INDEX idx_catches_tags ON public.catches USING GIN(tags);