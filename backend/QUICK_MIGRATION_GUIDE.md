# Quick Migration Guide - Fast Wire

## On Your Server (root@ubuntu-s-2vcpu-4gb-amd-nyc3-01)

### Step 1: Find Where wire2 Backend Is Located

```bash
# Search for the Prisma schema file
find /opt /root -name "schema.prisma" -type f 2>/dev/null

# Check common locations
ls -la /opt/wire2/backend/prisma/schema.prisma 2>/dev/null || echo "Not in /opt/wire2"
ls -la /opt/pose-wire2/backend/prisma/schema.prisma 2>/dev/null || echo "Not in /opt/pose-wire2"
ls -la /root/wire2/backend/prisma/schema.prisma 2>/dev/null || echo "Not in /root/wire2"
```

### Step 2: If wire2 is NOT on the server, clone it:

```bash
# Navigate to /opt
cd /opt

# Clone wire2 repository (replace with your actual repo URL)
export GITHUB_TOKEN=your_github_token_here
git clone "https://a0ix:${GITHUB_TOKEN}@github.com/YOUR_USERNAME/wire2.git" wire2

# Or if wire2 is in the same org as pose-core:
git clone "https://a0ix:${GITHUB_TOKEN}@github.com/a0ix/pose-wire2.git" wire2

cd wire2/backend
```

### Step 3: Navigate to wire2/backend Directory

Once you've found or cloned wire2:

```bash
# If found at /opt/wire2
cd /opt/wire2/backend

# Verify schema exists
ls -la prisma/schema.prisma

# If schema is not in prisma/ subdirectory, check:
find . -name "schema.prisma" -type f
```

### Step 4: Check Environment Variables

```bash
# Check if .env file exists and has DATABASE_URL
cat .env | grep DATABASE_URL

# If not set, create/update .env file:
echo "DATABASE_URL=postgresql://user:password@host:5432/database" >> .env
```

### Step 5: Install Dependencies (if needed)

```bash
# Check if node_modules exists
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi
```

### Step 6: Run Migration

```bash
# Create and apply migration
npx prisma migrate dev --name add_fast_wire

# Generate Prisma client
npx prisma generate
```

### If You Get "Schema not found" Error

Specify the schema path explicitly:

```bash
npx prisma migrate dev --name add_fast_wire --schema=./prisma/schema.prisma
npx prisma generate --schema=./prisma/schema.prisma
```

### Verify Migration Success

```bash
# Check if FastWire table was created
# Replace DATABASE_URL with your actual connection string
psql $DATABASE_URL -c "\dt \"FastWire\""

# Or use Prisma Studio to verify
npx prisma studio
```

## Alternative: Run Migration Locally and Deploy

If wire2 backend is not deployed yet, you can:

1. **Run migration locally** (on your development machine):
   ```bash
   cd wire2/backend
   npx prisma migrate dev --name add_fast_wire
   ```

2. **This creates SQL in `prisma/migrations/`** - you can review and run manually on the server

3. **Or deploy wire2 backend code first**, then run migration on server
