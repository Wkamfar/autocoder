#!/bin/bash
# Quick DNS check script for wire.pose.xyz

DOMAIN="wire.pose.xyz"
EXPECTED_IP="165.227.68.201"

echo "🔍 Checking DNS for $DOMAIN..."
echo ""

# Try dig first
if command -v dig &> /dev/null; then
    RESOLVED_IP=$(dig +short $DOMAIN | head -n1)
    echo "DNS Resolution (dig): $RESOLVED_IP"
elif command -v host &> /dev/null; then
    RESOLVED_IP=$(host $DOMAIN | grep "has address" | awk '{print $4}' | head -n1)
    echo "DNS Resolution (host): $RESOLVED_IP"
elif command -v nslookup &> /dev/null; then
    RESOLVED_IP=$(nslookup $DOMAIN | grep "Address:" | tail -n1 | awk '{print $2}')
    echo "DNS Resolution (nslookup): $RESOLVED_IP"
else
    echo "❌ No DNS tools found. Install dig, host, or nslookup"
    exit 1
fi

echo ""

if [ "$RESOLVED_IP" == "$EXPECTED_IP" ]; then
    echo "✅ DNS is correct!"
    echo "   $DOMAIN → $RESOLVED_IP"
    echo ""
    echo "✅ Ready to deploy WIREv2!"
    exit 0
else
    echo "❌ DNS not ready yet"
    echo "   Expected: $EXPECTED_IP"
    echo "   Got:      $RESOLVED_IP"
    echo ""
    echo "📝 Actions:"
    echo "   1. Add A record: wire → 165.227.68.201 in your DNS provider"
    echo "   2. Wait 5-30 minutes for propagation"
    echo "   3. Run this script again: ./check-dns.sh"
    exit 1
fi
