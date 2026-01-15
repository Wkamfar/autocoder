/**
 * Agent 0 guardrail:
 * Fail CI if a Prisma SQL migration includes obviously destructive operations
 * (DROP TABLE / DROP COLUMN) without an explicit approval marker.
 *
 * Usage:
 *   tsx src/scripts/checkMigrationSafety.ts
 *
 * Override marker:
 *   Include `MIGRATION_SAFETY_OVERRIDE=YES` in the migration.sql file (comment).
 */
import fs from "node:fs";
import path from "node:path";

const MIGRATIONS_DIR = path.resolve(process.cwd(), "prisma", "migrations");

const OVERRIDE_MARKER = "MIGRATION_SAFETY_OVERRIDE=YES";

// Conservative patterns: block obviously destructive changes unless explicitly overridden.
const FORBIDDEN = [
  /\bDROP\s+TABLE\b/i,
  /\bDROP\s+COLUMN\b/i,
  /\bTRUNCATE\b/i,
];

function listMigrationSqlFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      const sql = path.join(p, "migration.sql");
      if (fs.existsSync(sql)) out.push(sql);
    }
  }
  return out.sort();
}

const files = listMigrationSqlFiles(MIGRATIONS_DIR);
const violations: Array<{ file: string; rule: string; excerpt: string }> = [];

for (const f of files) {
  const c = fs.readFileSync(f, "utf8");
  if (c.includes(OVERRIDE_MARKER)) continue;

  for (const re of FORBIDDEN) {
    const m = c.match(re);
    if (m) {
      // Give a small excerpt for debugging.
      const idx = Math.max(0, (m.index ?? 0) - 80);
      const excerpt = c.slice(idx, idx + 240).replace(/\s+/g, " ").trim();
      violations.push({ file: f, rule: re.toString(), excerpt });
    }
  }
}

if (violations.length) {
  // eslint-disable-next-line no-console
  console.error("\nMigration safety guardrail failed: destructive SQL detected.\n");
  for (const v of violations) {
    // eslint-disable-next-line no-console
    console.error(`- ${path.relative(process.cwd(), v.file)} matched ${v.rule}\n  ${v.excerpt}\n`);
  }
  // eslint-disable-next-line no-console
  console.error(
    `If this is intentional, add a comment containing "${OVERRIDE_MARKER}" to the migration.sql and document rollback in MIGRATION_SAFETY.md.\n`
  );
  process.exit(1);
}

// eslint-disable-next-line no-console
console.log(`Migration safety guardrail: OK (${files.length} migration.sql files scanned)`);

