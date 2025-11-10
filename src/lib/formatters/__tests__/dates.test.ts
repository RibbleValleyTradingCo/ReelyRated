import { describe, it, expect } from "vitest";
import { formatRelativeTime } from "../dates";

describe("Date Formatters", () => {
  describe("formatRelativeTime", () => {
    const MINUTE = 60 * 1000;
    const HOUR = 60 * MINUTE;
    const DAY = 24 * HOUR;

    it("should show 'Just now' for recent timestamps (< 1 minute)", () => {
      const now = Date.now();
      const recent = new Date(now - 30 * 1000).toISOString(); // 30 seconds ago
      const result = formatRelativeTime(recent, now);
      expect(result).toBe("Just now");
    });

    it("should show 'Just now' for timestamps < 1 second", () => {
      const now = Date.now();
      const veryRecent = new Date(now - 500).toISOString(); // 500ms ago
      const result = formatRelativeTime(veryRecent, now);
      expect(result).toBe("Just now");
    });

    it("should show 'X mins ago' for minutes (singular)", () => {
      const now = Date.now();
      const oneMinuteAgo = new Date(now - MINUTE).toISOString();
      const result = formatRelativeTime(oneMinuteAgo, now);
      expect(result).toBe("1 min ago");
    });

    it("should show 'X mins ago' for minutes (plural)", () => {
      const now = Date.now();
      const fiveMinutesAgo = new Date(now - 5 * MINUTE).toISOString();
      const result = formatRelativeTime(fiveMinutesAgo, now);
      expect(result).toBe("5 mins ago");
    });

    it("should show 'X mins ago' for 59 minutes", () => {
      const now = Date.now();
      const almostHour = new Date(now - 59 * MINUTE).toISOString();
      const result = formatRelativeTime(almostHour, now);
      expect(result).toBe("59 mins ago");
    });

    it("should show 'X hour ago' for hours (singular)", () => {
      const now = Date.now();
      const oneHourAgo = new Date(now - HOUR).toISOString();
      const result = formatRelativeTime(oneHourAgo, now);
      expect(result).toBe("1 hour ago");
    });

    it("should show 'X hours ago' for hours (plural)", () => {
      const now = Date.now();
      const threeHoursAgo = new Date(now - 3 * HOUR).toISOString();
      const result = formatRelativeTime(threeHoursAgo, now);
      expect(result).toBe("3 hours ago");
    });

    it("should show 'X hours ago' for 23 hours", () => {
      const now = Date.now();
      const almostDay = new Date(now - 23 * HOUR).toISOString();
      const result = formatRelativeTime(almostDay, now);
      expect(result).toBe("23 hours ago");
    });

    it("should show 'X day ago' for days (singular)", () => {
      const now = Date.now();
      const oneDayAgo = new Date(now - DAY).toISOString();
      const result = formatRelativeTime(oneDayAgo, now);
      expect(result).toBe("1 day ago");
    });

    it("should show 'X days ago' for days (plural)", () => {
      const now = Date.now();
      const sevenDaysAgo = new Date(now - 7 * DAY).toISOString();
      const result = formatRelativeTime(sevenDaysAgo, now);
      expect(result).toBe("7 days ago");
    });

    it("should show 'X days ago' for old timestamps", () => {
      const now = Date.now();
      const thirtyDaysAgo = new Date(now - 30 * DAY).toISOString();
      const result = formatRelativeTime(thirtyDaysAgo, now);
      expect(result).toBe("30 days ago");
    });

    it("should handle null input", () => {
      const result = formatRelativeTime(null);
      expect(result).toBe("Moments ago");
    });

    it("should handle undefined input", () => {
      const result = formatRelativeTime(undefined);
      expect(result).toBe("Moments ago");
    });

    it("should handle empty string input", () => {
      const result = formatRelativeTime("");
      expect(result).toBe("Moments ago");
    });

    it("should handle invalid date strings", () => {
      const result = formatRelativeTime("not a date");
      expect(result).toBe("Recently");
    });

    it("should handle invalid ISO strings", () => {
      const result = formatRelativeTime("2023-13-45T99:99:99");
      expect(result).toBe("Recently");
    });

    it("should use custom 'now' parameter", () => {
      const customNow = new Date("2023-06-15T12:00:00Z").getTime();
      const timestamp = new Date("2023-06-15T11:00:00Z").toISOString();
      const result = formatRelativeTime(timestamp, customNow);
      expect(result).toBe("1 hour ago");
    });

    it("should round minutes correctly", () => {
      const now = Date.now();
      const oneAndHalfMinutes = new Date(now - 1.5 * MINUTE).toISOString();
      const result = formatRelativeTime(oneAndHalfMinutes, now);
      expect(result).toBe("2 mins ago");
    });

    it("should round hours correctly", () => {
      const now = Date.now();
      const twoAndHalfHours = new Date(now - 2.5 * HOUR).toISOString();
      const result = formatRelativeTime(twoAndHalfHours, now);
      expect(result).toBe("3 hours ago");
    });

    it("should round days correctly", () => {
      const now = Date.now();
      const threeAndHalfDays = new Date(now - 3.5 * DAY).toISOString();
      const result = formatRelativeTime(threeAndHalfDays, now);
      expect(result).toBe("4 days ago");
    });

    it("should handle future timestamps (treats as current)", () => {
      const now = Date.now();
      const future = new Date(now + 5 * MINUTE).toISOString();
      const result = formatRelativeTime(future, now);
      // Future date has negative diff, so < MINUTE check catches it
      expect(result).toBe("Just now");
    });

    it("should handle timestamps at exact boundaries", () => {
      const now = Date.now();
      const exactMinute = new Date(now - MINUTE).toISOString();
      const result = formatRelativeTime(exactMinute, now);
      expect(result).toBe("1 min ago");
    });

    it("should handle very old timestamps", () => {
      const now = Date.now();
      const yearAgo = new Date(now - 365 * DAY).toISOString();
      const result = formatRelativeTime(yearAgo, now);
      expect(result).toBe("365 days ago");
    });

    it("should handle timestamps from different time zones", () => {
      const now = new Date("2023-06-15T12:00:00Z").getTime();
      // UTC timestamp
      const timestamp = new Date("2023-06-15T11:00:00Z").toISOString();
      const result = formatRelativeTime(timestamp, now);
      expect(result).toBe("1 hour ago");
    });

    it("should format consistently with ISO strings", () => {
      const now = Date.now();
      const timestamp = new Date(now - 2 * HOUR).toISOString();
      const result = formatRelativeTime(timestamp, now);
      expect(result).toBe("2 hours ago");
    });

    it("should handle 30 seconds (< 1 minute)", () => {
      const now = Date.now();
      const halfMinute = new Date(now - 30 * 1000).toISOString();
      const result = formatRelativeTime(halfMinute, now);
      expect(result).toBe("Just now");
    });

    it("should handle 90 seconds (rounds to 2 mins)", () => {
      const now = Date.now();
      const ninetySeconds = new Date(now - 90 * 1000).toISOString();
      const result = formatRelativeTime(ninetySeconds, now);
      expect(result).toBe("2 mins ago");
    });

    it("should handle 90 minutes (rounds to 2 hours)", () => {
      const now = Date.now();
      const ninetyMinutes = new Date(now - 90 * MINUTE).toISOString();
      const result = formatRelativeTime(ninetyMinutes, now);
      expect(result).toBe("2 hours ago");
    });
  });
});
