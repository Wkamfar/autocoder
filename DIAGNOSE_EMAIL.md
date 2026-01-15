# Diagnose Email Configuration Issue

## The Problem

You already have Mailgun configured and the test email endpoint works, but signup emails aren't being sent.

## Quick Diagnosis

On the droplet, run:

```bash
cd /opt/wire2
bash scripts/check-email-config.sh
```

This will show:
1. What email variables are in `/etc/wire2/.env.production`
2. What email variables the backend container actually sees
3. How to test email sending

## Common Issues

### Issue 1: Environment Variables Not Loaded

If the backend container doesn't see `EMAIL_PROVIDER` or `MAILGUN_*` variables:

1. **Check the source file:**
   ```bash
   grep EMAIL /etc/wire2/.env.production
   ```

2. **Verify it's copied to the working directory:**
   ```bash
   grep EMAIL /opt/wire2/.env.production
   ```

3. **Restart the backend to reload environment:**
   ```bash
   cd /opt/wire2
   docker compose --env-file .env.production -f docker-compose.prod.yml restart wire2-backend-prod
   ```

### Issue 2: Backend Using Old Environment

The backend container might have been started before the email config was added:

```bash
# Stop and recreate the backend container
cd /opt/wire2
docker compose --env-file .env.production -f docker-compose.prod.yml down wire-backend
docker compose --env-file .env.production -f docker-compose.prod.yml up -d wire-backend
```

### Issue 3: Email Provider Set to Console

Check if `EMAIL_PROVIDER` is set to `console`:

```bash
docker exec wire2-backend-prod env | grep EMAIL_PROVIDER
```

If it shows `EMAIL_PROVIDER=console` or nothing, the email config isn't loaded. Fix by:

1. Adding to `/etc/wire2/.env.production`:
   ```bash
   EMAIL_PROVIDER=mailgun
   MAILGUN_API_KEY=your_key_here
   MAILGUN_DOMAIN=your_domain.mailgun.org
   ```

2. Restarting backend:
   ```bash
   cd /opt/wire2
   docker compose --env-file .env.production -f docker-compose.prod.yml restart wire2-backend-prod
   ```

## Test Email Sending

### Option 1: Use Admin Test Endpoint

If you're logged in as admin:

```bash
curl -X POST https://wire.pose.xyz/api/wire/admin/test-email \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  -d '{"to": "your-email@example.com", "name": "Test"}'
```

### Option 2: Check Backend Logs

```bash
# Watch for email activity
docker logs wire2-backend-prod --tail 100 -f | grep -i email

# Or check for console mode emails
docker logs wire2-backend-prod --tail 100 | grep "📧 EMAIL"
```

### Option 3: Try Signup Again

After verifying the configuration, try signing up again. Check logs:

```bash
docker logs wire2-backend-prod --tail 50 -f
```

## Verify Mailgun Keys

If you have the Mailgun keys but they're not working:

1. **Check Mailgun dashboard:**
   - Go to https://app.mailgun.com/
   - Verify the API key is active
   - Check domain status (should be verified)

2. **Test Mailgun API directly:**
   ```bash
   # Replace with your actual key and domain
   curl -s --user 'api:YOUR_MAILGUN_API_KEY' \
     https://api.mailgun.net/v3/YOUR_DOMAIN/messages \
     -F from='noreply@wire.pose.xyz' \
     -F to='test@example.com' \
     -F subject='Test' \
     -F text='Test email'
   ```

## Fix Checklist

- [ ] Email variables exist in `/etc/wire2/.env.production`
- [ ] Email variables are copied to `/opt/wire2/.env.production`
- [ ] Backend container sees the email variables (`docker exec wire2-backend-prod env | grep EMAIL`)
- [ ] `EMAIL_PROVIDER` is set to `mailgun` (not `console`)
- [ ] Mailgun API key and domain are correct
- [ ] Backend container was restarted after adding email config
- [ ] Test email endpoint works (`/admin/test-email`)
- [ ] Signup emails are sent (check logs)
