import { getFreshwaterSpeciesLabel } from "@/lib/freshwater-data";

type NullableString = string | null | undefined;

const humanize = (value: string) =>
  value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const formatSpeciesName = (species: NullableString, customSpecies?: NullableString) => {
  if (species === "other") {
    return customSpecies ? humanize(customSpecies) : "Other species";
  }

  if (!species) {
    return customSpecies ? humanize(customSpecies) : null;
  }

  const knownLabel = getFreshwaterSpeciesLabel(species);
  if (knownLabel) {
    return knownLabel;
  }

  return humanize(species);
};

export const formatSpeciesLabel = (
  species: NullableString,
  customSpecies?: NullableString,
  fallback = "Unknown species",
) => formatSpeciesName(species, customSpecies) ?? fallback;

export const extractCustomSpecies = (conditions: unknown): string | null => {
  if (!isRecord(conditions)) {
    return null;
  }

  const customFields = conditions.customFields;
  if (!isRecord(customFields)) {
    return null;
  }

  const candidate = customFields.species;
  return typeof candidate === "string" ? candidate : null;
};
