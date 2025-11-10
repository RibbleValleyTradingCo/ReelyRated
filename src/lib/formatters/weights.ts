const LBS_PER_KG = 2.20462;

type NullableNumber = number | null | undefined;
type NullableString = string | null | undefined;

const normalizeUnit = (unit: NullableString) => {
  if (!unit) return null;
  const normalized = unit.toLowerCase();
  if (normalized === "kg") return "kg";
  if (["lb", "lbs", "lb_oz"].includes(normalized)) return "lb";
  return normalized;
};

export const formatWeightLabel = (
  weight: NullableNumber,
  unit: NullableString,
  options?: { fallback?: string; maximumFractionDigits?: number; minimumFractionDigits?: number },
) => {
  if (weight === null || weight === undefined) {
    return options?.fallback ?? "";
  }

  const normalizedUnit = normalizeUnit(unit);
  const formattedValue = Number(weight).toLocaleString(undefined, {
    maximumFractionDigits: options?.maximumFractionDigits ?? 1,
    minimumFractionDigits: options?.minimumFractionDigits ?? 0,
  });

  return normalizedUnit ? `${formattedValue} ${normalizedUnit}` : formattedValue;
};

export const toKilograms = (weight: NullableNumber, unit: NullableString) => {
  if (weight === null || weight === undefined) {
    return null;
  }

  const normalizedUnit = normalizeUnit(unit);
  if (!normalizedUnit) return weight;
  if (normalizedUnit === "kg") return weight;
  if (normalizedUnit === "lb") {
    return weight * 0.453592;
  }
  return weight;
};

export const formatMetricImperial = (
  kilograms: NullableNumber,
  options?: { fallback?: string; decimals?: number },
) => {
  if (kilograms === null || kilograms === undefined || Number.isNaN(kilograms)) {
    return options?.fallback ?? "—";
  }

  const decimals = options?.decimals ?? 1;
  const pounds = kilograms * LBS_PER_KG;
  return `${kilograms.toFixed(decimals)} kg (${pounds.toFixed(decimals)} lb)`;
};
