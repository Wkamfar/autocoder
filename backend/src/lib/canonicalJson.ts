/**
 * Canonical JSON with stable key ordering.
 * 
 * Specification:
 * - Objects: keys sorted lexicographically (UTF-8 byte order)
 * - Arrays: order preserved
 * - Numbers: integers preserved as-is; floats preserved as-is
 * - Special numbers: NaN -> null, Infinity -> null, -Infinity -> null
 * - Zero: -0 and +0 both become 0 (JSON.stringify handles this)
 * - Dates: ISO 8601 format with timezone (Z or ±HH:MM)
 * - Strings: UTF-8 encoded, no normalization (NFC not applied for simplicity)
 * - Null/undefined: undefined -> null, null -> null
 * - No whitespace in output
 * 
 * This implementation is compatible with RFC 8785 JSON Canonicalization Scheme (JCS)
 * with some simplifications (no unicode normalization).
 */

type Json =
  | null
  | boolean
  | number
  | string
  | Json[]
  | { [k: string]: Json };

function normalize(value: unknown): Json {
  // Handle primitives
  if (value === null) {
    return null;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    // Handle special numbers
    if (Number.isNaN(value)) {
      return null; // NaN -> null
    }
    if (!Number.isFinite(value)) {
      return null; // Infinity/-Infinity -> null
    }
    // -0 and +0 are both preserved as 0 (JSON.stringify handles this correctly)
    return value;
  }

  if (typeof value === "string") {
    return value; // UTF-8 strings preserved as-is (no NFC normalization)
  }

  // Handle Date objects
  if (value instanceof Date) {
    // ISO 8601 format with timezone
    return value.toISOString();
  }

  // Handle arrays
  if (Array.isArray(value)) {
    return value.map((v) => normalize(v));
  }

  // Handle objects
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    // Sort keys lexicographically (UTF-8 byte order)
    const keys = Object.keys(obj).sort((a, b) => {
      // UTF-8 byte comparison (lexicographic)
      const aBytes = Buffer.from(a, "utf8");
      const bBytes = Buffer.from(b, "utf8");
      const minLength = Math.min(aBytes.length, bBytes.length);
      for (let i = 0; i < minLength; i++) {
        if (aBytes[i] !== bBytes[i]) {
          return aBytes[i] - bBytes[i];
        }
      }
      return aBytes.length - bBytes.length;
    });
    const out: Record<string, Json> = {};
    for (const k of keys) {
      out[k] = normalize(obj[k]);
    }
    return out;
  }

  // Handle unsupported types: undefined, bigint, function, symbol -> null
  return null;
}

/**
 * Canonical JSON stringify.
 * 
 * Guarantees:
 * - Same input always produces same output
 * - Key order is deterministic (lexicographic)
 * - No whitespace
 * - Special numbers (NaN, Infinity) become null
 * 
 * @param value - Value to canonicalize
 * @returns Canonical JSON string (no whitespace)
 */
export function canonicalJsonStringify(value: unknown): string {
  return JSON.stringify(normalize(value));
}

