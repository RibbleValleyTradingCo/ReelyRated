import type { Database } from "@/integrations/supabase/types";
import { getProfilePath } from "@/lib/profile";

export type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];

export const resolveNotificationPath = (notification: NotificationRow): string | null => {
  if (notification.type === "admin_report") {
    return "/admin/reports";
  }

  const data = (notification.data ?? {}) as Record<string, unknown>;

  if (typeof data.catch_id === "string" && data.catch_id.trim().length > 0) {
    return `/catch/${data.catch_id}`;
  }

  if (notification.actor_id) {
    const actorUsername =
      typeof data.actor_username === "string" ? data.actor_username : null;
    return getProfilePath({ username: actorUsername, id: notification.actor_id });
  }

  return null;
};
