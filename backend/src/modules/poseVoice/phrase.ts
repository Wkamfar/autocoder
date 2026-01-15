import { randomBytes } from "node:crypto";

// Small, neutral word list: avoids "AI" and biometric-y language.
const WORDS = [
  "quiet",
  "morning",
  "window",
  "paper",
  "garden",
  "river",
  "silver",
  "stone",
  "simple",
  "steady",
  "orange",
  "candle",
  "horizon",
  "drift",
  "harbor",
  "ledger",
  "signal",
  "moment",
  "weather",
  "thread",
  "anchor",
  "gentle",
  "circle",
  "follow",
  "between",
  "across",
  "reason",
  "market",
  "future",
  "listen",
  "calm",
  "clear",
  "open",
  "move",
  "hold",
  "soft",
];

function pickWord(randByte: number): string {
  return WORDS[randByte % WORDS.length]!;
}

export function generateUniquePhrase(wordCount: number = 10): string {
  const n = Math.max(8, Math.min(12, wordCount));
  const bytes = randomBytes(n);
  const words = Array.from(bytes).map((b) => pickWord(b));
  // Ensure it reads like a sentence (but not a password).
  const sentence = words.join(" ");
  return sentence.charAt(0).toUpperCase() + sentence.slice(1) + ".";
}

