# Quick Deploy - Beneficiary Email Confirmation

## What's New

✅ **Email confirmation for beneficiaries**
- Beneficiaries receive email when created
- Public confirmation page (no login needed)
- Voice proof + account details collection

✅ **Real intelligence data**
- Intelligence page shows actual transfer metrics
- No more hardcoded $12,500,000
- Updates automatically as transfers are made

## Deploy to Droplet

```bash
# SSH to droplet
ssh root@<droplet-ip>

# Navigate to wire2 directory
cd /opt/wire2

# Pull latest code
git pull origin main

# Run deployment script (handles migration automatically)
bash scripts/deploy_prod_droplet.sh
```

The deployment script will:
1. Pull latest code
2. Run database migration (adds email/confirmation fields)
3. Rebuild and restart backend
4. Rebuild and restart frontend
5. Reload Nginx

## Verify Deployment

### 1. Check Migration
```bash
docker logs wire2-migrate-prod --tail 50
# Should see: "20260115000000_add_beneficiary_email_confirmation" applied
```

### 2. Test Beneficiary Creation
1. Go to https://wire.pose.xyz/v2/beneficiaries
2. Click "Add Beneficiary"
3. Fill form including **email address**
4. Submit
5. Check email inbox for confirmation link

### 3. Test Confirmation Flow
1. Click link in email
2. Should see confirmation page at `/v2/beneficiaries/confirm?token=...`
3. Enter account details
4. Record voice proof (optional)
5. Submit
6. Should see success message

### 4. Test Intelligence Page
1. Go to beneficiary detail page
2. Should see real data (or zeros if no transfers yet)
3. Create and execute an intent to that beneficiary
4. Refresh intelligence page
5. Should see updated metrics from actual transfer

## Troubleshooting

### Migration Fails
```bash
# Check migration status
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm wire-migrate npx prisma migrate status

# If needed, manually run migration
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm wire-migrate
```

### Email Not Sending
```bash
# Check email config
docker exec wire2-backend-prod env | grep EMAIL

# Check backend logs
docker logs wire2-backend-prod --tail 100 | grep -i email
```

### Frontend Not Updating
```bash
# Rebuild frontend
cd /opt/wire2/frontend
docker build -t wire2-frontend:latest .
docker rm -f wire2-frontend-prod
docker run -d \
  --name wire2-frontend-prod \
  --network wire2-network-prod \
  -p 8080:80 \
  -v /opt/wire2/frontend/dist-wire:/usr/share/nginx/html:ro \
  wire2-frontend:latest

# Reload Nginx
sudo systemctl reload nginx
```

## Files Changed

- `backend/prisma/schema.prisma` - Added email/confirmation fields
- `backend/prisma/migrations/20260115000000_add_beneficiary_email_confirmation/` - Migration
- `backend/src/modules/beneficiaries/beneficiaryService.ts` - Email confirmation logic
- `backend/src/routes/public.ts` - Public confirmation endpoints
- `backend/src/routes/wire.ts` - Intelligence endpoint
- `frontend/src/wire/components/WireBeneficiaryForm.tsx` - Added email field
- `frontend/src/wire/pages/WireBeneficiaryConfirmPage.tsx` - New confirmation page
- `frontend/src/wire/pages/WireBeneficiaryIntelligencePage.tsx` - Real data from API
- `frontend/src/main-wire.tsx` - Added confirmation route
