# Rebuild Frontend for Fast Wire Route

The `/v2/test` route needs to be included in the built frontend. The route is in the source code but the built files need to be regenerated.

## On Your Local Machine (Development)

```bash
cd wire2/frontend

# Rebuild the frontend
npm run build

# This creates/updates dist-wire/ with the new route
```

## On the Server (If Building There)

```bash
cd /opt/wire2/frontend

# Install dependencies if needed
npm install

# Rebuild
npm run build

# The dist-wire/ directory will be updated
```

## Verify the Route is in the Build

```bash
# Check if the route is in the built JS
grep -i "WireFastWireTestPage\|/test" dist-wire/assets/*.js | head -5

# Or check the built HTML
grep -i "test" dist-wire/index-wire.html
```

## Deploy the Updated Frontend

After rebuilding, you need to deploy the updated `dist-wire/` directory to your web server.

If using Docker:
```bash
# Rebuild the frontend container
docker compose build frontend
docker compose up -d frontend
```

If using static file serving:
```bash
# Copy dist-wire/ to your web server directory
cp -r dist-wire/* /path/to/web/server/
```

## Quick Check: Is Route in Source?

```bash
# Verify the route is in main-wire.tsx
grep -A 2 "/test" wire2/frontend/src/main-wire.tsx
```

If it shows the route, then you just need to rebuild and redeploy.
