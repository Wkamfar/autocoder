# Production Ready Checklist

## Current Status

### ✅ Completed
1. **Frontend API Client** - Real API client created with mock/real toggle
2. **Backend Running** - Server on port 3000
3. **Database Seeded** - Users and beneficiaries seeded
4. **Frontend Running** - Dev server on port 5173

### 🔧 In Progress
1. **Authentication Fix** - `req.user` is undefined in route handlers
   - Issue: Auth hook runs but `req.user` not set before route handler executes
   - Debugging: Added logging to trace auth flow

### ⏳ Pending
1. **API Endpoints** - Test all endpoints with real data
2. **Frontend Integration** - Verify frontend displays backend data
3. **Production Config** - Environment variables and deployment setup

## Seeded Data

### Users
- `user_alice_smith` - Alice Smith (TREASURY_INITIATOR)
- `user_bob_jones` - Bob Jones (APPROVER)
- `user_carol_white` - Carol White (APPROVER)
- `user_admin` - Admin User (ADMIN)

### Beneficiaries
- `benef_vendor_abc` - Vendor ABC (US, ACH/WIRE)
- `benef_contractor_xyz` - Contractor XYZ (US, ACH)
- `benef_international_partner` - International Partner Ltd (GB, WIRE)
- `benef_recently_changed` - Recently Changed Vendor (US, ACH)

## Configuration

### Backend (.env)
```bash
AUTH_MODE=demo
DATABASE_URL=postgresql://wire2_user:wire2_pass@localhost:5432/wire2
SIGNING_PRIVATE_KEY=<32-byte base64url>
```

### Frontend (.env.local)
```bash
VITE_API_MODE=real
VITE_API_BASE_URL=http://localhost:3000
VITE_DEMO_USER_ID=user_alice_smith
VITE_AUTH_MODE=demo
```

## Next Steps

1. Fix authentication middleware
2. Test API endpoints
3. Verify frontend displays data
4. Create production deployment config
