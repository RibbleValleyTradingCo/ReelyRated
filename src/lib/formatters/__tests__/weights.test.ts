import { describe, it, expect } from "vitest";
import { formatWeightLabel, toKilograms, formatMetricImperial } from "../weights";

describe("Weight Formatters", () => {
  describe("formatWeightLabel", () => {
    it("should format weight with kg unit", () => {
      const result = formatWeightLabel(5.5, "kg");
      expect(result).toBe("5.5 kg");
    });

    it("should format weight with lb unit", () => {
      const result = formatWeightLabel(12.3, "lb");
      expect(result).toBe("12.3 lb");
    });

    it("should normalize lbs to lb", () => {
      const result = formatWeightLabel(10, "lbs");
      expect(result).toBe("10 lb");
    });

    it("should normalize lb_oz to lb", () => {
      const result = formatWeightLabel(8.5, "lb_oz");
      expect(result).toBe("8.5 lb");
    });

    it("should handle uppercase units", () => {
      const result = formatWeightLabel(3.2, "KG");
      expect(result).toBe("3.2 kg");
    });

    it("should handle mixed case units", () => {
      const result = formatWeightLabel(7, "Lb");
      expect(result).toBe("7 lb");
    });

    it("should handle null weight", () => {
      const result = formatWeightLabel(null, "kg");
      expect(result).toBe("");
    });

    it("should handle undefined weight", () => {
      const result = formatWeightLabel(undefined, "kg");
      expect(result).toBe("");
    });

    it("should use fallback for null weight", () => {
      const result = formatWeightLabel(null, "kg", { fallback: "N/A" });
      expect(result).toBe("N/A");
    });

    it("should handle null unit", () => {
      const result = formatWeightLabel(5.5, null);
      expect(result).toBe("5.5");
    });

    it("should handle undefined unit", () => {
      const result = formatWeightLabel(5.5, undefined);
      expect(result).toBe("5.5");
    });

    it("should handle zero weight", () => {
      const result = formatWeightLabel(0, "kg");
      expect(result).toBe("0 kg");
    });

    it("should format decimal weights with default precision", () => {
      const result = formatWeightLabel(5.123456, "kg");
      expect(result).toBe("5.1 kg");
    });

    it("should respect maximumFractionDigits option", () => {
      const result = formatWeightLabel(5.123456, "kg", {
        maximumFractionDigits: 3,
      });
      expect(result).toBe("5.123 kg");
    });

    it("should respect minimumFractionDigits option", () => {
      const result = formatWeightLabel(5, "kg", {
        minimumFractionDigits: 2,
      });
      expect(result).toBe("5.00 kg");
    });

    it("should handle large numbers with locale formatting", () => {
      const result = formatWeightLabel(1234.5, "kg");
      // Note: locale formatting may vary, checking structure
      expect(result).toContain("kg");
      expect(result).toContain("1");
      expect(result).toContain("234");
    });

    it("should handle very small decimals", () => {
      const result = formatWeightLabel(0.1, "kg");
      expect(result).toBe("0.1 kg");
    });

    it("should format integer weights without decimal", () => {
      const result = formatWeightLabel(10, "kg");
      expect(result).toBe("10 kg");
    });

    it("should handle unknown units as-is", () => {
      const result = formatWeightLabel(5, "stone");
      expect(result).toBe("5 stone");
    });

    it("should handle empty string unit", () => {
      const result = formatWeightLabel(5, "");
      expect(result).toBe("5");
    });

    it("should handle negative weights", () => {
      const result = formatWeightLabel(-5, "kg");
      expect(result).toBe("-5 kg");
    });
  });

  describe("toKilograms", () => {
    it("should return weight unchanged for kg unit", () => {
      const result = toKilograms(5.5, "kg");
      expect(result).toBe(5.5);
    });

    it("should convert pounds to kilograms", () => {
      const result = toKilograms(10, "lb");
      expect(result).toBeCloseTo(4.53592, 4);
    });

    it("should convert lbs to kilograms", () => {
      const result = toKilograms(10, "lbs");
      expect(result).toBeCloseTo(4.53592, 4);
    });

    it("should convert lb_oz to kilograms", () => {
      const result = toKilograms(10, "lb_oz");
      expect(result).toBeCloseTo(4.53592, 4);
    });

    it("should handle uppercase KG", () => {
      const result = toKilograms(7, "KG");
      expect(result).toBe(7);
    });

    it("should handle uppercase LB", () => {
      const result = toKilograms(10, "LB");
      expect(result).toBeCloseTo(4.53592, 4);
    });

    it("should return null for null weight", () => {
      const result = toKilograms(null, "kg");
      expect(result).toBeNull();
    });

    it("should return null for undefined weight", () => {
      const result = toKilograms(undefined, "kg");
      expect(result).toBeNull();
    });

    it("should return weight for null unit", () => {
      const result = toKilograms(5, null);
      expect(result).toBe(5);
    });

    it("should return weight for undefined unit", () => {
      const result = toKilograms(5, undefined);
      expect(result).toBe(5);
    });

    it("should handle zero weight", () => {
      const result = toKilograms(0, "lb");
      expect(result).toBe(0);
    });

    it("should handle unknown units (return original)", () => {
      const result = toKilograms(5, "stone");
      expect(result).toBe(5);
    });

    it("should handle empty string unit", () => {
      const result = toKilograms(5, "");
      expect(result).toBe(5);
    });

    it("should handle very small weights", () => {
      const result = toKilograms(0.1, "lb");
      expect(result).toBeCloseTo(0.0453592, 6);
    });

    it("should handle large weights", () => {
      const result = toKilograms(1000, "lb");
      expect(result).toBeCloseTo(453.592, 2);
    });

    it("should handle negative weights", () => {
      const result = toKilograms(-10, "lb");
      expect(result).toBeCloseTo(-4.53592, 4);
    });
  });

  describe("formatMetricImperial", () => {
    it("should format kilograms with pounds equivalent", () => {
      const result = formatMetricImperial(5);
      expect(result).toBe("5.0 kg (11.0 lb)");
    });

    it("should handle null kilograms", () => {
      const result = formatMetricImperial(null);
      expect(result).toBe("—");
    });

    it("should handle undefined kilograms", () => {
      const result = formatMetricImperial(undefined);
      expect(result).toBe("—");
    });

    it("should handle NaN kilograms", () => {
      const result = formatMetricImperial(NaN);
      expect(result).toBe("—");
    });

    it("should use custom fallback", () => {
      const result = formatMetricImperial(null, { fallback: "N/A" });
      expect(result).toBe("N/A");
    });

    it("should respect custom decimals option", () => {
      const result = formatMetricImperial(5.123, { decimals: 2 });
      expect(result).toContain("5.12 kg");
      expect(result).toContain("11.29 lb");
    });

    it("should handle zero kilograms", () => {
      const result = formatMetricImperial(0);
      expect(result).toBe("0.0 kg (0.0 lb)");
    });

    it("should handle very small values", () => {
      const result = formatMetricImperial(0.1, { decimals: 2 });
      expect(result).toContain("0.10 kg");
      expect(result).toContain("0.22 lb");
    });

    it("should handle large values", () => {
      const result = formatMetricImperial(100);
      expect(result).toContain("100.0 kg");
      expect(result).toContain("220.5 lb");
    });

    it("should handle decimal inputs", () => {
      const result = formatMetricImperial(2.5);
      expect(result).toContain("2.5 kg");
      expect(result).toContain("5.5 lb");
    });

    it("should use default decimals of 1", () => {
      const result = formatMetricImperial(5.555);
      expect(result).toContain("5.6 kg");
      expect(result).toContain("12.2 lb");
    });

    it("should handle 0 decimals option", () => {
      const result = formatMetricImperial(5.555, { decimals: 0 });
      expect(result).toContain("6 kg");
      expect(result).toContain("12 lb");
    });

    it("should handle negative weights", () => {
      const result = formatMetricImperial(-5);
      expect(result).toContain("-5.0 kg");
      expect(result).toContain("-11.0 lb");
    });

    it("should convert typical fish weights correctly", () => {
      // 10 kg common carp ≈ 22 lbs
      const result = formatMetricImperial(10);
      expect(result).toBe("10.0 kg (22.0 lb)");
    });
  });
});
