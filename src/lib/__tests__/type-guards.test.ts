import { describe, it, expect } from "vitest";
import {
  isString,
  isNumber,
  isArray,
  isDefined,
  assertDefined,
  hasProperty,
} from "../type-guards";

describe("Type Guards", () => {
  describe("isString", () => {
    it("should return true for strings", () => {
      expect(isString("hello")).toBe(true);
      expect(isString("")).toBe(true);
      expect(isString("123")).toBe(true);
      expect(isString(String(123))).toBe(true);
    });

    it("should return false for non-strings", () => {
      expect(isString(123)).toBe(false);
      expect(isString(true)).toBe(false);
      expect(isString(null)).toBe(false);
      expect(isString(undefined)).toBe(false);
      expect(isString([])).toBe(false);
      expect(isString({})).toBe(false);
      expect(isString(Symbol("test"))).toBe(false);
    });

    it("should narrow type correctly", () => {
      const value: unknown = "test";
      if (isString(value)) {
        // TypeScript should allow string methods
        const result: string = value.toUpperCase();
        expect(result).toBe("TEST");
      }
    });
  });

  describe("isNumber", () => {
    it("should return true for valid numbers", () => {
      expect(isNumber(0)).toBe(true);
      expect(isNumber(1)).toBe(true);
      expect(isNumber(-1)).toBe(true);
      expect(isNumber(3.14)).toBe(true);
      expect(isNumber(Number.MAX_SAFE_INTEGER)).toBe(true);
      expect(isNumber(Number.MIN_SAFE_INTEGER)).toBe(true);
      expect(isNumber(Infinity)).toBe(true);
      expect(isNumber(-Infinity)).toBe(true);
    });

    it("should return false for NaN", () => {
      expect(isNumber(NaN)).toBe(false);
      expect(isNumber(Number.NaN)).toBe(false);
      expect(isNumber(0 / 0)).toBe(false);
    });

    it("should return false for non-numbers", () => {
      expect(isNumber("123")).toBe(false);
      expect(isNumber("0")).toBe(false);
      expect(isNumber(true)).toBe(false);
      expect(isNumber(null)).toBe(false);
      expect(isNumber(undefined)).toBe(false);
      expect(isNumber([])).toBe(false);
      expect(isNumber({})).toBe(false);
    });

    it("should narrow type correctly", () => {
      const value: unknown = 42;
      if (isNumber(value)) {
        // TypeScript should allow number methods
        const result: number = value.toFixed(2);
        expect(result).toBe("42.00");
      }
    });
  });

  describe("isArray", () => {
    it("should return true for arrays", () => {
      expect(isArray([])).toBe(true);
      expect(isArray([1, 2, 3])).toBe(true);
      expect(isArray(["a", "b"])).toBe(true);
      expect(isArray(new Array())).toBe(true);
      expect(isArray(Array(5))).toBe(true);
    });

    it("should return false for non-arrays", () => {
      expect(isArray("[]")).toBe(false);
      expect(isArray(null)).toBe(false);
      expect(isArray(undefined)).toBe(false);
      expect(isArray({})).toBe(false);
      expect(isArray(123)).toBe(false);
      expect(isArray({ length: 0 })).toBe(false); // Array-like but not array
    });

    it("should narrow type correctly", () => {
      const value: unknown = [1, 2, 3];
      if (isArray<number>(value)) {
        // TypeScript should allow array methods
        const result: number = value.length;
        expect(result).toBe(3);
      }
    });

    it("should work with typed arrays", () => {
      const stringArray: unknown = ["a", "b", "c"];
      if (isArray<string>(stringArray)) {
        const first: string = stringArray[0];
        expect(first).toBe("a");
      }
    });
  });

  describe("isDefined", () => {
    it("should return true for defined values", () => {
      expect(isDefined(0)).toBe(true);
      expect(isDefined("")).toBe(true);
      expect(isDefined(false)).toBe(true);
      expect(isDefined([])).toBe(true);
      expect(isDefined({})).toBe(true);
      expect(isDefined("hello")).toBe(true);
      expect(isDefined(123)).toBe(true);
    });

    it("should return false for null", () => {
      expect(isDefined(null)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(isDefined(undefined)).toBe(false);
    });

    it("should narrow type correctly", () => {
      const value: string | null | undefined = "test";
      if (isDefined(value)) {
        // TypeScript should know value is string
        const result: string = value.toUpperCase();
        expect(result).toBe("TEST");
      }
    });

    it("should filter out nullish values in arrays", () => {
      const values: (number | null | undefined)[] = [1, null, 2, undefined, 3];
      const defined = values.filter(isDefined);
      expect(defined).toEqual([1, 2, 3]);
      // TypeScript should narrow type to number[]
      const sum: number = defined.reduce((a, b) => a + b, 0);
      expect(sum).toBe(6);
    });
  });

  describe("assertDefined", () => {
    it("should not throw for defined values", () => {
      expect(() => assertDefined(0)).not.toThrow();
      expect(() => assertDefined("")).not.toThrow();
      expect(() => assertDefined(false)).not.toThrow();
      expect(() => assertDefined([])).not.toThrow();
      expect(() => assertDefined({})).not.toThrow();
    });

    it("should throw for null", () => {
      expect(() => assertDefined(null)).toThrow("Value cannot be null");
    });

    it("should throw for undefined", () => {
      expect(() => assertDefined(undefined)).toThrow("Value cannot be null");
    });

    it("should throw custom error message", () => {
      expect(() => assertDefined(null, "Custom error")).toThrow("Custom error");
      expect(() => assertDefined(undefined, "Missing required value")).toThrow(
        "Missing required value"
      );
    });

    it("should narrow type after assertion", () => {
      const value: string | null = "test";
      assertDefined(value);
      // TypeScript should know value is string
      const result: string = value.toUpperCase();
      expect(result).toBe("TEST");
    });

    it("should work in validation chains", () => {
      function processValue(value: string | null | undefined): string {
        assertDefined(value, "Value is required");
        return value.trim();
      }

      expect(processValue("  hello  ")).toBe("hello");
      expect(() => processValue(null)).toThrow("Value is required");
      expect(() => processValue(undefined)).toThrow("Value is required");
    });
  });

  describe("hasProperty", () => {
    it("should return true for existing properties", () => {
      const obj = { name: "test", age: 25 };
      expect(hasProperty(obj, "name")).toBe(true);
      expect(hasProperty(obj, "age")).toBe(true);
    });

    it("should return false for non-existing properties", () => {
      const obj = { name: "test" };
      expect(hasProperty(obj, "age")).toBe(false);
      expect(hasProperty(obj, "missing")).toBe(false);
    });

    it("should return true for properties with undefined value", () => {
      const obj = { name: undefined };
      expect(hasProperty(obj, "name")).toBe(true);
    });

    it("should return false for inherited properties", () => {
      const obj = Object.create({ inherited: "value" });
      expect(hasProperty(obj, "inherited")).toBe(false);
    });

    it("should work with symbol keys", () => {
      const sym = Symbol("test");
      const obj = { [sym]: "value" };
      expect(hasProperty(obj, sym)).toBe(true);
    });

    it("should narrow type correctly", () => {
      const obj: Record<string, unknown> = { name: "test" };
      if (hasProperty(obj, "name")) {
        // TypeScript should know property exists
        const value: unknown = obj.name;
        expect(value).toBe("test");
      }
    });

    it("should work with optional properties", () => {
      type User = { name: string; email?: string };
      const user: User = { name: "John" };

      if (hasProperty(user, "email")) {
        const email: unknown = user.email;
        expect(email).toBeUndefined(); // Property exists but is undefined
      }
    });

    it("should return false for null prototype objects", () => {
      const obj = Object.create(null);
      obj.prop = "value";
      // hasOwnProperty won't exist on null prototype object
      // Our implementation uses Object.prototype.hasOwnProperty.call
      expect(hasProperty(obj, "prop")).toBe(true);
    });

    it("should handle edge cases", () => {
      const obj = { "": "empty key", "0": "numeric string key" };
      expect(hasProperty(obj, "")).toBe(true);
      expect(hasProperty(obj, "0")).toBe(true);
    });
  });

  describe("edge cases and integration", () => {
    it("should handle complex nested structures", () => {
      const data: unknown = {
        user: {
          name: "John",
          age: 30,
          addresses: [{ city: "NYC" }, { city: "LA" }],
        },
      };

      if (typeof data === "object" && data !== null && hasProperty(data, "user")) {
        const user = data.user;
        if (
          typeof user === "object" &&
          user !== null &&
          hasProperty(user, "name") &&
          isString(user.name)
        ) {
          expect(user.name).toBe("John");
        }
      }
    });

    it("should safely validate API responses", () => {
      function validateUser(data: unknown): {
        name: string;
        age: number;
      } | null {
        if (
          typeof data === "object" &&
          data !== null &&
          hasProperty(data, "name") &&
          hasProperty(data, "age") &&
          isString(data.name) &&
          isNumber(data.age)
        ) {
          return { name: data.name, age: data.age };
        }
        return null;
      }

      expect(validateUser({ name: "John", age: 30 })).toEqual({
        name: "John",
        age: 30,
      });
      expect(validateUser({ name: "John" })).toBeNull();
      expect(validateUser({ age: 30 })).toBeNull();
      expect(validateUser({ name: 123, age: 30 })).toBeNull();
      expect(validateUser(null)).toBeNull();
    });

    it("should combine type guards effectively", () => {
      const values: unknown[] = [
        "hello",
        123,
        null,
        undefined,
        true,
        ["array"],
        { obj: "value" },
      ];

      const strings = values.filter(isString);
      const numbers = values.filter(isNumber);
      const arrays = values.filter(isArray);
      const defined = values.filter(isDefined);

      expect(strings).toEqual(["hello"]);
      expect(numbers).toEqual([123]);
      expect(arrays).toEqual([["array"]]);
      expect(defined).toHaveLength(5); // Everything except null and undefined
    });
  });
});
