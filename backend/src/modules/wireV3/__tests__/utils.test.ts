import { describe, it, expect } from "vitest";
import { generateConfirmPhrase, isPhraseMatch } from "../utils.js";
import { computeIntentBindingHash } from "../../intents/binding.js";

describe("wire v3 utils", () => {
  it("requires full phrase match", () => {
    const phrase = "Confirm seven blue";
    expect(isPhraseMatch(phrase, "Confirm seven blue")).toBe(true);
    expect(isPhraseMatch(phrase, "confirm seven blue")).toBe(true);
    expect(isPhraseMatch(phrase, "Confirm")).toBe(false);
  });

  it("generates phrase with Confirm prefix", () => {
    const phrase = generateConfirmPhrase();
    expect(phrase.startsWith("Confirm ")).toBe(true);
  });
});

describe("binding hash includes beneficiaryVersion", () => {
  it("changes when beneficiaryVersion changes", () => {
    const base = {
      id: "intent_1",
      orgId: "org_1",
      createdByUserId: "user_1",
      railsType: "WIRE" as const,
      amountMinor: "10000",
      currency: "USD",
      beneficiaryId: "benef_1",
      purpose: "Test",
    };

    const v1 = computeIntentBindingHash({ ...base, beneficiaryVersion: 1 }).bindingHash;
    const v2 = computeIntentBindingHash({ ...base, beneficiaryVersion: 2 }).bindingHash;
    expect(v1).not.toEqual(v2);
  });
});
