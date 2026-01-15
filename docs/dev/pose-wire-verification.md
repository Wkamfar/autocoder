# POSE Wire Verification — Product Packaging (Partner-safe)

This is the **POSE Wire Verification** product surface: verifiable “receipts” and (optional) evidence bundles that any integrator can adopt **without implying Plaid endorsement**.

## What it is

- A POSE-signed receipt (JWS) for important transitions (execution / settlement)
- A public JWKS endpoint for offline verification
- Optional evidence bundles for audits (organization policy permitting)

## What it is not

- Not a claim of bank account ownership by itself
- Not a claim of Plaid endorsement/partnership

## Integrator contract

### Verify a receipt offline

1. Fetch JWKS:
   - `GET /.well-known/pose-jwks.json`
2. Verify Ed25519 signature over the JWS signing input (`headerB64.payloadB64`)
3. Validate required schema fields and compare to expected values (e.g. `bindingHash`)

### Minimal Node verifier snippet

```js
import crypto from "node:crypto";

function b64urlToBuf(s) {
  return Buffer.from(s, "base64url");
}

function verifyEd25519Jws(jws, jwks) {
  const [h, p, sig] = jws.split(".");
  if (!h || !p || !sig) throw new Error("bad jws");
  const header = JSON.parse(b64urlToBuf(h).toString("utf8"));
  const kid = header.kid;
  const key = jwks.keys.find((k) => k.kid === kid);
  if (!key) throw new Error("unknown kid");
  const signingInput = Buffer.from(`${h}.${p}`, "utf8");
  const publicKeyRaw = b64urlToBuf(key.x);

  // Convert raw Ed25519 public key bytes to SPKI DER (same header used in Wire2)
  const spkiHeader = Buffer.from([0x30,0x2a,0x30,0x05,0x06,0x03,0x2b,0x65,0x70,0x03,0x21,0x00,0x04,0x20]);
  const der = Buffer.concat([spkiHeader, publicKeyRaw]);
  const pem = `-----BEGIN PUBLIC KEY-----\n${der.toString("base64")}\n-----END PUBLIC KEY-----`;

  const ok = crypto.verify(null, signingInput, pem, b64urlToBuf(sig));
  if (!ok) throw new Error("bad signature");
  return JSON.parse(b64urlToBuf(p).toString("utf8"));
}
```

## Legal-safe language (copy/paste)

- “Receipts are cryptographically verifiable against POSE-published keys.”
- “POSE can integrate with multiple connectivity/money-movement providers; verification is provider-agnostic.”
- “Integration with Plaid (if used) does not imply Plaid endorsement.”

