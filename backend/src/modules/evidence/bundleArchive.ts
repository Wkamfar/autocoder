import archiver from "archiver";
import { canonicalJsonStringify } from "../../lib/canonicalJson.js";

/**
 * Create a ZIP archive for an audit bundle.
 * 
 * Archive structure:
 * - manifest.json (canonical JSON)
 * - manifest.sig (base64url signature)
 * - events.jsonl (one JSON per line, ordered by seq)
 * - challenges/ (if any)
 * - proofs/ (if any)
 * - metadata.json
 */

export interface BundleManifest {
  intent: any;
  beneficiary: any;
  challenges: any[];
  proofs: any[];
  decisions: any[];
  events: any[];
  policy: any;
}

export interface BundleArchiveOptions {
  mode?: "full" | "redacted";
}

/**
 * Redact PII from data for redacted export mode.
 */
function redactPII(data: any): any {
  if (typeof data !== "object" || data === null) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(redactPII);
  }

  const redacted: any = {};
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    
    // Redact sensitive fields
    if (
      lowerKey.includes("account") ||
      lowerKey.includes("routing") ||
      lowerKey === "name" ||
      lowerKey === "email" ||
      lowerKey === "phone" ||
      lowerKey.includes("address") ||
      lowerKey.includes("ssn") ||
      lowerKey.includes("taxid")
    ) {
      redacted[key] = "***REDACTED***";
    } else if (lowerKey === "audio" || lowerKey === "transcript") {
      // Redact audio/transcript data
      redacted[key] = "***REDACTED***";
    } else if (typeof value === "object" && value !== null) {
      redacted[key] = redactPII(value);
    } else {
      redacted[key] = value;
    }
  }

  return redacted;
}

/**
 * Create bundle archive as Buffer.
 */
export async function createBundleArchive(
  manifest: BundleManifest,
  manifestSignature: string,
  signerKeyId: string,
  options: BundleArchiveOptions = {}
): Promise<Buffer> {
  const mode = options.mode || "full";
  
  // Apply redaction if needed
  const manifestToArchive = mode === "redacted" ? redactPII(manifest) : manifest;

  return new Promise((resolve, reject) => {
    const archive = archiver("zip", {
      zlib: { level: 9 }, // Maximum compression
    });

    const chunks: Buffer[] = [];
    archive.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });

    archive.on("end", () => {
      resolve(Buffer.concat(chunks));
    });

    archive.on("error", (err) => {
      reject(err);
    });

    // Add manifest.json (canonical JSON)
    archive.append(canonicalJsonStringify(manifestToArchive), {
      name: "manifest.json",
    });

    // Add manifest.sig (signature)
    archive.append(manifestSignature, {
      name: "manifest.sig",
    });

    // Add metadata.json
    const metadata = {
      bundleId: `bundle_${manifest.intent.id}_${Date.now()}`,
      intentId: manifest.intent.id,
      createdAt: new Date().toISOString(),
      signerKeyId,
      version: "1.0",
      mode,
    };
    archive.append(JSON.stringify(metadata, null, 2), {
      name: "metadata.json",
    });

    // Add events.jsonl (one JSON per line)
    if (manifest.events && manifest.events.length > 0) {
      const eventsJsonl = manifest.events
        .map((e: any) => canonicalJsonStringify(e))
        .join("\n");
      archive.append(eventsJsonl, {
        name: "events.jsonl",
      });
    }

    // Add challenges/ directory (if any)
    if (manifest.challenges && manifest.challenges.length > 0) {
      for (const challenge of manifest.challenges) {
        const challengeData = mode === "redacted" 
          ? { ...challenge, audio: "***REDACTED***", transcript: "***REDACTED***" }
          : challenge;
        archive.append(canonicalJsonStringify(challengeData), {
          name: `challenges/${challenge.id || challenge.challengeId || "unknown"}.json`,
        });
      }
    }

    // Add proofs/ directory (if any)
    if (manifest.proofs && manifest.proofs.length > 0) {
      for (const proof of manifest.proofs) {
        const proofData = mode === "redacted"
          ? { ...proof, audio: "***REDACTED***", transcript: "***REDACTED***" }
          : proof;
        archive.append(canonicalJsonStringify(proofData), {
          name: `proofs/${proof.id || proof.proofId || "unknown"}.json`,
        });
      }
    }

    archive.finalize();
  });
}
