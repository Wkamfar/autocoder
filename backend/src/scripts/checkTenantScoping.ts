/**
 * Agent 0 sign-off guardrail:
 * Fail CI if we introduce obvious unscoped Prisma reads on tenant-scoped data.
 *
 * This is intentionally simple and grep-like. It's not a full AST parser, but it
 * catches the common footgun: `findUnique({ where: { id: ... } })` on org-scoped tables.
 *
 * Usage:
 *   tsx src/scripts/checkTenantScoping.ts
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.cwd(), "src");

// Conservative list: these models are tenant-scoped and should not be loaded by id without org scoping.
const TENANT_SCOPED_MODELS = [
  "intent",
  "beneficiary",
  "voiceChallenge",
  "voiceProof",
  "decision",
  "approval",
  "approvalToken",
  "intentEvent",
  "auditBundle",
  "executionLedger",
  "apiKey",
  "webhook",
  "userInvitation",
  "legalEntity",
  "financialAccount",
  "evidenceDownload",
  "legalHold",
];

// Allowlist a few safe patterns (tokenHash is unguessable; serviceHealth is singleton, etc.)
const ALLOWLIST = [
  /prisma\.serviceHealth\.findUnique\(/,
  /prisma\.approvalToken\.findUnique\(\{\s*where:\s*\{\s*tokenHash:/,
  /prisma\.idempotencyKey\.findUnique\(/,
];

function listFiles(dir: string): string[] {
  const out: string[] = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...listFiles(p));
    else if (p.endsWith(".ts")) out.push(p);
  }
  return out;
}

function isAllowed(line: string): boolean {
  return ALLOWLIST.some((re) => re.test(line));
}

// Detect `prisma.<model>.findUnique({ where: { id: ... } })` within a small window.
function scan(contents: string): Array<{ line: number; text: string }> {
  const lines = contents.split(/\r?\n/);
  const hits: Array<{ line: number; text: string }> = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.includes("findUnique")) continue;
    if (isAllowed(line)) continue;

    for (const model of TENANT_SCOPED_MODELS) {
      if (!line.includes(`prisma.${model}.findUnique`)) continue;

      const window = lines.slice(i, Math.min(i + 8, lines.length)).join("\n");
      if (isAllowed(window)) continue;

      if (/\bwhere:\s*\{\s*id:\s*/.test(window)) {
        hits.push({ line: i + 1, text: line.trim() });
      }
    }
  }

  return hits;
}

const files = listFiles(ROOT);
const violations: Array<{ file: string; line: number; text: string }> = [];

for (const f of files) {
  const c = fs.readFileSync(f, "utf8");
  for (const hit of scan(c)) violations.push({ file: f, line: hit.line, text: hit.text });
}

if (violations.length) {
  // eslint-disable-next-line no-console
  console.error("\nTenant scoping guardrail failed: unscoped findUnique({ where: { id } }) detected.\n");
  for (const v of violations) {
    // eslint-disable-next-line no-console
    console.error(`- ${path.relative(process.cwd(), v.file)}:${v.line}  ${v.text}`);
  }
  // eslint-disable-next-line no-console
  console.error("\nFix: scope by orgId (findFirst({ where: { id, orgId } })) or use a compound unique key.\n");
  process.exit(1);
}

// eslint-disable-next-line no-console
console.log(`Tenant scoping guardrail: OK (${files.length} files scanned)`);

