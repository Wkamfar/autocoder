# Deploy Fast Wire Route (/v2/test)

The frontend needs to be rebuilt and redeployed to include the new `/test` route.

## Option 1: Build and Run Frontend Docker Container (Recommended)

On your server:

```bash
cd /opt/wire2

# Build the frontend Docker image
cd frontend
docker build -t wire2-frontend:latest -f Dockerfile .

# Stop any existing frontend container
docker stop wire2-frontend-prod 2>/dev/null || true
docker rm wire2-frontend-prod 2>/dev/null || true

# Run the new frontend container
docker run -d \
  --name wire2-frontend-prod \
  --network wire2-network-prod \
  -p 8080:80 \
  --restart unless-stopped \
  wire2-frontend:latest

# Or if you have a reverse proxy (nginx) on the host:
# docker run -d \
#   --name wire2-frontend-prod \
#   --network wire2-network-prod \
#   --restart unless-stopped \
#   wire2-frontend:latest
```

## Option 2: Use the Deployment Script

```bash
cd /opt/wire2
./deploy-frontend.sh

# Then run the container
docker run -d \
  --name wire2-frontend-prod \
  --network wire2-network-prod \
  -p 8080:80 \
  --restart unless-stopped \
  wire2-frontend:latest
```

## Option 3: Extract Built Files for Static Serving

If you're serving the frontend via nginx on the host (not in Docker):

```bash
cd /opt/wire2/frontend

# Build the Docker image
docker build -t wire2-frontend:latest -f Dockerfile .

# Extract the built files
docker create --name wire-frontend-tmp wire2-frontend:latest
docker cp wire-frontend-tmp:/usr/share/nginx/html ./dist-wire-extracted
docker rm wire-frontend-tmp

# Copy to your nginx web root (adjust path as needed)
# sudo cp -r dist-wire-extracted/* /var/www/wire.pose.xyz/v2/
# Or wherever your nginx is serving from
```

## Verify the Route is in the Build

```bash
# Check if the route is in the built JS
docker exec wire2-frontend-prod grep -i "WireFastWireTestPage\|/test" /usr/share/nginx/html/assets/*.js | head -3

# Or if using extracted files:
grep -i "WireFastWireTestPage\|/test" dist-wire-extracted/assets/*.js | head -3
```

## Check Current Frontend Setup

```bash
# Check if there's a running frontend container
docker ps | grep frontend

# Check if nginx is serving static files
ps aux | grep nginx

# Check nginx config
cat /etc/nginx/sites-enabled/* | grep -i wire
```

## After Deployment

1. The route should be accessible at: `https://wire.pose.xyz/v2/test`
2. If you get redirected, check:
   - The build includes the route (see verify step above)
   - Nginx is configured correctly
   - The frontend container is running and healthy
