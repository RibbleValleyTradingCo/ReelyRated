import { describe, it, expect } from "vitest";
import {
  canViewCatch,
  shouldShowExactLocation,
  sanitizeCatchConditions,
} from "../visibility";

describe("Visibility", () => {
  describe("canViewCatch", () => {
    describe("public catches", () => {
      it("should allow anyone to view public catches", () => {
        expect(canViewCatch("public", "owner-id", null)).toBe(true);
        expect(canViewCatch("public", "owner-id", "viewer-id")).toBe(true);
        expect(canViewCatch("public", "owner-id", undefined)).toBe(true);
      });

      it("should treat null visibility as public", () => {
        expect(canViewCatch(null, "owner-id", null)).toBe(true);
        expect(canViewCatch(null, "owner-id", "viewer-id")).toBe(true);
      });

      it("should treat undefined visibility as public", () => {
        expect(canViewCatch(undefined, "owner-id", null)).toBe(true);
        expect(canViewCatch(undefined, "owner-id", "viewer-id")).toBe(true);
      });
    });

    describe("private catches", () => {
      it("should deny all viewers for private catches", () => {
        expect(canViewCatch("private", "owner-id", null)).toBe(false);
        expect(canViewCatch("private", "owner-id", "other-user-id")).toBe(false);
      });

      it("should allow owner to view their own private catches", () => {
        expect(canViewCatch("private", "owner-id", "owner-id")).toBe(true);
      });
    });

    describe("followers-only catches", () => {
      it("should deny non-authenticated users", () => {
        expect(canViewCatch("followers", "owner-id", null, [])).toBe(false);
        expect(canViewCatch("followers", "owner-id", undefined, ["user-1"])).toBe(
          false
        );
      });

      it("should deny users who are not following", () => {
        expect(
          canViewCatch("followers", "owner-id", "viewer-id", ["other-user"])
        ).toBe(false);
        expect(canViewCatch("followers", "owner-id", "viewer-id", [])).toBe(false);
      });

      it("should allow users who are following", () => {
        expect(
          canViewCatch("followers", "owner-id", "viewer-id", ["owner-id"])
        ).toBe(true);
        expect(
          canViewCatch("followers", "owner-id", "viewer-id", [
            "other-user",
            "owner-id",
          ])
        ).toBe(true);
      });

      it("should allow owner to view their own followers-only catches", () => {
        expect(canViewCatch("followers", "owner-id", "owner-id", [])).toBe(true);
        expect(canViewCatch("followers", "owner-id", "owner-id", ["user-1"])).toBe(
          true
        );
      });
    });

    describe("owner access", () => {
      it("should always allow owner to view regardless of visibility", () => {
        expect(canViewCatch("public", "owner-id", "owner-id")).toBe(true);
        expect(canViewCatch("private", "owner-id", "owner-id")).toBe(true);
        expect(canViewCatch("followers", "owner-id", "owner-id")).toBe(true);
      });
    });

    describe("edge cases", () => {
      it("should deny when ownerId is null", () => {
        expect(canViewCatch("public", null, "viewer-id")).toBe(false);
        expect(canViewCatch("private", null, null)).toBe(false);
        expect(canViewCatch("followers", null, "viewer-id", ["user-1"])).toBe(
          false
        );
      });

      it("should deny when ownerId is undefined", () => {
        expect(canViewCatch("public", undefined, "viewer-id")).toBe(false);
        expect(canViewCatch("private", undefined, null)).toBe(false);
      });

      it("should handle empty followingIds array", () => {
        expect(canViewCatch("followers", "owner-id", "viewer-id", [])).toBe(
          false
        );
      });

      it("should handle omitted followingIds parameter", () => {
        expect(canViewCatch("followers", "owner-id", "viewer-id")).toBe(false);
      });

      it("should be case-sensitive for owner comparison", () => {
        expect(canViewCatch("private", "owner-id", "OWNER-ID")).toBe(false);
        expect(canViewCatch("private", "owner-id", "Owner-Id")).toBe(false);
      });

      it("should handle large following lists", () => {
        const manyFollowing = Array.from({ length: 1000 }, (_, i) => `user-${i}`);
        expect(
          canViewCatch("followers", "user-500", "viewer-id", manyFollowing)
        ).toBe(true);
        expect(
          canViewCatch("followers", "user-999", "viewer-id", manyFollowing)
        ).toBe(true);
        expect(
          canViewCatch("followers", "user-1000", "viewer-id", manyFollowing)
        ).toBe(false);
      });
    });
  });

  describe("shouldShowExactLocation", () => {
    describe("when hideExactSpot is false/null/undefined", () => {
      it("should show location when hideExactSpot is false", () => {
        expect(shouldShowExactLocation(false, "owner-id", null)).toBe(true);
        expect(shouldShowExactLocation(false, "owner-id", "viewer-id")).toBe(true);
      });

      it("should show location when hideExactSpot is null", () => {
        expect(shouldShowExactLocation(null, "owner-id", null)).toBe(true);
        expect(shouldShowExactLocation(null, "owner-id", "viewer-id")).toBe(true);
      });

      it("should show location when hideExactSpot is undefined", () => {
        expect(shouldShowExactLocation(undefined, "owner-id", null)).toBe(true);
        expect(shouldShowExactLocation(undefined, "owner-id", "viewer-id")).toBe(
          true
        );
      });
    });

    describe("when hideExactSpot is true", () => {
      it("should hide location from non-authenticated users", () => {
        expect(shouldShowExactLocation(true, "owner-id", null)).toBe(false);
        expect(shouldShowExactLocation(true, "owner-id", undefined)).toBe(false);
      });

      it("should hide location from other users", () => {
        expect(shouldShowExactLocation(true, "owner-id", "other-user-id")).toBe(
          false
        );
      });

      it("should show location to owner", () => {
        expect(shouldShowExactLocation(true, "owner-id", "owner-id")).toBe(true);
      });
    });

    describe("edge cases", () => {
      it("should handle null ownerId", () => {
        expect(shouldShowExactLocation(true, null, "viewer-id")).toBe(false);
        expect(shouldShowExactLocation(false, null, "viewer-id")).toBe(true);
      });

      it("should handle undefined ownerId", () => {
        expect(shouldShowExactLocation(true, undefined, "viewer-id")).toBe(false);
        expect(shouldShowExactLocation(false, undefined, "viewer-id")).toBe(true);
      });

      it("should handle both ownerId and viewerId being null", () => {
        expect(shouldShowExactLocation(true, null, null)).toBe(false);
        expect(shouldShowExactLocation(false, null, null)).toBe(true);
      });
    });
  });

  describe("sanitizeCatchConditions", () => {
    describe("when GPS should be preserved", () => {
      it("should preserve GPS when hideExactSpot is false", () => {
        const catchData = {
          hide_exact_spot: false,
          user_id: "owner-id",
          conditions: {
            gps: { lat: 51.5074, lng: -0.1278 },
            weather: "sunny",
          },
        };

        const result = sanitizeCatchConditions(catchData, "viewer-id");
        expect(result.conditions).toEqual(catchData.conditions);
        expect(result.conditions?.gps).toBeDefined();
      });

      it("should preserve GPS when hideExactSpot is null", () => {
        const catchData = {
          hide_exact_spot: null,
          user_id: "owner-id",
          conditions: {
            gps: { lat: 51.5074, lng: -0.1278 },
            weather: "sunny",
          },
        };

        const result = sanitizeCatchConditions(catchData, "viewer-id");
        expect(result.conditions?.gps).toBeDefined();
      });

      it("should preserve GPS for owner viewing their own catch", () => {
        const catchData = {
          hide_exact_spot: true,
          user_id: "owner-id",
          conditions: {
            gps: { lat: 51.5074, lng: -0.1278 },
            weather: "sunny",
          },
        };

        const result = sanitizeCatchConditions(catchData, "owner-id");
        expect(result.conditions?.gps).toBeDefined();
      });

      it("should preserve GPS when conditions is null", () => {
        const catchData = {
          hide_exact_spot: true,
          user_id: "owner-id",
          conditions: null,
        };

        const result = sanitizeCatchConditions(catchData, "viewer-id");
        expect(result.conditions).toBeNull();
      });

      it("should preserve catch when no GPS data exists", () => {
        const catchData = {
          hide_exact_spot: true,
          user_id: "owner-id",
          conditions: {
            weather: "sunny",
            temperature: 20,
          },
        };

        const result = sanitizeCatchConditions(catchData, "viewer-id");
        expect(result).toEqual(catchData);
      });
    });

    describe("when GPS should be removed", () => {
      it("should remove GPS when hideExactSpot is true and viewer is different", () => {
        const catchData = {
          hide_exact_spot: true,
          user_id: "owner-id",
          conditions: {
            gps: { lat: 51.5074, lng: -0.1278 },
            weather: "sunny",
            temperature: 20,
          },
        };

        const result = sanitizeCatchConditions(catchData, "viewer-id");
        expect(result.conditions).toEqual({
          weather: "sunny",
          temperature: 20,
        });
        expect(result.conditions?.gps).toBeUndefined();
      });

      it("should remove GPS for non-authenticated users", () => {
        const catchData = {
          hide_exact_spot: true,
          user_id: "owner-id",
          conditions: {
            gps: { lat: 51.5074, lng: -0.1278 },
            weather: "sunny",
          },
        };

        const result = sanitizeCatchConditions(catchData, null);
        expect(result.conditions?.gps).toBeUndefined();
      });

      it("should preserve other condition data when removing GPS", () => {
        const catchData = {
          hide_exact_spot: true,
          user_id: "owner-id",
          conditions: {
            gps: { lat: 51.5074, lng: -0.1278 },
            weather: "sunny",
            waterTemp: 15,
            airTemp: 20,
            windDirection: "NE",
            customField: "custom value",
          },
        };

        const result = sanitizeCatchConditions(catchData, "viewer-id");
        expect(result.conditions).toEqual({
          weather: "sunny",
          waterTemp: 15,
          airTemp: 20,
          windDirection: "NE",
          customField: "custom value",
        });
      });
    });

    describe("type preservation", () => {
      it("should preserve generic type information", () => {
        type ExtendedCatch = {
          hide_exact_spot: boolean;
          user_id: string;
          conditions: Record<string, unknown> | null;
          customField: string;
        };

        const catchData: ExtendedCatch = {
          hide_exact_spot: true,
          user_id: "owner-id",
          conditions: {
            gps: { lat: 51.5074, lng: -0.1278 },
          },
          customField: "test",
        };

        const result = sanitizeCatchConditions(catchData, "viewer-id");
        expect(result.customField).toBe("test");
        expect(result.conditions?.gps).toBeUndefined();
      });
    });

    describe("edge cases", () => {
      it("should handle empty conditions object", () => {
        const catchData = {
          hide_exact_spot: true,
          user_id: "owner-id",
          conditions: {},
        };

        const result = sanitizeCatchConditions(catchData, "viewer-id");
        expect(result.conditions).toEqual({});
      });

      it("should handle undefined conditions", () => {
        const catchData = {
          hide_exact_spot: true,
          user_id: "owner-id",
          conditions: undefined,
        };

        const result = sanitizeCatchConditions(catchData, "viewer-id");
        expect(result).toEqual(catchData);
      });

      it("should handle non-object conditions", () => {
        const catchData = {
          hide_exact_spot: true,
          user_id: "owner-id",
          conditions: "not an object" as any,
        };

        const result = sanitizeCatchConditions(catchData, "viewer-id");
        expect(result.conditions).toBe("not an object");
      });

      it("should handle null catchRow", () => {
        const result = sanitizeCatchConditions(null as any, "viewer-id");
        expect(result).toBeNull();
      });

      it("should handle undefined user_id", () => {
        const catchData = {
          hide_exact_spot: true,
          user_id: undefined,
          conditions: {
            gps: { lat: 51.5074, lng: -0.1278 },
          },
        };

        const result = sanitizeCatchConditions(catchData, "viewer-id");
        expect(result.conditions?.gps).toBeUndefined();
      });

      it("should handle null user_id", () => {
        const catchData = {
          hide_exact_spot: true,
          user_id: null,
          conditions: {
            gps: { lat: 51.5074, lng: -0.1278 },
          },
        };

        const result = sanitizeCatchConditions(catchData, "viewer-id");
        expect(result.conditions?.gps).toBeUndefined();
      });

      it("should not modify original object", () => {
        const catchData = {
          hide_exact_spot: true,
          user_id: "owner-id",
          conditions: {
            gps: { lat: 51.5074, lng: -0.1278 },
            weather: "sunny",
          },
        };

        const originalConditions = { ...catchData.conditions };
        sanitizeCatchConditions(catchData, "viewer-id");

        // Original should be unchanged
        expect(catchData.conditions).toEqual(originalConditions);
        expect(catchData.conditions.gps).toBeDefined();
      });
    });

    describe("integration scenarios", () => {
      it("should handle complete privacy flow", () => {
        // Private catch with hidden GPS
        const privateCatch = {
          hide_exact_spot: true,
          user_id: "owner-id",
          conditions: {
            gps: { lat: 51.5074, lng: -0.1278 },
            weather: "sunny",
            waterTemp: 15,
          },
        };

        // Other user viewing
        const sanitizedForViewer = sanitizeCatchConditions(
          privateCatch,
          "other-user"
        );
        expect(sanitizedForViewer.conditions?.gps).toBeUndefined();
        expect(sanitizedForViewer.conditions?.weather).toBe("sunny");

        // Owner viewing
        const sanitizedForOwner = sanitizeCatchConditions(
          privateCatch,
          "owner-id"
        );
        expect(sanitizedForOwner.conditions?.gps).toBeDefined();
        expect(sanitizedForOwner.conditions?.weather).toBe("sunny");
      });
    });
  });
});
