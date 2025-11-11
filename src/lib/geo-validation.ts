export interface Coordinates {
  lat: number;
  lng: number;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  sanitized?: Coordinates;
}

/**
 * Validates and sanitizes GPS coordinates
 * Lat must be between -90 and 90
 * Lng must be between -180 and 180
 */
export const validateCoordinates = (lat: number, lng: number): ValidationResult => {
  // Check for NaN
  if (isNaN(lat) || isNaN(lng)) {
    return { valid: false, error: 'Invalid coordinates: not a number' };
  }

  // Check for Infinity
  if (!isFinite(lat) || !isFinite(lng)) {
    return { valid: false, error: 'Invalid coordinates: infinity' };
  }

  // Validate latitude range
  if (lat < -90 || lat > 90) {
    return { valid: false, error: `Latitude ${lat} out of range (-90 to 90)` };
  }

  // Validate longitude range
  if (lng < -180 || lng > 180) {
    return { valid: false, error: `Longitude ${lng} out of range (-180 to 180)` };
  }

  // Sanitize to reasonable precision (6 decimal places = ~10cm accuracy)
  const sanitized = {
    lat: Math.round(lat * 1000000) / 1000000,
    lng: Math.round(lng * 1000000) / 1000000,
  };

  return { valid: true, sanitized };
};

/**
 * Validates coordinates are in UK bounds (for UK-focused app)
 */
export const validateUKCoordinates = (lat: number, lng: number): ValidationResult => {
  const baseValidation = validateCoordinates(lat, lng);
  if (!baseValidation.valid) return baseValidation;

  // UK approximate bounds
  const UK_BOUNDS = {
    minLat: 49.9,  // Southern tip
    maxLat: 60.9,  // Northern tip (including Shetland)
    minLng: -8.2,  // Western Ireland
    maxLng: 2.0,   // Eastern England
  };

  if (lat < UK_BOUNDS.minLat || lat > UK_BOUNDS.maxLat ||
      lng < UK_BOUNDS.minLng || lng > UK_BOUNDS.maxLng) {
    return {
      valid: false,
      error: 'Coordinates appear to be outside the UK. Please verify location.',
    };
  }

  return baseValidation;
};
