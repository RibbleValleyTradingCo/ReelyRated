import { supabase } from "@/integrations/supabase/client";

// Cache admin status to avoid repeated database queries
let adminStatusCache: Map<string, { isAdmin: boolean; timestamp: number }> = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Checks if a user is an admin by querying the admin_users table.
 * This is a server-side check enforced by RLS policies.
 * Results are cached for 5 minutes to reduce database load.
 *
 * @param userId - The user ID to check
 * @returns Promise<boolean> - True if user is admin, false otherwise
 */
export const isAdminUser = async (userId?: string | null): Promise<boolean> => {
  if (!userId) return false;

  // Check cache first
  const cached = adminStatusCache.get(userId);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    return cached.isAdmin;
  }

  // Query database
  const { data, error } = await supabase
    .from('admin_users')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();

  const isAdmin = !error && !!data;

  // Cache the result
  adminStatusCache.set(userId, {
    isAdmin,
    timestamp: Date.now(),
  });

  return isAdmin;
};

/**
 * Synchronous version for UI rendering only.
 * Returns false by default - use the async version for actual authorization.
 * This should ONLY be used for UI display purposes, never for security decisions.
 *
 * @deprecated Use isAdminUser() async version for security checks
 */
export const isAdminUserSync = (userId?: string | null): boolean => {
  if (!userId) return false;

  const cached = adminStatusCache.get(userId);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    return cached.isAdmin;
  }

  return false; // Default to false if not cached
};

/**
 * Clears the admin status cache.
 * Call this when user logs out or auth state changes.
 */
export const clearAdminCache = () => {
  adminStatusCache.clear();
};

/**
 * Preloads admin status for a user.
 * Call this early in the auth flow to warm the cache.
 */
export const preloadAdminStatus = async (userId: string) => {
  await isAdminUser(userId);
};
