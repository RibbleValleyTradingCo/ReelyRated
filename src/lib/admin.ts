const rawAdminIds = (import.meta.env.VITE_ADMIN_USER_IDS ?? "") as string;

export const ADMIN_USER_IDS = rawAdminIds
  .split(",")
  .map((id) => id.trim())
  .filter((id) => id.length > 0);

export const isAdminUser = (userId?: string | null) => {
  if (!userId) return false;
  return ADMIN_USER_IDS.includes(userId);
};
