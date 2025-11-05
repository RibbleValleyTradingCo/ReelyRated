import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import type { Database } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";

type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];

interface NotificationListItemProps {
  notification: NotificationRow;
  onView: (notification: NotificationRow) => void;
  onMarkRead: (notification: NotificationRow) => void;
}

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

export const NotificationListItem = ({
  notification,
  onView,
  onMarkRead,
}: NotificationListItemProps) => {
  const data = (notification.data ?? {}) as Record<string, unknown>;
  const message =
    (typeof data.message === "string" && data.message) || "You have a new notification.";
  const timeAgo = formatDistanceToNow(new Date(notification.created_at), {
    addSuffix: true,
  });
  const actorUsername =
    typeof data.actor_username === "string" && data.actor_username.trim().length > 0
      ? data.actor_username
      : null;

  return (
    <div
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
          <p className="text-sm text-foreground mt-1">
            {actorUsername ? (
              <span className="font-semibold text-foreground">@{actorUsername}</span>
            ) : null}
            {actorUsername ? " · " : null}
            {message}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{timeAgo}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="text-primary px-2"
            onClick={() => onView(notification)}
          >
            View
          </Button>
          {notification.is_read ? (
            <span className="text-xs text-muted-foreground">Read</span>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="px-2 text-xs text-muted-foreground"
              onClick={() => onMarkRead(notification)}
            >
              Mark read
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export type { NotificationRow };
