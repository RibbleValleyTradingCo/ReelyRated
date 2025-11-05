import { useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { NotificationListItem } from "@/components/notifications/NotificationListItem";
import { useNotifications } from "@/hooks/useNotifications";
import { useNavigate } from "react-router-dom";
import { resolveNotificationPath } from "@/lib/notifications-utils";

interface ProfileNotificationsSectionProps {
  userId: string | null;
}

export const ProfileNotificationsSection = ({ userId }: ProfileNotificationsSectionProps) => {
  const {
    notifications,
    loading,
    refresh,
    markOne,
    markAll,
    clearAll,
  } = useNotifications(userId, 50);
  const navigate = useNavigate();

  useEffect(() => {
    if (!userId) return;
    void refresh();
  }, [refresh, userId]);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.is_read).length,
    [notifications]
  );

  if (!userId) {
    return null;
  }

  return (
    <Card className="border border-slate-200 shadow-sm">
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="text-lg font-semibold text-slate-900">Notifications</CardTitle>
          <CardDescription>Activity from anglers and admins related to your catches.</CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void refresh();
            }}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> Refreshing
              </>
            ) : (
              "Refresh"
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (unreadCount > 0) {
                void markAll();
              }
            }}
            disabled={unreadCount === 0}
          >
            Mark all read
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive"
            onClick={() => {
              void clearAll();
            }}
            disabled={notifications.length === 0}
          >
            Clear all
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading notifications…
          </div>
        ) : notifications.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
            No notifications yet. Activity on your catches will appear here.
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((notification) => (
              <NotificationListItem
                key={notification.id}
                notification={notification}
                onView={(current) => {
                  const destination = resolveNotificationPath(current);
                  if (destination) {
                    navigate(destination);
                  }
                  void markOne(current.id);
                }}
                onMarkRead={(current) => {
                  void markOne(current.id);
                }}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
