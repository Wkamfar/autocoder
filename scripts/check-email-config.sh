#!/usr/bin/env bash
# Check email configuration on the droplet

set -euo pipefail

echo "=== Email Configuration Check ==="
echo ""

# Check environment file
ENV_FILE="${ENV_FILE:-/etc/wire2/.env.production}"
if [[ -f "$ENV_FILE" ]]; then
  echo "✓ Environment file exists: $ENV_FILE"
  echo ""
  echo "Email-related variables:"
  grep -E "EMAIL|MAILGUN|SENDGRID" "$ENV_FILE" | sed 's/=.*/=***/' || echo "  (none found)"
else
  echo "✗ Environment file not found: $ENV_FILE"
fi

echo ""
echo "=== Backend Container Environment ==="
if docker ps --format '{{.Names}}' | grep -q wire2-backend-prod; then
  echo "✓ Backend container is running"
  echo ""
  echo "Email-related environment variables in container:"
  docker exec wire2-backend-prod env | grep -E "EMAIL|MAILGUN|SENDGRID" | sed 's/=.*/=***/' || echo "  (none found)"
else
  echo "✗ Backend container is not running"
fi

echo ""
echo "=== Test Email Endpoint ==="
echo "To test email sending, use the admin endpoint:"
echo "  POST /api/wire/admin/test-email"
echo "  Body: { \"to\": \"your-email@example.com\", \"name\": \"Test User\" }"
echo ""
echo "Or check backend logs for email activity:"
echo "  docker logs wire2-backend-prod --tail 100 | grep -i email"
