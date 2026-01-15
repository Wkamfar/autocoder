#!/usr/bin/env bash
# Test signup email sending by checking logs

set -euo pipefail

echo "=== Testing Signup Email ==="
echo ""
echo "1. Check if backend is ready:"
docker exec wire2-backend-prod curl -s http://localhost:8000/health | jq . || echo "Backend health check failed"
echo ""

echo "2. Recent email activity in logs:"
docker logs wire2-backend-prod --tail 200 | grep -i "email\|mailgun\|📧" | tail -20 || echo "No email activity found"
echo ""

echo "3. Recent signup attempts:"
docker logs wire2-backend-prod --tail 200 | grep -i "signup\|/signup" | tail -10 || echo "No signup attempts found"
echo ""

echo "4. Check for email errors:"
docker logs wire2-backend-prod --tail 200 | grep -i "email.*error\|email.*fail\|mailgun.*error" | tail -10 || echo "No email errors found"
echo ""

echo "=== To test signup email: ==="
echo "1. Try signing up at https://wire.pose.xyz/v2/signup"
echo "2. Watch logs in real-time:"
echo "   docker logs wire2-backend-prod --tail 50 -f"
echo ""
echo "3. Or check for the email log entry:"
echo "   docker logs wire2-backend-prod --tail 100 | grep '📧 EMAIL'"
