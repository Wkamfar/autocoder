# WIRE API Integration Examples

Real-world integration examples for common use cases.

## Table of Contents

1. [Complete Transfer Flow](#complete-transfer-flow)
2. [Beneficiary Management](#beneficiary-management)
3. [Policy Configuration](#policy-configuration)
4. [Error Handling](#error-handling)
5. [Webhook Integration](#webhook-integration) (Future)
6. [Batch Operations](#batch-operations) (Future)

## Complete Transfer Flow

### Step-by-Step Example

```typescript
import { ApiTestClient } from "./openapi/test-utils";

const client = new ApiTestClient(app, {
  userId: "user_123",
  orgId: "org_456",
});

// 1. Create Beneficiary
const beneficiaryResponse = await client.createBeneficiary({
  displayName: "Acme Corporation",
  country: "US",
  railsAllowed: ["ACH", "WIRE"],
  bankLast4: "1234",
  bankTokenHash: "hashed_token_abc123",
});

const beneficiaryId = beneficiaryResponse.json().id;

// 2. Create Transfer Intent
const intentResponse = await client.createIntent({
  railsType: "ACH",
  amountMinor: "50000", // $500.00
  currency: "USD",
  beneficiaryId,
  purpose: "Payment for services rendered",
});

const intentId = intentResponse.json().id;
const intent = intentResponse.json();

// 3. Check Required Challenge Level
if (intent.requiredChallengeLevel === "L1") {
  // Simple challenge
} else if (intent.requiredChallengeLevel === "L2") {
  // Medium challenge with prosody
} else {
  // L3 - Complex challenge
}

// 4. Create Voice Challenge
const challengeResponse = await client.createChallenge(intentId, {
  language: "EN",
});

const challengeId = challengeResponse.json().id;
const challenge = challengeResponse.json();

// 5. Submit Voice Proof
const proofResponse = await client.submitProof(challengeId, {
  channel: "BROWSER",
  transcript: challenge.challengeText, // User speaks this
  transcriptLanguage: "EN",
  deviceMetadataJson: {
    ip: "192.168.1.1",
    userAgent: navigator.userAgent,
    browser: "Chrome",
  },
});

const proofId = proofResponse.json().id;

// 6. Check if Approval Required
if (intent.requiredApprovals > 0) {
  // 7. Create Approval Decision
  const decisionResponse = await client.createDecision(intentId, {
    action: "APPROVE",
    proofId,
    reasonCodesJson: ["low_risk", "domestic_transfer"],
  });

  const decision = decisionResponse.json();
  
  // 8. Check if Approval Token Issued
  if (decision.approvalToken) {
    // Threshold met, can execute
    const approvalToken = decision.approvalToken;
    
    // 9. Execute Intent
    const executeResponse = await client.executeIntent(
      intentId,
      approvalToken
    );
    
    console.log("Transfer executed:", executeResponse.json());
  } else {
    // Need more approvals
    console.log(`Need ${intent.requiredApprovals} approvals, have ${decision.approvalTokenHash ? 1 : 0}`);
  }
}

// 10. Generate Audit Bundle
const bundleResponse = await client.generateAuditBundle(intentId);
const bundle = bundleResponse.json();
console.log("Audit bundle:", bundle.bundleHash);
```

## Beneficiary Management

### Create and Verify Beneficiary

```typescript
// Create beneficiary
const beneficiary = await client.createBeneficiary({
  displayName: "Vendor Corp",
  country: "US",
  railsAllowed: ["ACH"],
  bankLast4: "5678",
  bankTokenHash: "encrypted_token_hash",
});

// Verify beneficiary was created
const listResponse = await client.listBeneficiaries();
const beneficiaries = listResponse.json();
const createdBeneficiary = beneficiaries.find(
  (b: any) => b.id === beneficiary.json().id
);

console.log("Beneficiary verified:", createdBeneficiary);
```

### Update Beneficiary Status

```typescript
// Lock beneficiary
await client.updateBeneficiary(beneficiaryId, {
  status: "LOCKED",
});

// Verify status change
const updated = await client.getBeneficiary(beneficiaryId);
console.log("Status:", updated.json().status); // "LOCKED"
```

## Policy Configuration

### Configure Risk Policy

```typescript
// Create policy version
const policy = await client.createPolicyVersion({
  policyId: "policy_acme_v1",
  thresholds: {
    amountStepUpMinor: "100000", // $1,000
    dualApprovalRiskScore: 60,
    criticalRiskScore: 85,
    newBeneficiaryDays: 30,
    outOfHoursStartHourLocal: 18, // 6 PM
    outOfHoursEndHourLocal: 9, // 9 AM
  },
  rules: {
    requireDualApprovalForInternationalWire: true,
    requirePhoneForL3IfMicDenied: true,
    cooldownMinutesForHighRisk: 15,
    lockoutAfterFailedAttempts: 3,
  },
});

console.log("Policy created:", policy.json().version);
```

### Simulate Risk Before Creating Intent

```typescript
// Simulate risk scoring
const simulation = await client.simulatePolicy({
  railsType: "WIRE",
  amountMinor: "1000000", // $10,000
  beneficiaryId,
});

const result = simulation.json();
console.log("Risk Score:", result.riskScore);
console.log("Required Approvals:", result.requiredApprovals);
console.log("Required Challenge Level:", result.requiredChallengeLevel);

// Use results to inform user
if (result.riskScore > 85) {
  console.warn("High risk transfer - dual approval required");
}
```

## Error Handling

### Comprehensive Error Handling

```typescript
async function createIntentSafely(data: CreateIntentRequest) {
  try {
    const response = await client.createIntent(data);
    
    if (response.statusCode === 201) {
      return { success: true, data: response.json() };
    }
    
    // Handle specific error codes
    const error = response.json();
    
    switch (error.code) {
      case "BENEFICIARY_NOT_FOUND":
        return {
          success: false,
          error: "Beneficiary not found. Please create beneficiary first.",
          code: error.code,
        };
        
      case "POLICY_NOT_CONFIGURED":
        return {
          success: false,
          error: "Policy not configured. Please contact administrator.",
          code: error.code,
        };
        
      case "INVALID_REQUEST":
        return {
          success: false,
          error: error.error,
          code: error.code,
          details: error.details,
        };
        
      default:
        return {
          success: false,
          error: "Unknown error occurred",
          code: "UNKNOWN_ERROR",
        };
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Network error",
      code: "NETWORK_ERROR",
    };
  }
}

// Usage
const result = await createIntentSafely({
  railsType: "ACH",
  amountMinor: "50000",
  beneficiaryId: "benef_123",
  purpose: "Payment",
});

if (!result.success) {
  // Display error to user
  console.error(result.error);
  // Handle specific error codes
  if (result.code === "BENEFICIARY_NOT_FOUND") {
    // Redirect to beneficiary creation
  }
}
```

### Retry Logic for Transient Errors

```typescript
async function executeIntentWithRetry(
  intentId: string,
  approvalToken: string,
  maxRetries = 3
) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const response = await client.executeIntent(intentId, approvalToken);
    
    if (response.statusCode === 200) {
      return { success: true, data: response.json() };
    }
    
    const error = response.json();
    
    // Don't retry on client errors
    if (response.statusCode < 500) {
      return { success: false, error };
    }
    
    // Retry on server errors
    if (attempt < maxRetries) {
      const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
      await new Promise((resolve) => setTimeout(resolve, delay));
      continue;
    }
    
    return { success: false, error };
  }
}
```

## Event Monitoring

### Monitor Intent Status Changes

```typescript
async function monitorIntentStatus(intentId: string) {
  const checkInterval = 5000; // 5 seconds
  
  const interval = setInterval(async () => {
    const response = await client.getIntent(intentId);
    const intent = response.json();
    
    console.log(`Intent ${intentId} status: ${intent.status}`);
    
    // Check for terminal states
    if (["EXECUTED", "DENIED", "CANCELED", "EXPIRED"].includes(intent.status)) {
      clearInterval(interval);
      console.log(`Intent ${intentId} reached terminal state: ${intent.status}`);
    }
  }, checkInterval);
  
  return interval;
}

// Usage
const monitor = await monitorIntentStatus(intentId);
// Later: clearInterval(monitor);
```

### Get Event History

```typescript
async function getIntentHistory(intentId: string) {
  const response = await client.listIntentEvents(intentId);
  const events = response.json();
  
  // Group events by type
  const eventsByType = events.reduce((acc: any, event: any) => {
    if (!acc[event.eventType]) {
      acc[event.eventType] = [];
    }
    acc[event.eventType].push(event);
    return acc;
  }, {});
  
  return {
    total: events.length,
    byType: eventsByType,
    timeline: events.map((e: any) => ({
      seq: e.seq,
      type: e.eventType,
      timestamp: e.createdAt,
      user: e.createdByUserId,
    })),
  };
}
```

## Best Practices

### 1. Always Check Response Status

```typescript
const response = await client.createIntent(data);
if (response.statusCode !== 201) {
  // Handle error
  return;
}
// Process success
```

### 2. Extract IDs Immediately

```typescript
const intentResponse = await client.createIntent(data);
const intentId = intentResponse.json().id; // Extract immediately
// Use intentId for subsequent operations
```

### 3. Handle Approval Token Carefully

```typescript
const decisionResponse = await client.createDecision(intentId, decisionData);
const approvalToken = decisionResponse.json().approvalToken;

if (approvalToken) {
  // Token is returned exactly once - store it securely
  // Use it immediately for execution
  await client.executeIntent(intentId, approvalToken);
}
```

### 4. Validate Before Creating

```typescript
// Simulate before creating
const simulation = await client.simulatePolicy({
  railsType: "WIRE",
  amountMinor: "1000000",
  beneficiaryId,
});

if (simulation.json().riskScore > 85) {
  // Warn user about high risk
  // Require additional approvals
}
```

### 5. Monitor Event Chain

```typescript
// After any operation, check events
const events = await client.listIntentEvents(intentId);
const lastEvent = events.json()[events.json().length - 1];
console.log("Last event:", lastEvent.eventType);
```

## Future Examples

### Webhook Integration (Planned)

```typescript
// Register webhook for intent status changes
await client.registerWebhook({
  url: "https://your-app.com/webhooks/intent-status",
  events: ["intent.executed", "intent.denied"],
});
```

### Batch Operations (Planned)

```typescript
// Create multiple beneficiaries
await client.createBeneficiariesBatch([
  { displayName: "Vendor 1", ... },
  { displayName: "Vendor 2", ... },
]);
```
