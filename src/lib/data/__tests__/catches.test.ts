import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchCatchForViewer, fetchFeedCatches, SAFE_CATCH_FIELDS } from "../catches";

type Builder = {
  select: (selection: string) => unknown;
};

const createMockClient = (builders: Builder[]) => {
  let callIndex = 0;
  return {
    from: vi.fn().mockImplementation(() => builders[callIndex++] as Builder),
  };
};

const createSingleBuilder = (
  response: unknown,
  handlers: { onSelect?: (selection: string) => void; onEq?: (column: string, value: unknown) => void } = {},
): Builder => ({
  select(selection: string) {
    handlers.onSelect?.(selection);
    return {
      eq(column: string, value: unknown) {
        handlers.onEq?.(column, value);
        return {
          single: () => Promise.resolve(response),
        };
      },
    };
  },
});

const createRangeBuilder = (
  response: unknown,
  handlers: { onSelect?: (selection: string) => void } = {},
): Builder => ({
  select(selection: string) {
    handlers.onSelect?.(selection);
    return {
      order() {
        return {
          range: () => Promise.resolve(response),
        };
      },
    };
  },
});

describe("Catch Privacy Protection", () => {
  it("uses safe field selection for non-owners when a spot is hidden", async () => {
    const selectSpy = vi.fn();
    const builders = [
      createSingleBuilder({ data: { user_id: "owner-1", hide_exact_spot: true }, error: null } as const),
      createSingleBuilder(
        { data: { id: "catch-1", hide_exact_spot: true }, error: null } as const,
        { onSelect: selectSpy },
      ),
    ];
    const client = createMockClient(builders);

    const result = await fetchCatchForViewer("catch-1", "viewer-2", client as unknown as SupabaseClient);

    expect(selectSpy).toHaveBeenCalledTimes(1);
    const selectionArg = selectSpy.mock.calls[0][0] as string;
    expect(selectionArg).toContain(SAFE_CATCH_FIELDS);
    expect(selectionArg).toContain("profiles:user_id");
    expect(selectionArg).not.toContain("conditions");
    expect(result.data?.hide_exact_spot).toBe(true);
  });

  it("fetches feed data with safe columns", async () => {
    const selectSpy = vi.fn();
    const builders = [
      createRangeBuilder({ data: [{ id: "catch-2", hide_exact_spot: true }], error: null } as const, { onSelect: selectSpy }),
    ];
    const client = createMockClient(builders);

    const response = await fetchFeedCatches(0, 10, client as unknown as SupabaseClient);

    expect(selectSpy).toHaveBeenCalledTimes(1);
    const selectionArg = selectSpy.mock.calls[0][0] as string;
    expect(selectionArg).toContain(SAFE_CATCH_FIELDS);
    expect(selectionArg).not.toContain("conditions");
    expect(response.data?.[0].id).toBe("catch-2");
  });
});
