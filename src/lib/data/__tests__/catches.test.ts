import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fetchCatchForViewer,
  fetchFeedCatches,
  SAFE_CATCH_FIELDS,
  SAFE_CATCH_FIELDS_WITH_RELATIONS,
  FEED_CATCH_SELECTION,
} from "../catches";

describe("Catch data helpers", () => {
  it("reads catch detail data from catches table with relations", async () => {
    const singleResponse = { data: { id: "catch-1" }, error: null } as const;
    const single = vi.fn().mockResolvedValue(singleResponse);
    const eq = vi.fn().mockReturnValue({ single });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });

    const client = { from } as unknown as SupabaseClient;
    const result = await fetchCatchForViewer("catch-1", "viewer-2", client);

    expect(from).toHaveBeenCalledWith("catches");
    expect(select).toHaveBeenCalledWith(expect.stringContaining("profiles:user_id"));
    expect(eq).toHaveBeenCalledWith("id", "catch-1");
    expect(result).toBe(singleResponse);
  });

  it("fetches feed data with safe columns", async () => {
    const range = vi.fn().mockResolvedValue({ data: [{ id: "catch-2", hide_exact_spot: true }], error: null });
    const order = vi.fn().mockReturnValue({ range });
    const select = vi.fn().mockReturnValue({ order });
    const from = vi.fn().mockReturnValue({ select });
    const client = { from } as unknown as SupabaseClient;

    const response = await fetchFeedCatches(0, 10, client);

    expect(from).toHaveBeenCalledWith("catches");
    expect(select.mock.calls[0][0]).toBe(FEED_CATCH_SELECTION);
    expect(select.mock.calls[0][1]).toEqual({ count: "exact" });
    expect(response.data?.[0].id).toBe("catch-2");
  });
});
