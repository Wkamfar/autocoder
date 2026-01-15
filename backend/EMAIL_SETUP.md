# Email Configuration for Wire2

Wire2 requires email configuration to send:
- Signup confirmation emails
- Password reset emails
- Intent approval requests
- Intent execution notifications

## Current Status

By default, Wire2 uses **"console" mode** which only logs emails to the console and doesn't actually send them. This is why you're not receiving signup verification emails.

## Quick Check

On the droplet, check your email configuration:

```bash
cd /opt/wire2
grep EMAIL_PROVIDER .env.production || echo "EMAIL_PROVIDER not set (defaults to console)"
```

## Email Provider Options

Wire2 supports multiple email providers:

### Option 1: Mailgun (Recommended for Production)

1. Sign up at https://www.mailgun.com/
2. Get your API key and domain
3. Add to `/etc/wire2/.env.production`:

```bash
EMAIL_PROVIDER=mailgun
MAILGUN_API_KEY=your_api_key_here
MAILGUN_DOMAIN=your_domain.mailgun.org  # or your verified domain
FROM_EMAIL=noreply@wire.pose.xyz  # optional
FROM_NAME=WIRE  # optional
```

### Option 2: SendGrid

1. Sign up at https://sendgrid.com/
2. Create an API key
3. Add to `/etc/wire2/.env.production`:

```bash
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=your_api_key_here
FROM_EMAIL=noreply@wire.pose.xyz  # optional
FROM_NAME=WIRE  # optional
```

### Option 3: AWS SES

1. Set up AWS SES
2. Add to `/etc/wire2/.env.production`:

```bash
EMAIL_PROVIDER=ses
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
FROM_EMAIL=noreply@wire.pose.xyz
```

### Option 4: SMTP (Not Yet Implemented)

SMTP support is planned but not yet implemented.

## Async Email (Optional)

To send emails via background jobs (recommended for production):

```bash
EMAIL_ASYNC=true
REDIS_URL=redis://localhost:6379  # Required for async emails
```

## After Configuration

1. Update `/etc/wire2/.env.production` with your email provider settings
2. Restart the backend:

```bash
cd /opt/wire2
docker compose --env-file .env.production -f docker-compose.prod.yml restart wire2-backend-prod
```

3. Check backend logs to verify email sending:

```bash
docker logs wire2-backend-prod --tail 50 | grep -i email
```

## Testing

After configuration, try signing up again. You should receive the verification email.

To check if emails are being sent (even in console mode), check the backend logs:

```bash
docker logs wire2-backend-prod --tail 100 | grep "📧 EMAIL"
```

## Troubleshooting

### Emails not sending

1. **Check provider configuration:**
   ```bash
   docker exec wire2-backend-prod env | grep EMAIL
   ```

2. **Check backend logs for errors:**
   ```bash
   docker logs wire2-backend-prod --tail 100 | grep -i "email\|mail"
   ```

3. **Verify API keys are correct:**
   - Mailgun: Check API key in Mailgun dashboard
   - SendGrid: Verify API key has "Mail Send" permissions

4. **Check if async mode is enabled:**
   ```bash
   docker exec wire2-backend-prod env | grep EMAIL_ASYNC
   ```
   If `EMAIL_ASYNC=true`, check worker logs:
   ```bash
   docker logs wire2-worker-prod --tail 50
   ```

### Console Mode (Development)

If `EMAIL_PROVIDER=console` or not set, emails are only logged. Check logs:

```bash
docker logs wire2-backend-prod | grep "📧 EMAIL"
```

You'll see the email content in the logs, but no actual email is sent.
