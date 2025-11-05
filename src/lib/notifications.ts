import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { ADMIN_USER_IDS } from "@/lib/admin";

type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];
type NotificationInsert = Database["public"]["Tables"]["notifications"]["Insert"];

export type NotificationPayload = {
  message: string;
  catchId?: string;
  commentId?: string;
  extraData?: Record<string, unknown>;
};

interface CreateNotificationParams {
  userId: string;
  type: NotificationInsert["type"];
  payload: NotificationPayload;
}

const serializeExtraData = (input?: Record<string, unknown>): Json | null => {
  if (!input || Object.keys(input).length === 0) {
    return null;
  }
  try {
    return JSON.parse(JSON.stringify(input)) as Json;
  } catch (error) {
    console.error("Failed to serialise notification extra data", error);
    return null;
  }
};

export const createNotification = async ({ userId, type, payload }: CreateNotificationParams) => {
  try {
    if (!userId || !type || !payload?.message) {
      return;
    }

    const { data, error } = await supabase.rpc("create_notification", {
      recipient_id: userId,
      event_type: type,
      message: payload.message,
      catch_target: payload.catchId ?? null,
      comment_target: payload.commentId ?? null,
      extra_data: serializeExtraData(payload.extraData),
    });

    if (error) {
      console.error("Failed to create notification", error);
    } else if (data && typeof data === "string") {
      return data;
    }
  } catch (error) {
    console.error("Unexpected error creating notification", error);
  }
};

export const fetchNotifications = async (userId: string, limit = 50) => {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Failed to fetch notifications", error);
    return [] as NotificationRow[];
  }

  return (data as NotificationRow[]) ?? [];
};

export const markNotificationAsRead = async (notificationId: string, userId: string) => {
  const { data, error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", notificationId)
    .eq("user_id", userId);

  if (error) {
    console.error("Failed to mark notification as read", error);
  }
  return data as NotificationRow[] | null;
};

export const markAllNotificationsAsRead = async (userId: string) => {
  const { data, error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", userId)
    .eq("is_read", false);

  if (error) {
    console.error("Failed to mark all notifications as read", error);
  }
  return data as NotificationRow[] | null;
};

export const clearAllNotifications = async (userId: string) => {
  const { error } = await supabase.from("notifications").delete().eq("user_id", userId);

  if (error) {
    console.error("Failed to clear notifications", error);
  }
  return !error;
};

let cachedAdminIds: string[] | null = null;

const loadAdminUserIds = async () => {
  if (ADMIN_USER_IDS.length > 0) {
    return ADMIN_USER_IDS;
  }

  if (cachedAdminIds) {
    return cachedAdminIds;
  }

  const { data, error } = await supabase
    .from("admin_users")
    .select("user_id")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Failed to load admin users", error);
    cachedAdminIds = [];
    return cachedAdminIds;
  }

  cachedAdminIds = (data ?? [])
    .map((row) => row.user_id)
    .filter((value): value is string => Boolean(value));

  return cachedAdminIds;
};

export const notifyAdmins = async (data: NotificationInsert["data"]) => {
  const adminIds = await loadAdminUserIds();

  if (adminIds.length === 0) {
    console.warn("No admin users configured to receive notifications");
    return;
  }

  await Promise.all(
    adminIds.map((adminId) =>
      createNotification({
        userId: adminId,
        type: "admin_report",
        payload: {
          message: data?.message ?? "A new report has been submitted.",
          extraData: data ?? undefined,
        },
      })
    )
  );
};
