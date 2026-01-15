# Quick Fix: Enable Email Sending

## Problem
Signup verification emails are not being sent because email provider is not configured (defaults to "console" mode).

## Quick Fix on Droplet

### Step 1: Check Current Configuration

```bash
cd /opt/wire2
grep EMAIL .env.production || echo "No email config found"
```

### Step 2: Configure Email Provider

Choose one:

#### Option A: Mailgun (Easiest to start)

1. Sign up at https://www.mailgun.com/ (free tier available)
2. Get your API key and domain from the dashboard
3. Add to `/etc/wire2/.env.production`:

```bash
echo "EMAIL_PROVIDER=mailgun" >> /etc/wire2/.env.production
echo "MAILGUN_API_KEY=your_key_here" >> /etc/wire2/.env.production
echo "MAILGUN_DOMAIN=your_domain.mailgun.org" >> /etc/wire2/.env.production
echo "FROM_EMAIL=noreply@wire.pose.xyz" >> /etc/wire2/.env.production
```

#### Option B: SendGrid

1. Sign up at https://sendgrid.com/ (free tier available)
2. Create an API key with "Mail Send" permissions
3. Add to `/etc/wire2/.env.production`:

```bash
echo "EMAIL_PROVIDER=sendgrid" >> /etc/wire2/.env.production
echo "SENDGRID_API_KEY=your_key_here" >> /etc/wire2/.env.production
echo "FROM_EMAIL=noreply@wire.pose.xyz" >> /etc/wire2/.env.production
```

### Step 3: Restart Backend

```bash
cd /opt/wire2
docker compose --env-file .env.production -f docker-compose.prod.yml restart wire2-backend-prod
```

### Step 4: Verify

```bash
# Check if email provider is loaded
docker exec wire2-backend-prod env | grep EMAIL_PROVIDER

# Try signing up again - you should receive the email
```

## For Development/Testing

If you just want to see emails in logs (not actually send them):

```bash
# Email will be logged to console
docker logs wire2-backend-prod --tail 50 | grep "📧 EMAIL"
```

## See Also

- `backend/EMAIL_SETUP.md` - Complete email configuration guide
- `backend/ENV_VARIABLES.md` - All environment variables
