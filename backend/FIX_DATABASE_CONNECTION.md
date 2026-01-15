# Fix Database Connection for Migration

The database is running in Docker (hostname `postgres`), but you're running the migration from the host. You have a few options:

## Option 1: Use Docker Host Network (if port is exposed)

Check if PostgreSQL port is exposed:

```bash
cd /opt/pose-core
cat docker-compose*.yml | grep -A 2 -B 2 "5432:5432"

# If port is exposed, use localhost
export DATABASE_URL="postgresql://wire2_user:wire2_password@localhost:5432/wire2?schema=public"
```

## Option 2: Run Migration Inside Docker Container

```bash
cd /opt/pose-core

# Find the wire2 backend container
docker ps | grep wire2

# Run migration inside the container
docker compose exec wire2-backend npx prisma migrate dev --name add_fast_wire

# Or if using docker-compose
docker-compose exec wire2-backend npx prisma migrate dev --name add_fast_wire
```

## Option 3: Use Docker Network IP

```bash
# Get the database container IP
docker inspect $(docker ps | grep postgres | awk '{print $1}') | grep IPAddress

# Or use the network gateway IP (usually 172.x.x.1)
export DATABASE_URL="postgresql://wire2_user:wire2_password@172.17.0.1:5432/wire2?schema=public"
```

## Option 4: Connect via Docker Network

```bash
# Create a temporary container in the same network
docker run --rm -it --network pose-core_default \
  -v /opt/wire2/backend:/app \
  -w /app \
  node:20 \
  sh -c "npm install && DATABASE_URL='postgresql://wire2_user:wire2_password@postgres:5432/wire2?schema=public' npx prisma migrate dev --name add_fast_wire"
```

## Option 5: Check if PostgreSQL port is exposed (Easiest)

```bash
# Check if port 5432 is listening
netstat -tlnp | grep 5432
# Or
ss -tlnp | grep 5432

# If it shows 0.0.0.0:5432, the port is exposed
# Then use:
export DATABASE_URL="postgresql://wire2_user:wire2_password@localhost:5432/wire2?schema=public"
```

## Recommended Solution

The easiest is to check if the port is exposed and use localhost, or run the migration inside the Docker container.
