import { describe, it, expect } from "vitest";
import { canonicalJsonStringify } from "../canonicalJson.js";

describe("canonicalJsonStringify", () => {
  describe("key ordering", () => {
    it("should sort object keys lexicographically", () => {
      const obj1 = { z: 1, a: 2, m: 3 };
      const obj2 = { a: 2, m: 3, z: 1 };
      expect(canonicalJsonStringify(obj1)).toBe(canonicalJsonStringify(obj2));
      expect(canonicalJsonStringify(obj1)).toBe('{"a":2,"m":3,"z":1}');
    });

    it("should handle nested objects", () => {
      const obj1 = { b: { z: 1, a: 2 }, a: 3 };
      const obj2 = { a: 3, b: { a: 2, z: 1 } };
      expect(canonicalJsonStringify(obj1)).toBe(canonicalJsonStringify(obj2));
    });
  });

  describe("array ordering", () => {
    it("should preserve array order", () => {
      const arr1 = [1, 2, 3];
      const arr2 = [3, 2, 1];
      expect(canonicalJsonStringify(arr1)).not.toBe(canonicalJsonStringify(arr2));
      expect(canonicalJsonStringify(arr1)).toBe("[1,2,3]");
    });
  });

  describe("number handling", () => {
    it("should preserve integers", () => {
      expect(canonicalJsonStringify(42)).toBe("42");
      expect(canonicalJsonStringify(-42)).toBe("-42");
      expect(canonicalJsonStringify(0)).toBe("0");
    });

    it("should preserve floats", () => {
      expect(canonicalJsonStringify(3.14)).toBe("3.14");
      expect(canonicalJsonStringify(-0.5)).toBe("-0.5");
    });

    it("should convert NaN to null", () => {
      expect(canonicalJsonStringify(NaN)).toBe("null");
    });

    it("should convert Infinity to null", () => {
      expect(canonicalJsonStringify(Infinity)).toBe("null");
      expect(canonicalJsonStringify(-Infinity)).toBe("null");
    });

    it("should handle -0 and +0 as 0", () => {
      // JSON.stringify already handles this correctly
      expect(canonicalJsonStringify(-0)).toBe("0");
      expect(canonicalJsonStringify(0)).toBe("0");
    });
  });

  describe("date handling", () => {
    it("should convert Date to ISO 8601 string", () => {
      const date = new Date("2024-01-01T00:00:00Z");
      const result = canonicalJsonStringify(date);
      expect(result).toBe('"2024-01-01T00:00:00.000Z"');
      // Result is a JSON string, so it includes quotes.
      expect(result).toMatch(/^"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe("null and undefined", () => {
    it("should preserve null", () => {
      expect(canonicalJsonStringify(null)).toBe("null");
    });

    it("should convert undefined to null", () => {
      expect(canonicalJsonStringify(undefined)).toBe("null");
    });

    it("should convert undefined object values to null", () => {
      const obj = { a: 1, b: undefined, c: 2 };
      expect(canonicalJsonStringify(obj)).toBe('{"a":1,"b":null,"c":2}');
    });
  });

  describe("idempotency", () => {
    it("should be idempotent", () => {
      const value = { z: 1, a: { c: 3, b: 2 }, y: [3, 1, 2] };
      const first = canonicalJsonStringify(value);
      const second = canonicalJsonStringify(JSON.parse(first));
      expect(first).toBe(second);
    });
  });

  describe("complex nested structures", () => {
    it("should handle deeply nested objects", () => {
      const obj = {
        z: 1,
        a: {
          b: {
            c: [1, 2, { d: 3 }],
          },
        },
      };
      const result = canonicalJsonStringify(obj);
      expect(result).toContain('"a"');
      expect(result).toContain('"z"');
      // Verify it's valid JSON
      expect(() => JSON.parse(result)).not.toThrow();
    });
  });

  describe("edge cases", () => {
    it("should handle empty objects", () => {
      expect(canonicalJsonStringify({})).toBe("{}");
    });

    it("should handle empty arrays", () => {
      expect(canonicalJsonStringify([])).toBe("[]");
    });

    it("should handle objects with null values", () => {
      expect(canonicalJsonStringify({ a: null, b: 1 })).toBe('{"a":null,"b":1}');
    });
  });
});
