import { prisma } from "../../db/prisma.js";
import { verifyEd25519 } from "../../lib/signing.js";
import { getSigningKey, isKeyRevoked } from "../../lib/keyManagement.js";

/**
 * Verify audit bundle signature.
 */
export async function verifyBundleSignature(bundleId: string, orgId?: string): Promise<{
  valid: boolean;
  error?: string;
  signerKeyId: string;
  revoked?: boolean;
}> {
  const bundle = await prisma.auditBundle.findFirst({
    where: orgId ? { id: bundleId, orgId } : { id: bundleId },
  });

  if (!bundle) {
    return {
      valid: false,
      error: "Bundle not found",
      signerKeyId: "",
    };
  }

  try {
    // Get signing key (public key) for verification
    const signingKey = await getSigningKey(bundle.signerKeyId);
    
    // Verify signature
    const isValid = verifyEd25519(
      bundle.manifestCanonicalJson,
      bundle.manifestSignature,
      signingKey.publicKey
    );

    if (!isValid) {
      return {
        valid: false,
        error: "Signature verification failed",
        signerKeyId: bundle.signerKeyId,
      };
    }

    return {
      valid: true,
      signerKeyId: bundle.signerKeyId,
      revoked: isKeyRevoked(bundle.signerKeyId),
    };
  } catch (error: any) {
    return {
      valid: false,
      error: error.message || "Verification error",
      signerKeyId: bundle.signerKeyId,
      revoked: isKeyRevoked(bundle.signerKeyId),
    };
  }
}
