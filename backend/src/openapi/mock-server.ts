#!/usr/bin/env tsx
/**
 * OpenAPI Mock Server
 * 
 * Generates a mock server from the OpenAPI specification.
 * Useful for frontend development and testing without backend.
 * 
 * Usage: tsx src/openapi/mock-server.ts
 */

import Fastify from "fastify";
import { readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface MockResponse {
  statusCode: number;
  body: any;
  headers?: Record<string, string>;
}

function generateMockResponse(schema: any, example?: any): any {
  if (example) {
    return example;
  }

  if (schema.$ref) {
    // Handle $ref by looking up schema
    return generateMockResponse({ type: "object" });
  }

  switch (schema.type) {
    case "object":
      const obj: any = {};
      if (schema.properties) {
        for (const [key, propSchema] of Object.entries(schema.properties as Record<string, any>)) {
          obj[key] = generateMockResponse(propSchema);
        }
      }
      return obj;

    case "array":
      return [generateMockResponse(schema.items || {})];

    case "string":
      if (schema.enum) {
        return schema.enum[0];
      }
      if (schema.format === "date-time") {
        return new Date().toISOString();
      }
      return "mock_string";

    case "number":
    case "integer":
      return schema.minimum || 0;

    case "boolean":
      return false;

    default:
      return null;
  }
}

async function createMockServer() {
  const app = Fastify({ logger: true });

  // Load OpenAPI spec
  const specPath = join(__dirname, "wire.openapi.json");
  const specContent = readFileSync(specPath, "utf-8");
  const spec = JSON.parse(specContent);

  // CORS
  await app.register(require("@fastify/cors"), {
    origin: true,
  });

  // Mock all endpoints
  for (const [path, pathItem] of Object.entries(spec.paths)) {
    for (const [method, operation] of Object.entries(pathItem as any)) {
      if (typeof operation !== "object" || !operation.operationId) continue;

      const routePath = path.replace(/{(\w+)}/g, ":$1");
      const httpMethod = method.toLowerCase();

      app.route({
        method: httpMethod.toUpperCase() as any,
        url: routePath,
        handler: async (request, reply) => {
          // Find success response
          const successResponse = Object.entries(operation.responses || {})
            .find(([code]) => code.startsWith("2"))?.[1] as any;

          if (successResponse) {
            const contentType = Object.keys(successResponse.content || {})[0] || "application/json";
            const responseSchema = successResponse.content?.[contentType]?.schema;

            let mockBody: any;
            if (successResponse.content?.[contentType]?.examples) {
              const example = Object.values(successResponse.content[contentType].examples)[0] as any;
              mockBody = example?.value;
            } else {
              mockBody = generateMockResponse(responseSchema || {});
            }

            // Set status code
            const statusCode = parseInt(Object.keys(operation.responses).find((c) => c.startsWith("2")) || "200");

            return reply.code(statusCode).send(mockBody);
          }

          // Default response
          return reply.code(200).send({ mock: true });
        },
      });

      console.log(`Mocked ${httpMethod.toUpperCase()} ${routePath}`);
    }
  }

  // Serve OpenAPI spec
  app.get("/openapi.json", async () => {
    return spec;
  });

  const port = process.env.MOCK_PORT ? parseInt(process.env.MOCK_PORT) : 3001;
  const host = process.env.MOCK_HOST || "0.0.0.0";

  await app.listen({ port, host });
  console.log(`\n🚀 Mock server running at http://${host}:${port}`);
  console.log(`📚 OpenAPI spec at http://${host}:${port}/openapi.json\n`);
}

createMockServer().catch(console.error);
