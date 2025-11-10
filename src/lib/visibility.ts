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

type CatchLike = {
  hide_exact_spot?: boolean | null;
  user_id?: string | null;
  conditions?: Record<string, unknown> | null;
};

const stripGps = (conditions: Record<string, unknown> | null | undefined) => {
  if (!conditions) return conditions ?? null;
  if (typeof conditions !== "object") return conditions;
  if (!("gps" in conditions)) return conditions;
  const { gps: _removed, ...rest } = conditions;
  return rest;
};

export const sanitizeCatchConditions = <T extends CatchLike>(
  catchRow: T,
  viewerId?: string | null,
): T => {
  if (
    !catchRow ||
    !catchRow.hide_exact_spot ||
    !catchRow.conditions ||
    (viewerId && catchRow.user_id && viewerId === catchRow.user_id)
  ) {
    return catchRow;
  }

  const sanitizedConditions = stripGps(catchRow.conditions);
  if (sanitizedConditions === catchRow.conditions) {
    return catchRow;
  }

  return {
    ...catchRow,
    conditions: sanitizedConditions,
  };
};
