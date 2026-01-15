#!/bin/bash
# Debug script for beneficiary confirmation email

set -e

echo "=== Beneficiary Email Debug ==="
echo ""

# Check environment variables
echo "1. Checking email environment variables:"
if [ -f "/etc/wire2/.env.production" ]; then
  echo "   Environment file: /etc/wire2/.env.production"
  grep -E "EMAIL_PROVIDER|MAILGUN|FROM_EMAIL" /etc/wire2/.env.production | sed 's/=.*/=***/' || echo "   No email variables found"
else
  echo "   ✗ Environment file not found at /etc/wire2/.env.production"
fi
echo ""

# Check backend container environment
echo "2. Checking backend container environment:"
if docker ps --format '{{.Names}}' | grep -q "wire2-backend-prod"; then
  echo "   Backend container: wire2-backend-prod"
  docker exec wire2-backend-prod sh -c 'echo "EMAIL_PROVIDER=$EMAIL_PROVIDER"; echo "MAILGUN_DOMAIN=$MAILGUN_DOMAIN"; echo "FROM_EMAIL=$FROM_EMAIL"' 2>/dev/null || echo "   ✗ Could not read environment from container"
else
  echo "   ✗ Backend container not running"
fi
echo ""

# Check recent beneficiary creation logs
echo "3. Recent beneficiary creation activity:"
docker logs wire2-backend-prod --tail 100 2>&1 | grep -i "beneficiary\|email" | tail -20 || echo "   No recent beneficiary/email logs found"
echo ""

# Check for email errors
echo "4. Recent email errors:"
docker logs wire2-backend-prod --tail 200 2>&1 | grep -i "email.*fail\|mailgun.*error\|send.*error" | tail -10 || echo "   No email errors found"
echo ""

# Check for successful email sends
echo "5. Recent successful email sends:"
docker logs wire2-backend-prod --tail 200 2>&1 | grep -i "email.*sent\|📧 EMAIL" | tail -10 || echo "   No successful email sends found"
echo ""

# Check backend health
echo "6. Backend health:"
curl -s http://127.0.0.1:8000/api/wire/health | jq -r '.service // "Not available"' || echo "   ✗ Backend not responding"
echo ""

echo "=== To test email sending manually ==="
echo "You can test by creating a beneficiary via the API:"
echo "  curl -X POST https://wire.pose.xyz/api/wire/beneficiaries \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -H 'Cookie: session=...' \\"
echo "    -d '{\"displayName\":\"Test\",\"email\":\"your-email@example.com\",\"country\":\"US\",\"railsAllowed\":[\"ACH\"],\"bankLast4\":\"1234\"}'"
echo ""
echo "Then watch logs in real-time:"
echo "  docker logs wire2-backend-prod --tail 0 -f | grep -i email"
echo ""
