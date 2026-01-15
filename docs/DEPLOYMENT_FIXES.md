# Deployment Fixes Required

## Critical Fixes for Production

### 1. Nginx SPA Routing Fix
**Issue:** Deep routes serve nginx default page instead of SPA

**Fix:** Deploy updated nginx configuration

**Steps on Droplet:**
```bash
cd /opt/wire2
git pull origin main
./scripts/deploy_prod_droplet.sh
```

The deployment script will:
- Update nginx config with proper SPA routing
- Reload nginx

**Verification:**
```bash
# Test nginx config
nginx -t

# Check if deep routes work
curl -I https://wire.pose.xyz/v2/intents/intent_standard_ach
# Should return 200, not nginx default page
```

### 2. Admin User Permissions Fix
**Issue:** Admin user missing `admin:view` permission

**Fix:** Re-run database seed or update admin user permissions

**Steps on Droplet:**
```bash
cd /opt/wire2/backend
# Option 1: Re-run seed (if safe to do so)
docker compose run --rm wire-migrate
npm run seed

# Option 2: Update admin user directly in database
docker compose exec postgres psql -U wire2 -d wire2 -c "
UPDATE \"User\" 
SET permissions = array_append(permissions, 'admin:view')
WHERE email = 'admin@acme.com' AND NOT ('admin:view' = ANY(permissions));
"
```

**Verification:**
```bash
# Check admin user permissions
docker compose exec postgres psql -U wire2 -d wire2 -c "
SELECT email, permissions FROM \"User\" WHERE email = 'admin@acme.com';
"
# Should show 'admin:view' in permissions array
```

## Testing After Deployment

1. Test deep route navigation:
   - Navigate to https://wire.pose.xyz/v2/intents/intent_standard_ach
   - Should show intent detail page, not nginx default

2. Test admin dashboard:
   - Navigate to https://wire.pose.xyz/v2/admin
   - Should show admin dashboard, not permission error

3. Test all major pages:
   - /v2/intents
   - /v2/approvals
   - /v2/beneficiaries
   - /v2/requests
   - /v2/compliance
   - /v2/settings

## Rollback Plan

If issues occur:
```bash
# Restore previous nginx config
cp /etc/nginx/sites-available/wire.pose.xyz.backup.* /etc/nginx/sites-available/wire.pose.xyz
nginx -t && systemctl reload nginx
```
