import { z } from "zod";

/**
 * Environment Variable Validation Schema
 *
 * Validates all required and optional environment variables at app startup.
 * Provides clear error messages if configuration is invalid.
 */

const envSchema = z.object({
  // Required: Supabase Configuration
  VITE_SUPABASE_URL: z
    .string()
    .url("VITE_SUPABASE_URL must be a valid URL")
    .refine(
      (url) => url.includes("supabase.co"),
      "VITE_SUPABASE_URL must be a Supabase URL"
    ),

  VITE_SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .min(1, "VITE_SUPABASE_PUBLISHABLE_KEY is required")
    .refine(
      (key) => key.startsWith("eyJ"),
      "VITE_SUPABASE_PUBLISHABLE_KEY appears to be invalid (should start with 'eyJ')"
    ),

  // Optional: Admin Configuration
  VITE_ADMIN_USER_IDS: z
    .string()
    .optional()
    .transform((val) => val || "")
    .refine(
      (val) => {
        if (!val) return true; // Empty is valid (no admins)
        const uuids = val.split(",");
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        return uuids.every((id) => uuidRegex.test(id.trim()));
      },
      "VITE_ADMIN_USER_IDS must be comma-separated valid UUIDs"
    ),

  // Optional: Public Site URL for sharing
  VITE_PUBLIC_SITE_URL: z
    .string()
    .url("VITE_PUBLIC_SITE_URL must be a valid URL if provided")
    .optional()
    .or(z.literal("")),

  // Optional: App URL for OAuth redirects
  VITE_APP_URL: z
    .string()
    .url("VITE_APP_URL must be a valid URL if provided")
    .optional()
    .or(z.literal("")),
});

/**
 * Validated environment variables
 *
 * Access environment variables through this object to ensure type safety.
 */
export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

/**
 * Validate and return environment variables
 *
 * @throws {Error} If environment validation fails
 * @returns Validated environment object
 *
 * @example
 * ```typescript
 * import { env } from '@/lib/env';
 *
 * const supabaseUrl = env.VITE_SUPABASE_URL;
 * ```
 */
export const getEnv = (): Env => {
  if (cachedEnv) {
    return cachedEnv;
  }

  try {
    const result = envSchema.parse({
      VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
      VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      VITE_ADMIN_USER_IDS: import.meta.env.VITE_ADMIN_USER_IDS,
      VITE_PUBLIC_SITE_URL: import.meta.env.VITE_PUBLIC_SITE_URL,
      VITE_APP_URL: import.meta.env.VITE_APP_URL,
    });

    cachedEnv = result;
    return result;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const formattedErrors = error.errors
        .map((err) => `  - ${err.path.join(".")}: ${err.message}`)
        .join("\n");

      throw new Error(
        `❌ Environment variable validation failed:\n\n${formattedErrors}\n\nPlease check your .env file and ensure all required variables are set correctly.`
      );
    }
    throw error;
  }
};

/**
 * Validate environment variables at module load time
 *
 * This ensures the app fails fast if configuration is invalid,
 * rather than failing later with cryptic errors.
 */
export const env = getEnv();

/**
 * Type-safe environment variable access
 *
 * @example
 * ```typescript
 * import { env } from '@/lib/env';
 *
 * // Type-safe access
 * const url: string = env.VITE_SUPABASE_URL; // ✅ TypeScript knows this is a string
 * const adminIds: string = env.VITE_ADMIN_USER_IDS; // ✅ TypeScript knows this is string | undefined
 * ```
 */
export default env;
