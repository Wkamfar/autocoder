#!/usr/bin/env bash
# Debug signup email issue

set -euo pipefail

echo "=== Signup Email Debug ==="
echo ""

echo "1. Check EMAIL_ASYNC setting:"
docker exec wire2-backend-prod env | grep EMAIL_ASYNC || echo "EMAIL_ASYNC not set (defaults to false)"
echo ""

echo "2. Check if worker is running (needed if EMAIL_ASYNC=true):"
docker ps --format '{{.Names}}' | grep wire2-worker-prod && echo "✓ Worker is running" || echo "✗ Worker is NOT running"
echo ""

echo "3. Full signup log entry (last signup attempt):"
docker logs wire2-backend-prod --tail 500 | grep -A 20 "POST.*signup" | tail -30
echo ""

echo "4. Check for email delivery warnings:"
docker logs wire2-backend-prod --tail 500 | grep -i "signup.*email\|email.*delivery\|email.*fail" | tail -10
echo ""

echo "5. Check worker logs for queued emails (if EMAIL_ASYNC=true):"
if docker ps --format '{{.Names}}' | grep -q wire2-worker-prod; then
  docker logs wire2-worker-prod --tail 100 | grep -i "email\|mailgun" | tail -10 || echo "No email activity in worker logs"
else
  echo "Worker not running - skip worker logs"
fi
echo ""

echo "6. Try a test signup and watch logs:"
echo "   Run this in another terminal:"
echo "   docker logs wire2-backend-prod --tail 0 -f"
echo ""
echo "   Then sign up at https://wire.pose.xyz/v2/signup"
echo "   Look for:"
echo "   - '[signup] email delivery failed:'"
echo "   - Mailgun API calls"
echo "   - Email send errors"
