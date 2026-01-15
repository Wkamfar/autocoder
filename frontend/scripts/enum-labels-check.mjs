import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function extractUnionLiterals(tsSource, typeName) {
  const blockRe = new RegExp(`export\\s+type\\s+${typeName}\\s*=([\\s\\S]*?);`, "m");
  const block = tsSource.match(blockRe)?.[1];
  assert(block, `Could not find type ${typeName} in TS source`);

  const literals = [...block.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  assert(literals.length > 0, `No literals found for ${typeName}`);
  return new Set(literals);
}

function extractEnumRowsFromMarkdown(mdSource, heading) {
  // Find section heading and the first markdown table under it.
  const idx = mdSource.indexOf(heading);
  assert(idx >= 0, `Could not find section heading "${heading}"`);
  const after = mdSource.slice(idx);

  const lines = after.split("\n");
  const tableStart = lines.findIndex((l) => l.trim().startsWith("| Enum |"));
  assert(tableStart >= 0, `Could not find table for section "${heading}"`);

  const rows = [];
  for (let i = tableStart + 2; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith("|")) break;
    const m = line.match(/^\|\s*`([^`]+)`\s*\|\s*([^|]+)\|\s*$/);
    if (m) rows.push(m[1].trim());
  }

  assert(rows.length > 0, `No enum rows found in table for section "${heading}"`);
  return new Set(rows);
}

function diff(a, b) {
  return [...a].filter((x) => !b.has(x));
}

// Resolve paths relative to this script.
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(scriptDir, ".."); // wire2/frontend
const wire2Root = path.resolve(frontendRoot, ".."); // wire2/

const typesPath = path.join(frontendRoot, "src", "wire", "types", "wire.ts");
const labelsPath = path.join(wire2Root, "docs", "ux", "STATE_MACHINE_LABELS.md");

const typesSrc = read(typesPath);
const labelsSrc = read(labelsPath);

const intentTs = extractUnionLiterals(typesSrc, "IntentStatus");
const requestTs = extractUnionLiterals(typesSrc, "RequestStatus");

const intentDoc = extractEnumRowsFromMarkdown(labelsSrc, "## Intent status");
const requestDoc = extractEnumRowsFromMarkdown(labelsSrc, "## Request status");

const missingIntentDoc = diff(intentTs, intentDoc);
const missingRequestDoc = diff(requestTs, requestDoc);

const extraIntentDoc = diff(intentDoc, intentTs);
const extraRequestDoc = diff(requestDoc, requestTs);

assert(
  missingIntentDoc.length === 0 && missingRequestDoc.length === 0,
  `STATE_MACHINE_LABELS.md missing enums: ${[
    missingIntentDoc.length ? `IntentStatus: ${missingIntentDoc.join(", ")}` : null,
    missingRequestDoc.length ? `RequestStatus: ${missingRequestDoc.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join(" | ")}`
);

assert(
  extraIntentDoc.length === 0 && extraRequestDoc.length === 0,
  `STATE_MACHINE_LABELS.md has extra/unknown enums: ${[
    extraIntentDoc.length ? `IntentStatus: ${extraIntentDoc.join(", ")}` : null,
    extraRequestDoc.length ? `RequestStatus: ${extraRequestDoc.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join(" | ")}`
);

console.log("[enum-labels-check] OK");

