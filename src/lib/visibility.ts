import type { Database } from "@/integrations/supabase/types";

type VisibilityType = Database["public"]["Enums"]["visibility_type"];

export const canViewCatch = (
  visibility: VisibilityType | null | undefined,
  ownerId: string | null | undefined,
  viewerId?: string | null,
  followingIds: string[] = []
) => {
  if (!ownerId) return false;
  if (viewerId && ownerId === viewerId) return true;

  const normalized = visibility ?? "public";

  if (normalized === "public") return true;
  if (normalized === "private") return false;
  if (normalized === "followers") {
    if (!viewerId) return false;
    return followingIds.includes(ownerId);
  }

  return false;
};

export const shouldShowExactLocation = (
  hideExactSpot: boolean | null | undefined,
  ownerId: string | null | undefined,
  viewerId?: string | null
) => {
  if (!hideExactSpot) return true;
  if (viewerId && ownerId && viewerId === ownerId) return true;
  return false;
};
