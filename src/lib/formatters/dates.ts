const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const formatRelativeTime = (iso: string | null | undefined, now = Date.now()) => {
  if (!iso) return "Moments ago";

  const timestamp = new Date(iso).getTime();
  if (Number.isNaN(timestamp)) {
    return "Recently";
  }

  const diff = now - timestamp;

  if (diff < MINUTE) return "Just now";
  if (diff < HOUR) {
    const mins = Math.round(diff / MINUTE);
    return `${mins} min${mins === 1 ? "" : "s"} ago`;
  }
  if (diff < DAY) {
    const hours = Math.round(diff / HOUR);
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }

  const days = Math.round(diff / DAY);
  return `${days} day${days === 1 ? "" : "s"} ago`;
};
