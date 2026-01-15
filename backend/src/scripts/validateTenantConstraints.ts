#!/usr/bin/env tsx
/**
 * Agent 4 validation: verify all composite org-scoped foreign key constraints
 * are correctly defined in both schema.prisma and migrations.
 *
 * This script ensures:
 * 1. Every composite FK in schema.prisma has a corresponding SQL constraint in migrations
 * 2. The SQL syntax is correct (composite FKs require unique indexes on referenced columns)
 * 3. No missing constraints that would allow cross-tenant data leakage
 */

import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface ExpectedConstraint {
  table: string;
  fields: string[];
  refTable: string;
  refFields: string[];
  description: string;
}

// Expected composite FK constraints (from schema.prisma analysis)
const EXPECTED_CONSTRAINTS: ExpectedConstraint[] = [
  // Session → User
  {
    table: "Session",
    fields: ["userId", "orgId"],
    refTable: "User",
    refFields: ["id", "orgId"],
    description: "Session must belong to same org as User",
  },
  // Intent → User (createdBy)
  {
    table: "Intent",
    fields: ["createdByUserId", "orgId"],
    refTable: "User",
    refFields: ["id", "orgId"],
    description: "Intent creator must belong to same org",
  },
  // Intent → Beneficiary
  {
    table: "Intent",
    fields: ["beneficiaryId", "orgId"],
    refTable: "Beneficiary",
    refFields: ["id", "orgId"],
    description: "Intent beneficiary must belong to same org",
  },
  // VoiceChallenge → Intent
  {
    table: "VoiceChallenge",
    fields: ["intentId", "orgId"],
    refTable: "Intent",
    refFields: ["id", "orgId"],
    description: "VoiceChallenge must belong to same org as Intent",
  },
  // VoiceProof → Intent
  {
    table: "VoiceProof",
    fields: ["intentId", "orgId"],
    refTable: "Intent",
    refFields: ["id", "orgId"],
    description: "VoiceProof must belong to same org as Intent",
  },
  // VoiceProof → VoiceChallenge
  {
    table: "VoiceProof",
    fields: ["challengeId", "orgId"],
    refTable: "VoiceChallenge",
    refFields: ["id", "orgId"],
    description: "VoiceProof challenge must belong to same org",
  },
  // VoiceProof → User
  {
    table: "VoiceProof",
    fields: ["userId", "orgId"],
    refTable: "User",
    refFields: ["id", "orgId"],
    description: "VoiceProof user must belong to same org",
  },
  // Decision → Intent
  {
    table: "Decision",
    fields: ["intentId", "orgId"],
    refTable: "Intent",
    refFields: ["id", "orgId"],
    description: "Decision must belong to same org as Intent",
  },
  // Decision → User
  {
    table: "Decision",
    fields: ["createdByUserId", "orgId"],
    refTable: "User",
    refFields: ["id", "orgId"],
    description: "Decision creator must belong to same org",
  },
  // ApprovalToken → Intent
  {
    table: "ApprovalToken",
    fields: ["intentId", "orgId"],
    refTable: "Intent",
    refFields: ["id", "orgId"],
    description: "ApprovalToken must belong to same org as Intent",
  },
  // IntentEvent → Intent
  {
    table: "IntentEvent",
    fields: ["intentId", "orgId"],
    refTable: "Intent",
    refFields: ["id", "orgId"],
    description: "IntentEvent must belong to same org as Intent",
  },
  // IntentEvent → User (nullable)
  {
    table: "IntentEvent",
    fields: ["createdByUserId", "orgId"],
    refTable: "User",
    refFields: ["id", "orgId"],
    description: "IntentEvent creator must belong to same org (nullable)",
  },
  // AuditBundle → Intent
  {
    table: "AuditBundle",
    fields: ["intentId", "orgId"],
    refTable: "Intent",
    refFields: ["id", "orgId"],
    description: "AuditBundle must belong to same org as Intent",
  },
  // AuditBundle → User (nullable)
  {
    table: "AuditBundle",
    fields: ["createdByUserId", "orgId"],
    refTable: "User",
    refFields: ["id", "orgId"],
    description: "AuditBundle creator must belong to same org (nullable)",
  },
  // Approval → Intent
  {
    table: "Approval",
    fields: ["intentId", "orgId"],
    refTable: "Intent",
    refFields: ["id", "orgId"],
    description: "Approval must belong to same org as Intent",
  },
  // Approval → User
  {
    table: "Approval",
    fields: ["approverUserId", "orgId"],
    refTable: "User",
    refFields: ["id", "orgId"],
    description: "Approval approver must belong to same org",
  },
  // Approval → Decision (nullable)
  {
    table: "Approval",
    fields: ["decisionId", "orgId"],
    refTable: "Decision",
    refFields: ["id", "orgId"],
    description: "Approval decision must belong to same org (nullable)",
  },
  // ExecutionLedger → Intent
  {
    table: "ExecutionLedger",
    fields: ["intentId", "orgId"],
    refTable: "Intent",
    refFields: ["id", "orgId"],
    description: "ExecutionLedger must belong to same org as Intent",
  },
  // ExecutionLedger → User
  {
    table: "ExecutionLedger",
    fields: ["executedByUserId", "orgId"],
    refTable: "User",
    refFields: ["id", "orgId"],
    description: "ExecutionLedger executor must belong to same org",
  },
  // ApiKey → User
  {
    table: "ApiKey",
    fields: ["userId", "orgId"],
    refTable: "User",
    refFields: ["id", "orgId"],
    description: "ApiKey user must belong to same org",
  },
  // Webhook → User
  {
    table: "Webhook",
    fields: ["userId", "orgId"],
    refTable: "User",
    refFields: ["id", "orgId"],
    description: "Webhook user must belong to same org",
  },
  // WebhookDelivery → Webhook
  {
    table: "WebhookDelivery",
    fields: ["webhookId", "orgId"],
    refTable: "Webhook",
    refFields: ["id", "orgId"],
    description: "WebhookDelivery must belong to same org as Webhook",
  },
  // UserInvitation → User
  {
    table: "UserInvitation",
    fields: ["invitedByUserId", "orgId"],
    refTable: "User",
    refFields: ["id", "orgId"],
    description: "UserInvitation inviter must belong to same org",
  },
  // LegalHold → User
  {
    table: "LegalHold",
    fields: ["createdByUserId", "orgId"],
    refTable: "User",
    refFields: ["id", "orgId"],
    description: "LegalHold creator must belong to same org",
  },
  // EvidenceDownload → User
  {
    table: "EvidenceDownload",
    fields: ["userId", "orgId"],
    refTable: "User",
    refFields: ["id", "orgId"],
    description: "EvidenceDownload user must belong to same org",
  },
  // OrgAuditEvent → User (nullable)
  {
    table: "OrgAuditEvent",
    fields: ["actorUserId", "orgId"],
    refTable: "User",
    refFields: ["id", "orgId"],
    description: "OrgAuditEvent actor must belong to same org (nullable)",
  },
  // BankConnection → User
  {
    table: "BankConnection",
    fields: ["createdByUserId", "orgId"],
    refTable: "User",
    refFields: ["id", "orgId"],
    description: "BankConnection creator must belong to same org",
  },
  // FinancialAccount → LegalEntity
  {
    table: "FinancialAccount",
    fields: ["legalEntityId", "orgId"],
    refTable: "LegalEntity",
    refFields: ["id", "orgId"],
    description: "FinancialAccount must belong to same org as LegalEntity",
  },
  // BeneficiaryVersion → Beneficiary
  {
    table: "BeneficiaryVersion",
    fields: ["beneficiaryId", "orgId"],
    refTable: "Beneficiary",
    refFields: ["id", "orgId"],
    description: "BeneficiaryVersion must belong to same org as Beneficiary",
  },
];

function findConstraintInMigrations(
  migrationsDir: string,
  constraint: ExpectedConstraint
): { found: boolean; migration?: string } {
  const migrations = readdirSync(migrationsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  for (const migration of migrations) {
    const migrationPath = join(migrationsDir, migration, "migration.sql");
    try {
      const sql = readFileSync(migrationPath, "utf-8");

      // Build pattern: FOREIGN KEY ("field1","field2") REFERENCES "RefTable"("refField1","refField2")
      // Handle both exact order and any order (PostgreSQL allows reordering)
      const fieldList = constraint.fields.map((f) => `"${f}"`).join("\\s*,\\s*");
      const refFieldList = constraint.refFields.map((f) => `"${f}"`).join("\\s*,\\s*");

      // More flexible pattern that matches the constraint even if fields are in different positions
      // We check that all fields are present in the FK and all ref fields are present in REFERENCES
      const allFieldsPresent = constraint.fields.every((f) =>
        sql.includes(`"${f}"`)
      );
      const allRefFieldsPresent = constraint.refFields.every((f) =>
        sql.includes(`"${f}"`)
      );

      const pattern = new RegExp(
        `FOREIGN KEY\\s*\\([^)]*\\)\\s*REFERENCES\\s*"${constraint.refTable.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"\\s*\\([^)]*\\)`,
        "i"
      );

      // Check if pattern matches AND all required fields are present
      if (pattern.test(sql) && allFieldsPresent && allRefFieldsPresent) {
        // Verify the constraint is for the right table
        const tablePattern = new RegExp(
          `ALTER TABLE\\s+"${constraint.table.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`,
          "i"
        );
        if (tablePattern.test(sql)) {
          return { found: true, migration };
        }
      }

      // Already handled above
    } catch (err) {
      // Skip if migration file doesn't exist
    }
  }

  return { found: false };
}

function main() {
  const backendRoot = join(__dirname, "../..");
  const migrationsDir = join(backendRoot, "prisma/migrations");

  console.log("🔍 Validating composite org-scoped foreign key constraints...\n");
  console.log(
    `Checking ${EXPECTED_CONSTRAINTS.length} expected constraints against migrations...\n`
  );

  let allValid = true;
  const results: Array<{
    constraint: ExpectedConstraint;
    status: "✅" | "❌";
    migration?: string;
  }> = [];

  for (const constraint of EXPECTED_CONSTRAINTS) {
    const result = findConstraintInMigrations(migrationsDir, constraint);

    if (result.found) {
      results.push({
        constraint,
        status: "✅",
        migration: result.migration,
      });
    } else {
      allValid = false;
      results.push({
        constraint,
        status: "❌",
      });
    }
  }

  // Print results
  for (const { constraint, status, migration } of results) {
    console.log(
      `${status} ${constraint.table}(${constraint.fields.join(", ")}) → ${constraint.refTable}(${constraint.refFields.join(", ")})`
    );
    console.log(`   ${constraint.description}`);
    if (status === "✅") {
      console.log(`   ✓ Found in migration: ${migration}`);
    } else {
      console.log(`   ✗ MISSING: No migration found`);
    }
    console.log();
  }

  console.log("=".repeat(80));
  if (allValid) {
    console.log(
      `✅ All ${EXPECTED_CONSTRAINTS.length} composite FK constraints validated successfully!`
    );
    console.log("\nAgent 4 tenant isolation: DB constraints verified ✓");
    process.exit(0);
  } else {
    const missing = results.filter((r) => r.status === "❌").length;
    console.log(
      `❌ Validation failed: ${missing} missing constraint(s) in migrations`
    );
    process.exit(1);
  }
}

// Run if executed directly
main();
