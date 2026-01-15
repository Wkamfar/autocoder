# Setting DATABASE_URL for Prisma Migration

## On Your Server

You need to set the `DATABASE_URL` environment variable before running the migration.

### Option 1: Check for Existing .env File

```bash
cd /opt/wire2/backend

# Check if .env exists
ls -la .env

# If it exists, check DATABASE_URL
cat .env | grep DATABASE_URL
```

### Option 2: Check docker-compose.yml or Environment Variables

```bash
# Check if there's a docker-compose file with database config
find /opt/wire2 -name "docker-compose*.yml" -type f

# Or check environment variables from running containers
docker ps | grep postgres
docker inspect <container_name> | grep DATABASE_URL
```

### Option 3: Set DATABASE_URL Manually

If you know your database connection details:

```bash
cd /opt/wire2/backend

# Format: postgresql://USER:PASSWORD@HOST:PORT/DATABASE
export DATABASE_URL="postgresql://username:password@localhost:5432/wire2"

# Or if using PostgreSQL in Docker:
export DATABASE_URL="postgresql://postgres:password@localhost:5432/wire2"

# Then run migration
npx prisma migrate dev --name add_fast_wire
```

### Option 4: Create .env File

```bash
cd /opt/wire2/backend

# Create .env file
cat > .env << EOF
DATABASE_URL=postgresql://username:password@localhost:5432/wire2
EOF

# Or append to existing .env
echo "DATABASE_URL=postgresql://username:password@localhost:5432/wire2" >> .env

# Then run migration
npx prisma migrate dev --name add_fast_wire
```

### Option 5: Check pose-core Docker Compose for Database URL

Since pose-core uses a database, you can check its configuration:

```bash
cd /opt/pose-core

# Check docker-compose files
cat docker-compose*.yml | grep DATABASE_URL
cat docker-compose*.yml | grep postgres

# The format is usually:
# DATABASE_URL=postgresql://user:pass@host:5432/dbname
```

### Example: Common Database URLs

```bash
# Local PostgreSQL
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/wire2"

# Docker PostgreSQL (same host)
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/wire2"

# Remote PostgreSQL
export DATABASE_URL="postgresql://user:pass@your-db-host:5432/wire2"

# With connection pooler
export DATABASE_URL="postgresql://user:pass@host:5432/wire2?pgbouncer=true"
```

### Verify Connection

Before running migration, test the connection:

```bash
# Using psql (if installed)
psql $DATABASE_URL -c "SELECT version();"

# Or using Prisma
npx prisma db pull --preview-feature
```

### Run Migration After Setting DATABASE_URL

```bash
cd /opt/wire2/backend

# Make sure DATABASE_URL is set
echo $DATABASE_URL

# Run migration
npx prisma migrate dev --name add_fast_wire

# Verify migration
npx prisma studio
```
