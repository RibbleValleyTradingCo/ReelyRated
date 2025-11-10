import { describe, expect, it } from "vitest";
import { sanitizeCatchConditions } from "@/lib/visibility";

describe("sanitizeCatchConditions", () => {
  it("removes gps data for non-owners when hide_exact_spot is true", () => {
    const catchRow = {
      id: "catch-1",
      user_id: "angler-a",
      hide_exact_spot: true,
      conditions: {
        gps: { lat: 10, lng: 20 },
        weather: "cloudy",
      },
    };

    const sanitized = sanitizeCatchConditions(catchRow, "viewer-b");
    expect(sanitized.conditions).toEqual({ weather: "cloudy" });
  });

  it("keeps gps data for owners", () => {
    const catchRow = {
      id: "catch-2",
      user_id: "angler-a",
      hide_exact_spot: true,
      conditions: {
        gps: { lat: 10, lng: 20 },
        weather: "sunny",
      },
    };

    const sanitized = sanitizeCatchConditions(catchRow, "angler-a");
    expect(sanitized.conditions).toHaveProperty("gps");
  });
});
