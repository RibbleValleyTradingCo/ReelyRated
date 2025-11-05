import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";
import type { Database } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";

type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];

const getNotificationTitle = (type: NotificationRow["type"]) => {
  switch (type) {
    case "new_follower":
      return "New follower";
    case "new_comment":
      return "New comment";
    case "new_reaction":
      return "New like";
    case "new_rating":
      return "New rating";
    case "mention":
      return "Mention";
    case "admin_report":
      return "New report";
    default:
      return "Notification";
  }
};

const NotificationItem = ({
  notification,
  onNavigate,
}: {
  notification: NotificationRow;
  onNavigate: (notification: NotificationRow) => void;
}) => {
  const data = (notification.data ?? {}) as Record<string, unknown>;
  const message =
    (typeof data.message === "string" && data.message) ||
    "You have a new notification.";
  const timeAgo = formatDistanceToNow(new Date(notification.created_at), {
    addSuffix: true,
  });

  return (
    <div
      key={notification.id}
      className={cn(
        "rounded-lg border border-border/40 bg-card/70 p-3 transition",
        !notification.is_read && "border-primary/40 bg-primary/5"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {getNotificationTitle(notification.type)}
          </p>
          <p className="text-sm text-foreground mt-1">{message}</p>
          <p className="mt-1 text-xs text-muted-foreground">{timeAgo}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-primary px-2"
          onClick={() => onNavigate(notification)}
        >
          View
        </Button>
      </div>
    </div>
  );
};

export const NotificationsBell = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      return;
    }
    setIsLoading(true);
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(25);

    if (!error && data) {
      setNotifications(data as NotificationRow[]);
    }
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    if (!loading) {
      void fetchNotifications();
    }
  }, [fetchNotifications, loading]);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.is_read).length,
    [notifications]
  );

  const markAllAsRead = useCallback(async () => {
    if (!user || unreadCount === 0) return;
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);

    if (!error) {
      setNotifications((prev) =>
        prev.map((notification) => ({ ...notification, is_read: true }))
      );
    }
  }, [unreadCount, user]);

  const handleOpenChange = async (value: boolean) => {
    setOpen(value);
    if (value) {
      await fetchNotifications();
      await markAllAsRead();
    }
  };

  const handleNavigate = (notification: NotificationRow) => {
    if (notification.type === "admin_report") {
      navigate("/admin/reports");
      setOpen(false);
      return;
    }
    const data = (notification.data ?? {}) as Record<string, unknown>;
    if (typeof data.catch_id === "string") {
      navigate(`/catch/${data.catch_id}`);
      setOpen(false);
      return;
    }
    if (typeof data.actor_id === "string") {
      navigate(`/profile/${data.actor_id}`);
      setOpen(false);
      return;
    }
  };

  if (loading || !user) {
    return null;
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative rounded-full"
          onClick={() => setOpen((prev) => !prev)}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 z-30" align="end">
        <div className="border-b px-4 py-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Notifications</p>
            <Button
              variant="ghost"
              size="sm"
              className="h-auto px-2 text-xs"
              onClick={() => fetchNotifications()}
            >
              Refresh
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Stay up to date with the latest activity on your catches.
          </p>
        </div>
        <div className="p-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-6 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              You’re all caught up!
            </div>
          ) : (
            <ScrollArea className="max-h-80 pr-2">
              <div className="space-y-3">
                {notifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onNavigate={handleNavigate}
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationsBell;
