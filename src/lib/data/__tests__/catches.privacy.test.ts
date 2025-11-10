import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchCatchForViewer } from "../catches";

const createMockClient = (response: unknown, spies: { from?: (table: string) => void } = {}) => {
  const single = vi.fn().mockResolvedValue(response);
  const eq = vi.fn().mockReturnValue({ single });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockImplementation((table: string) => {
    spies.from?.(table);
    return { select };
  });

  return { from } as unknown as SupabaseClient;
};

describe("catches_safe view privacy behaviour", () => {
  it("returns sanitized conditions for non-owners when GPS is hidden", async () => {
    const sanitizedConditions = { weather: "overcast" };
    const response = {
      data: { id: "catch-privacy", hide_exact_spot: true, conditions: sanitizedConditions },
      error: null,
    } as const;
    const fromSpy = vi.fn();
    const client = createMockClient(response, { from: fromSpy });

    const result = await fetchCatchForViewer("catch-privacy", "viewer-2", client);

    expect(fromSpy).toHaveBeenCalledWith("catches_safe");
    expect(result.data?.conditions).toEqual(sanitizedConditions);
    expect(result.data?.conditions).not.toHaveProperty("gps");
  });

  it("preserves GPS data for owners", async () => {
    const ownerConditions = { weather: "clear", gps: { lat: 52.1, lng: -1.2 } };
    const response = {
      data: { id: "catch-owner", hide_exact_spot: true, conditions: ownerConditions },
      error: null,
    } as const;
    const client = createMockClient(response);

    const result = await fetchCatchForViewer("catch-owner", "owner-1", client);

    expect(result.data?.conditions).toEqual(ownerConditions);
    expect(result.data?.conditions).toHaveProperty("gps");
  });
});
