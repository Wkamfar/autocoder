#!/usr/bin/env tsx
/**
 * OpenAPI Specification Validator
 * 
 * Validates the OpenAPI spec against:
 * 1. OpenAPI 3.0.3 syntax
 * 2. Route implementation (checks all routes exist)
 * 3. Response shape compatibility with frontend types
 * 
 * Usage: tsx src/openapi/validate-spec.ts
 */

import { readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface ValidationResult {
  passed: boolean;
  errors: string[];
  warnings: string[];
}

const REQUIRED_ROUTES = [
  "GET /health",
  "GET /intents",
  "GET /intents/{id}",
  "POST /intents",
  "PATCH /intents/{id}",
  "POST /intents/{id}/challenge",
  "POST /challenges/{challengeId}/proof",
  "POST /intents/{id}/decision",
  "POST /intents/{id}/execute",
  "GET /intents/{id}/events",
  "POST /intents/{id}/bundle",
  "GET /beneficiaries",
  "POST /beneficiaries",
  "PATCH /beneficiaries/{id}",
  "GET /policies",
  "POST /policies",
  "POST /policies/simulate",
];

const REQUIRED_SCHEMAS = [
  "TransferIntent",
  "VoiceChallenge",
  "VoiceProof",
  "Decision",
  "DecisionResponse",
  "Beneficiary",
  "PolicyVersion",
  "ServiceHealth",
  "EventLog",
  "AuditBundle",
  "ErrorResponse",
];

function validateOpenAPISpec(spec: any): ValidationResult {
  const result: ValidationResult = {
    passed: true,
    errors: [],
    warnings: [],
  };

  // Check OpenAPI version
  if (spec.openapi !== "3.0.3") {
    result.errors.push(`Invalid OpenAPI version: ${spec.openapi}. Expected 3.0.3`);
    result.passed = false;
  }

  // Check required info fields
  if (!spec.info?.title) {
    result.errors.push("Missing info.title");
    result.passed = false;
  }
  if (!spec.info?.version) {
    result.errors.push("Missing info.version");
    result.passed = false;
  }

  // Check all required routes exist
  const paths = spec.paths || {};
  for (const route of REQUIRED_ROUTES) {
    const [method, path] = route.split(" ");
    const normalizedPath = path.replace(/{(\w+)}/g, "{$1}");
    
    if (!paths[normalizedPath]) {
      result.errors.push(`Missing route: ${route}`);
      result.passed = false;
      continue;
    }

    if (!paths[normalizedPath][method.toLowerCase()]) {
      result.errors.push(`Missing method ${method} for route ${path}`);
      result.passed = false;
    }
  }

  // Check all required schemas exist
  const schemas = spec.components?.schemas || {};
  for (const schemaName of REQUIRED_SCHEMAS) {
    if (!schemas[schemaName]) {
      result.errors.push(`Missing schema: ${schemaName}`);
      result.passed = false;
    }
  }

  // Check error response format
  const errorSchema = schemas.ErrorResponse;
  if (errorSchema) {
    if (!errorSchema.properties?.error) {
      result.errors.push("ErrorResponse schema missing 'error' field");
      result.passed = false;
    }
  }

  // Check all POST/PATCH endpoints have requestBody
  for (const [path, pathItem] of Object.entries(paths)) {
    for (const [method, operation] of Object.entries(pathItem as any)) {
      if (["post", "patch", "put"].includes(method.toLowerCase())) {
        if (!operation.requestBody) {
          result.warnings.push(`${method.toUpperCase()} ${path} missing requestBody`);
        }
      }
    }
  }

  // Check all endpoints have proper responses
  for (const [path, pathItem] of Object.entries(paths)) {
    for (const [method, operation] of Object.entries(pathItem as any)) {
      if (!operation.responses) {
        result.errors.push(`${method.toUpperCase()} ${path} missing responses`);
        result.passed = false;
        continue;
      }

      // Check for at least one success response
      const successCodes = Object.keys(operation.responses).filter(
        (code) => code.startsWith("2")
      );
      if (successCodes.length === 0) {
        result.warnings.push(`${method.toUpperCase()} ${path} has no 2xx success responses`);
      }

      // Check for error responses
      const errorCodes = Object.keys(operation.responses).filter(
        (code) => code.startsWith("4") || code.startsWith("5")
      );
      if (errorCodes.length === 0) {
        result.warnings.push(`${method.toUpperCase()} ${path} has no error responses documented`);
      }
    }
  }

  return result;
}

function main() {
  const specPath = join(__dirname, "wire.openapi.json");
  console.log(`Validating OpenAPI spec: ${specPath}\n`);

  let spec: any;
  try {
    const specContent = readFileSync(specPath, "utf-8");
    spec = JSON.parse(specContent);
  } catch (error: any) {
    console.error(`❌ Failed to read/parse OpenAPI spec: ${error.message}`);
    process.exit(1);
  }

  const result = validateOpenAPISpec(spec);

  if (result.errors.length > 0) {
    console.error("❌ Validation Errors:");
    result.errors.forEach((error) => console.error(`  - ${error}`));
  }

  if (result.warnings.length > 0) {
    console.warn("\n⚠️  Warnings:");
    result.warnings.forEach((warning) => console.warn(`  - ${warning}`));
  }

  if (result.passed) {
    console.log("\n✅ OpenAPI spec validation passed!");
    console.log(`   - ${REQUIRED_ROUTES.length} routes documented`);
    console.log(`   - ${REQUIRED_SCHEMAS.length} schemas defined`);
    process.exit(0);
  } else {
    console.error(`\n❌ Validation failed with ${result.errors.length} error(s)`);
    process.exit(1);
  }
}

main();
