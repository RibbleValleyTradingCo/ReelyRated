import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { ADMIN_USER_IDS } from "@/lib/admin";

type NotificationInsert = Database["public"]["Tables"]["notifications"]["Insert"];

interface CreateNotificationParams {
  userId: string;
  type: NotificationInsert["type"];
  data: NotificationInsert["data"];
}

export const createNotification = async ({ userId, type, data }: CreateNotificationParams) => {
  try {
    if (!userId || !type) {
      return;
    }

    const { error } = await supabase.from("notifications").insert({
      user_id: userId,
      type,
      data,
    });

    if (error) {
      console.error("Failed to create notification", error);
    }
  } catch (error) {
    console.error("Unexpected error creating notification", error);
  }
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
        data,
      })
    )
  );
};
