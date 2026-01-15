# Deploy Beneficiary Email Confirmation Feature

## Summary

This deployment adds email-based beneficiary confirmation:
- Beneficiaries receive email when created
- They click link to confirm account (no login required)
- They enter account details and record voice proof
- Intelligence page now shows real data from actual transfers

## Changes Made

### Database
- Added `email`, `confirmationToken`, `confirmationTokenExpiresAt`, `confirmedAt` to Beneficiary model
- Migration: `20260115000000_add_beneficiary_email_confirmation`

### Backend
- Updated `createBeneficiary` to accept email and generate confirmation token
- Added email sending when beneficiary is created
- Added public routes: `GET/POST /api/beneficiaries/confirm`
- Added intelligence endpoint: `GET /api/wire/beneficiaries/:id/intelligence` (real data from intents)

### Frontend
- Added email field to beneficiary form
- Created `WireBeneficiaryConfirmPage` for public confirmation
- Updated intelligence page to fetch real data from API
- Added route: `/v2/beneficiaries/confirm`

## Deployment Steps

### 1. On Local Machine

```bash
cd /Users/lmnop/Desktop/wire2-clean
git add -A
git commit -m "Add beneficiary email confirmation and real intelligence data"
git push origin main
```

### 2. On Droplet

```bash
cd /opt/wire2
git pull origin main

# Run database migration
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm wire-migrate

# Rebuild and restart backend
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build wire-backend

# Rebuild and restart frontend
cd frontend
docker build -t wire2-frontend:latest .
docker rm -f wire2-frontend-prod || true
docker run -d \
  --name wire2-frontend-prod \
  --network wire2-network-prod \
  -p 8080:80 \
  -v /opt/wire2/frontend/dist-wire:/usr/share/nginx/html:ro \
  wire2-frontend:latest

# Restart Nginx
sudo systemctl reload nginx
```

### 3. Verify

1. **Test beneficiary creation with email:**
   - Go to https://wire.pose.xyz/v2/beneficiaries
   - Click "Add Beneficiary"
   - Fill form including email
   - Check that email is sent (check backend logs)

2. **Test confirmation flow:**
   - Click link in email
   - Should see confirmation page
   - Enter account details
   - Record voice proof (optional)
   - Submit
   - Should see success message

3. **Test intelligence page:**
   - Go to beneficiary detail page
   - Should see real data (or zeros if no transfers yet)
   - Create and execute an intent to that beneficiary
   - Refresh intelligence page
   - Should see updated metrics

## Migration Notes

The migration adds nullable columns, so it's safe to run on existing data. Existing beneficiaries will have:
- `email = null`
- `confirmationToken = null`
- `status = ACTIVE` (if they were already active)

## Troubleshooting

### Email not sending
- Check `EMAIL_PROVIDER` is set in `/etc/wire2/.env.production`
- Check backend logs: `docker logs wire2-backend-prod --tail 100 | grep email`
- Verify Mailgun/SendGrid credentials

### Confirmation link not working
- Check token is in URL: `?token=...`
- Check backend logs for errors
- Verify migration ran successfully

### Intelligence shows zeros
- This is normal for new beneficiaries with no transfers
- Create and execute an intent to see real data
- Check backend logs: `docker logs wire2-backend-prod --tail 100 | grep intelligence`
