import { useCallback, useState } from "react";
import type { Database } from "@/integrations/supabase/types";
import {
  fetchNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  clearAllNotifications,
} from "@/lib/notifications";

type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];

export const useNotifications = (userId: string | null | undefined, limit = 50) => {
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId) {
      setNotifications([]);
      return;
    }

    setLoading(true);
    const data = await fetchNotifications(userId, limit);
    setNotifications(data);
    setLoading(false);
  }, [limit, userId]);

  const markOne = useCallback(
    async (notificationId: string) => {
      if (!userId) return;
      await markNotificationAsRead(notificationId, userId);
      setNotifications((prev) =>
        prev.map((item) =>
          item.id === notificationId
            ? { ...item, is_read: true, read_at: item.read_at ?? new Date().toISOString() }
            : item
        )
      );
    },
    [userId]
  );

  const markAll = useCallback(async () => {
    if (!userId) return;
    await markAllNotificationsAsRead(userId);
    setNotifications((prev) =>
      prev.map((item) => ({ ...item, is_read: true, read_at: item.read_at ?? new Date().toISOString() }))
    );
  }, [userId]);

  const clearAll = useCallback(async () => {
    if (!userId) return;
    const success = await clearAllNotifications(userId);
    if (success) {
      setNotifications([]);
    }
  }, [userId]);

  return {
    notifications,
    setNotifications,
    loading,
    refresh,
    markOne,
    markAll,
    clearAll,
  };
};
