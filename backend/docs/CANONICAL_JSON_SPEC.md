# Canonical JSON Specification

**Version:** 1.0  
**Last Updated:** 2025-01-01  
**Owner:** Agent C

## Overview

This document specifies the canonical JSON serialization scheme used throughout the WIRE2 system for cryptographic hashing, signing, and tamper detection.

## Goals

1. **Determinism**: Same input always produces same output
2. **Stability**: Output is stable across different key orders
3. **Verifiability**: Enables cryptographic verification of data integrity

## Specification

### Key Ordering

- Object keys are sorted **lexicographically** using UTF-8 byte order comparison
- Comparison is done byte-by-byte, not by Unicode code points
- This ensures consistent ordering across different systems

### Number Handling

- **Integers**: Preserved as-is (e.g., `42`, `-42`, `0`)
- **Floats**: Preserved as-is (e.g., `3.14`, `-0.5`)
- **NaN**: Converted to `null`
- **Infinity**: Converted to `null` (both `Infinity` and `-Infinity`)
- **Zero**: Both `-0` and `+0` become `0` (handled by JSON.stringify)

### Date Serialization

- Dates are converted to **ISO 8601** format with timezone
- Format: `YYYY-MM-DDTHH:mm:ss.sssZ` or `YYYY-MM-DDTHH:mm:ss.sss±HH:MM`
- Example: `"2024-01-01T00:00:00.000Z"`

### String Handling

- Strings are preserved as UTF-8 encoded
- **No Unicode normalization** (NFC not applied)
- This is a simplification; full RFC 8785 would apply NFC normalization

### Array Ordering

- Array order is **preserved** (order is significant)
- `[1, 2, 3]` ≠ `[3, 2, 1]`

### Null and Undefined

- `null` → `null` (preserved)
- `undefined` → `null` (converted)
- Object properties with `undefined` values become `null`

### Unsupported Types

The following types are converted to `null`:
- `undefined`
- `bigint`
- `function`
- `symbol`

### Output Format

- **No whitespace** in output
- Standard JSON format (no comments, no trailing commas)

## Examples

### Key Ordering

```javascript
// Input (different key orders)
{ z: 1, a: 2, m: 3 }
{ a: 2, m: 3, z: 1 }

// Output (same)
'{"a":2,"m":3,"z":1}'
```

### Number Handling

```javascript
canonicalJsonStringify(42)        // "42"
canonicalJsonStringify(3.14)      // "3.14"
canonicalJsonStringify(NaN)        // "null"
canonicalJsonStringify(Infinity)  // "null"
canonicalJsonStringify(-0)         // "0"
```

### Date Handling

```javascript
canonicalJsonStringify(new Date("2024-01-01T00:00:00Z"))
// '"2024-01-01T00:00:00.000Z"'
```

### Nested Structures

```javascript
canonicalJsonStringify({
  z: 1,
  a: {
    b: [1, 2, { c: 3 }]
  }
})
// '{"a":{"b":[1,2,{"c":3}]},"z":1}'
```

## Idempotency Property

Canonicalization is **idempotent**:

```javascript
const value = { z: 1, a: 2 };
const first = canonicalJsonStringify(value);
const second = canonicalJsonStringify(JSON.parse(first));
first === second; // true
```

## Implementation

- **File**: `wire2/backend/src/lib/canonicalJson.ts`
- **Function**: `canonicalJsonStringify(value: unknown): string`
- **Tests**: `wire2/backend/src/lib/__tests__/canonicalJson.test.ts`

## Relationship to RFC 8785

This implementation is **inspired by** RFC 8785 (JSON Canonicalization Scheme) but makes some simplifications:

- ✅ Key ordering (lexicographic)
- ✅ Number handling (special numbers → null)
- ✅ No whitespace
- ❌ Unicode normalization (NFC) - not implemented for simplicity
- ❌ BigInt support - converted to null

For full RFC 8785 compliance, consider using a library like `canonicalize` or implementing NFC normalization.

## Usage in WIRE2

Canonical JSON is used for:

1. **Intent binding hash**: Canonicalizes intent fields to compute binding hash
2. **Event chain**: Canonicalizes event data before hashing
3. **Bundle manifests**: Canonicalizes bundle manifest before signing
4. **Approval tokens**: Canonicalizes token data before hashing

## Testing

Property-based tests verify:
- Key order independence
- Idempotency
- Edge case handling (NaN, Infinity, undefined, etc.)

Run tests:
```bash
npm test -- canonicalJson.test.ts
```
