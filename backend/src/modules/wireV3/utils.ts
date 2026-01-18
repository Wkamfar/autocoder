import crypto from "crypto";

const PHRASE_WORDS = ["blue", "amber", "silver", "echo", "delta", "nova"];
const PHRASE_NUMBERS = ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];

function randomChoice<T>(values: T[]): T {
  const index = crypto.randomInt(0, values.length);
  return values[index];
}

export function generateConfirmPhrase() {
  const word = randomChoice(PHRASE_WORDS);
  const number = randomChoice(PHRASE_NUMBERS);
  return `Confirm ${number} ${word}`;
}

export function isPhraseMatch(phrase: string, transcript: string) {
  if (!phrase || !transcript) return false;
  const normalizedPhrase = phrase.trim().toLowerCase().replace(/\s+/g, " ");
  const normalizedTranscript = transcript.trim().toLowerCase().replace(/\s+/g, " ");
  return normalizedTranscript === normalizedPhrase;
}
