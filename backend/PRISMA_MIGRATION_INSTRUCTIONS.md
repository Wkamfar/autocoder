# Prisma Migration Instructions for Fast Wire

## On Your Server

You need to run the Prisma migration on the server where the wire2 backend code is located.

### Step 1: Find the Repository Location

The wire2 code is separate from the pose-core repository. You need to locate it:

```bash
# Check common locations
ls -la /opt/ | grep wire
ls -la /root/ | grep wire
find /opt -type d -name "wire2" 2>/dev/null
find /root -type d -name "wire2" 2>/dev/null
```

### Step 2: Clone wire2 Repository (if not already present)

If wire2 is not on the server, clone it:

```bash
# Create directory for wire2
mkdir -p /opt/wire2
cd /opt/wire2

# Clone the repository (replace with your actual wire2 repo URL)
export GITHUB_TOKEN=your_token_here
git clone "https://a0ix:${GITHUB_TOKEN}@github.com/a0ix/pose-wire2.git" . || {
  echo "Error: Could not clone wire2 repository"
  echo "Make sure the repository exists and GITHUB_TOKEN has access"
  exit 1
}
```

### Step 3: Navigate to Backend Directory

```bash
cd /opt/wire2/backend  # or wherever wire2 is located
ls -la prisma/schema.prisma  # Verify schema exists
```

### Step 4: Install Dependencies (if needed)

```bash
cd /opt/wire2/backend
npm install
```

### Step 5: Set Environment Variables

Make sure your `.env` file has the database URL:

```bash
# Check if .env exists
cat .env | grep DATABASE_URL

# If not set, add it:
echo "DATABASE_URL=postgresql://user:password@localhost:5432/wire2" >> .env
```

### Step 6: Run Prisma Migration

```bash
cd /opt/wire2/backend

# Generate Prisma client and create migration
npx prisma migrate dev --name add_fast_wire

# Generate Prisma client
npx prisma generate
```

### Alternative: If wire2 is not deployed yet

If wire2 backend is not yet deployed to the server, you can:

1. **Option A: Run migration locally and push SQL**
   ```bash
   # On your local machine:
   cd wire2/backend
   npx prisma migrate dev --name add_fast_wire
   
   # This creates a migration in prisma/migrations/
   # You can then manually run the SQL on the server
   ```

2. **Option B: Deploy wire2 backend first**
   - Deploy the wire2 backend code to the server
   - Then run the migration on the server

### Verify Migration Success

After migration:

```bash
# Check if FastWire table exists
psql -U your_user -d wire2 -c "\dt FastWire"

# Or using Prisma Studio (if installed)
npx prisma studio
```

### Troubleshooting

**If Prisma schema not found:**
```bash
# Find where schema.prisma is
find . -name "schema.prisma" -type f

# Run with explicit schema path
npx prisma migrate dev --name add_fast_wire --schema=./prisma/schema.prisma
```

**If database connection fails:**
```bash
# Test database connection
psql $DATABASE_URL -c "SELECT 1"

# Or check .env file
cat .env | grep DATABASE_URL
```

**If migration fails due to existing data:**
```bash
# Use --create-only to create migration without applying
npx prisma migrate dev --name add_fast_wire --create-only

# Review the migration SQL, then apply manually if needed
```
