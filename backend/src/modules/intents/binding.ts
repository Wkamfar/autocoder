import { canonicalJsonStringify } from "../../lib/canonicalJson.js";
import { sha256Hex } from "../../lib/sha256.js";

export type IntentBindingInput = {
  id: string;
  orgId: string;
  createdByUserId: string;
  railsType: "ACH" | "WIRE";
  amountMinor: string;
  currency: string;
  beneficiaryId: string;
  beneficiaryVersion?: number | null;
  purpose: string;
};

export function computeIntentBindingHash(intent: IntentBindingInput): {
  bindingHash: string;
  bindingCanonicalJson: string;
} {
  const subset = {
    id: intent.id,
    orgId: intent.orgId,
    createdByUserId: intent.createdByUserId,
    railsType: intent.railsType,
    amountMinor: intent.amountMinor,
    currency: intent.currency,
    beneficiaryId: intent.beneficiaryId,
    beneficiaryVersion: intent.beneficiaryVersion ?? null,
    purpose: intent.purpose,
  };

  const bindingCanonicalJson = canonicalJsonStringify(subset);
  const bindingHash = sha256Hex(bindingCanonicalJson);
  return { bindingHash, bindingCanonicalJson };
}

