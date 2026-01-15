#!/bin/bash
# Quick test script for WIRE2 backend
# Usage: ./QUICK_TEST.sh

set -e

echo "🚀 WIRE2 Backend Quick Test"
echo "=========================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

BASE_URL="${BASE_URL:-http://localhost:3000}"
USER_ID="${USER_ID:-user_1}"

echo "Base URL: $BASE_URL"
echo "User ID: $USER_ID"
echo ""

# Check if server is running
echo "1️⃣  Checking server health..."
if curl -s -f "$BASE_URL/health" > /dev/null; then
    echo -e "${GREEN}✅ Server is running${NC}"
else
    echo -e "${RED}❌ Server is not running. Start it with: npm run dev${NC}"
    exit 1
fi

# Health check
echo ""
echo "2️⃣  Health endpoint..."
HEALTH=$(curl -s "$BASE_URL/health")
echo "$HEALTH" | jq '.' 2>/dev/null || echo "$HEALTH"

# Create intent
echo ""
echo "3️⃣  Creating intent..."
INTENT_RESPONSE=$(curl -s -X POST "$BASE_URL/api/wire/intents" \
  -H "Content-Type: application/json" \
  -H "X-USER-ID: $USER_ID" \
  -d '{
    "railsType": "WIRE",
    "amountMinor": "100000",
    "currency": "USD",
    "beneficiaryId": "beneficiary_1",
    "purpose": "Test payment"
  }')

INTENT_ID=$(echo "$INTENT_RESPONSE" | jq -r '.id' 2>/dev/null || echo "")

if [ -z "$INTENT_ID" ] || [ "$INTENT_ID" = "null" ]; then
    echo -e "${RED}❌ Failed to create intent${NC}"
    echo "$INTENT_RESPONSE"
    exit 1
fi

echo -e "${GREEN}✅ Created intent: $INTENT_ID${NC}"
echo "$INTENT_RESPONSE" | jq '.' 2>/dev/null || echo "$INTENT_RESPONSE"

# List intents
echo ""
echo "4️⃣  Listing intents..."
INTENTS=$(curl -s "$BASE_URL/api/wire/intents" -H "X-USER-ID: $USER_ID")
INTENT_COUNT=$(echo "$INTENTS" | jq '. | length' 2>/dev/null || echo "0")
echo -e "${GREEN}✅ Found $INTENT_COUNT intents${NC}"

# Get intent details
echo ""
echo "5️⃣  Getting intent details..."
INTENT_DETAILS=$(curl -s "$BASE_URL/api/wire/intents/$INTENT_ID" -H "X-USER-ID: $USER_ID")
echo "$INTENT_DETAILS" | jq '.' 2>/dev/null || echo "$INTENT_DETAILS"

# Create approval (user_2)
echo ""
echo "6️⃣  Creating approval (user_2)..."
APPROVAL_RESPONSE=$(curl -s -X POST "$BASE_URL/api/wire/intents/$INTENT_ID/decision" \
  -H "Content-Type: application/json" \
  -H "X-USER-ID: user_2" \
  -d '{"decisionType": "APPROVE"}')

APPROVAL_TOKEN=$(echo "$APPROVAL_RESPONSE" | jq -r '.approvalToken // empty' 2>/dev/null || echo "")
echo "$APPROVAL_RESPONSE" | jq '.' 2>/dev/null || echo "$APPROVAL_RESPONSE"

if [ -n "$APPROVAL_TOKEN" ] && [ "$APPROVAL_TOKEN" != "null" ]; then
    echo -e "${GREEN}✅ Got approval token${NC}"
    
    # Execute intent
    echo ""
    echo "7️⃣  Executing intent..."
    EXECUTE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/wire/intents/$INTENT_ID/execute" \
      -H "Content-Type: application/json" \
      -H "X-USER-ID: $USER_ID" \
      -d "{\"approvalToken\": \"$APPROVAL_TOKEN\"}")
    echo "$EXECUTE_RESPONSE" | jq '.' 2>/dev/null || echo "$EXECUTE_RESPONSE"
else
    echo -e "${YELLOW}⚠️  No approval token (may need more approvals)${NC}"
fi

# Generate bundle
echo ""
echo "8️⃣  Generating audit bundle..."
BUNDLE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/wire/intents/$INTENT_ID/bundle?mode=full" \
  -H "X-USER-ID: $USER_ID")

BUNDLE_ID=$(echo "$BUNDLE_RESPONSE" | jq -r '.id' 2>/dev/null || echo "")

if [ -n "$BUNDLE_ID" ] && [ "$BUNDLE_ID" != "null" ]; then
    echo -e "${GREEN}✅ Created bundle: $BUNDLE_ID${NC}"
    
    # Verify bundle
    echo ""
    echo "9️⃣  Verifying bundle signature..."
    VERIFY_RESPONSE=$(curl -s "$BASE_URL/api/wire/bundles/$BUNDLE_ID/verify")
    echo "$VERIFY_RESPONSE" | jq '.' 2>/dev/null || echo "$VERIFY_RESPONSE"
    
    if echo "$VERIFY_RESPONSE" | jq -e '.valid == true' > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Bundle signature is valid${NC}"
    else
        echo -e "${RED}❌ Bundle signature verification failed${NC}"
    fi
else
    echo -e "${RED}❌ Failed to create bundle${NC}"
    echo "$BUNDLE_RESPONSE"
fi

# Verify event chain
echo ""
echo "🔟 Verifying event chain..."
CHAIN_RESPONSE=$(curl -s "$BASE_URL/api/wire/intents/$INTENT_ID/events/verify")
echo "$CHAIN_RESPONSE" | jq '.' 2>/dev/null || echo "$CHAIN_RESPONSE"

if echo "$CHAIN_RESPONSE" | jq -e '.valid == true' > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Event chain is valid${NC}"
else
    echo -e "${RED}❌ Event chain verification failed${NC}"
fi

echo ""
echo "=========================="
echo -e "${GREEN}✅ Quick test complete!${NC}"
echo ""
echo "To test more:"
echo "  - Check LOCAL_TESTING.md for full test flow"
echo "  - Run: npm test (for unit tests)"
echo "  - Import OpenAPI spec into Postman/Insomnia"
