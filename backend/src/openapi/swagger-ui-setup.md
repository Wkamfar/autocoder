# Swagger UI Setup Guide

This guide explains how to set up Swagger UI to view and interact with the WIRE API OpenAPI specification.

## Option 1: Using @fastify/swagger (Recommended)

### Installation

```bash
npm install --save-dev @fastify/swagger @fastify/swagger-ui
```

### Setup in `src/app.ts`

```typescript
import swagger from "@fastify/swagger";
import swaggerUI from "@fastify/swagger-ui";
import { readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function buildApp() {
  const app = Fastify({ logger: true });

  // ... existing setup ...

  // Load OpenAPI spec
  const openApiSpec = JSON.parse(
    readFileSync(join(__dirname, "openapi", "wire.openapi.json"), "utf-8")
  );

  // Register Swagger
  await app.register(swagger, {
    openapi: openApiSpec,
  });

  // Register Swagger UI
  await app.register(swaggerUI, {
    routePrefix: "/docs",
    uiConfig: {
      docExpansion: "list",
      deepLinking: true,
      defaultModelsExpandDepth: 2,
      defaultModelExpandDepth: 2,
    },
    staticCSP: true,
    transformStaticCSP: (header) => header,
  });

  // ... rest of setup ...

  return app;
}
```

### Access Swagger UI

After starting the server:
```
http://localhost:3000/docs
```

## Option 2: Standalone Swagger UI Server

### Installation

```bash
npm install -g swagger-ui-serve
```

### Serve OpenAPI Spec

```bash
swagger-ui-serve wire2/backend/src/openapi/wire.openapi.json
```

Access at: `http://localhost:3001`

## Option 3: Docker Swagger UI

### Docker Compose

Add to `wire2/docker-compose.yml`:

```yaml
services:
  swagger-ui:
    image: swaggerapi/swagger-ui:latest
    ports:
      - "8080:8080"
    volumes:
      - ./wire2/backend/src/openapi/wire.openapi.json:/usr/share/nginx/html/api-spec.json
    environment:
      - SWAGGER_JSON=/usr/share/nginx/html/api-spec.json
      - BASE_URL=/swagger-ui
```

### Access

```
http://localhost:8080
```

## Option 4: Redoc (Alternative UI)

### Installation

```bash
npm install -g @redocly/cli
```

### Serve

```bash
redocly preview-docs wire2/backend/src/openapi/wire.openapi.json
```

Access at: `http://localhost:8080`

## Option 5: Online Swagger Editor

1. Go to https://editor.swagger.io/
2. File → Import File
3. Select `wire2/backend/src/openapi/wire.openapi.json`
4. View and test API

## Recommended Setup

For development, use Option 1 (@fastify/swagger) as it:
- Integrates with Fastify
- Auto-updates with code changes
- Provides interactive testing
- No separate server needed

## Customization

### Custom Theme

```typescript
await app.register(swaggerUI, {
  routePrefix: "/docs",
  theme: {
    css: [
      {
        filename: "theme.css",
        content: `
          .swagger-ui .topbar { display: none; }
          .swagger-ui .info { margin: 50px 0; }
        `,
      },
    ],
  },
});
```

### Custom Logo

```typescript
await app.register(swaggerUI, {
  routePrefix: "/docs",
  uiConfig: {
    customCss: `
      .swagger-ui .topbar { background-color: #your-color; }
      .swagger-ui .topbar .download-url-wrapper { display: none; }
    `,
  },
});
```

## Testing with Swagger UI

1. **Set Authentication:**
   - Click "Authorize" button
   - Enter `X-USER-ID` value (demo mode)
   - Or configure OAuth (production)

2. **Test Endpoints:**
   - Click "Try it out"
   - Fill in parameters
   - Click "Execute"
   - View response

3. **Save Examples:**
   - Copy request/response examples
   - Use in Postman or other tools

## Troubleshooting

### CORS Issues

If Swagger UI can't make requests:
```typescript
await app.register(cors, {
  origin: true, // Allow all origins in dev
  credentials: true,
});
```

### Spec Not Loading

Check file path:
```typescript
const specPath = join(__dirname, "openapi", "wire.openapi.json");
console.log("Spec path:", specPath); // Debug
```

### Authentication Not Working

Ensure auth plugin is registered before Swagger UI:
```typescript
await app.register(authPlugin);
await app.register(swaggerUI);
```

## Production Considerations

1. **Disable Swagger UI in Production:**
   ```typescript
   if (process.env.NODE_ENV !== "production") {
     await app.register(swaggerUI);
   }
   ```

2. **Password Protect:**
   Use basic auth middleware for `/docs` route

3. **Rate Limiting:**
   Apply rate limits to Swagger UI endpoints

4. **HTTPS Only:**
   Ensure Swagger UI is only accessible over HTTPS
