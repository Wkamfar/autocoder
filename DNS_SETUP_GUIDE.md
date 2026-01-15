# DNS Setup Guide for wire.pose.xyz

## Quick Answer: YES, Setup DNS First! ✅

You should configure DNS **before** deploying WIREv2 because:
1. SSL certificate (Let's Encrypt) requires DNS to be working
2. Frontend environment variables need the domain URL
3. Backend CORS configuration needs the domain

## DNS Configuration Steps

### Step 1: Identify Your DNS Provider

Where is `pose.xyz` domain managed?
- GoDaddy
- Namecheap
- Cloudflare
- AWS Route53
- DigitalOcean DNS
- Other registrar

### Step 2: Add A Record

Add an **A record** pointing to your pose core droplet IP:

```
Type: A
Name: wire
Value: a	wire	165.227.68.201	600 seconds		

TTL: 300 (or default, 3600)
```

This will make `wire.pose.xyz` resolve to `165.227.68.201`

### Step 3: Verify DNS Propagation

After adding the record, verify it's working:

```bash
# Check if DNS is resolving
dig wire.pose.xyz +short
# Should return: 165.227.68.201

# Or use nslookup
nslookup wire.pose.xyz
# Should return: 165.227.68.201

# Or use host command
host wire.pose.xyz
# Should return: wire.pose.xyz has address 165.227.68.201
```

**DNS propagation** can take a few minutes to 48 hours, but usually works within 5-30 minutes.

## Detailed Instructions by Provider

### Cloudflare

1. Log in to Cloudflare dashboard
2. Select your `pose.xyz` domain
3. Go to **DNS** → **Records**
4. Click **Add record**
5. Configure:
   - **Type**: A
   - **Name**: `wire`
   - **IPv4 address**: `165.227.68.201`
   - **Proxy status**: DNS only (gray cloud) - Don't proxy for now
   - **TTL**: Auto
6. Click **Save**

**Note**: If using Cloudflare proxy (orange cloud), you'll need to configure SSL differently.

### GoDaddy

1. Log in to GoDaddy account
2. Go to **My Products** → **Domains**
3. Click **DNS** next to `pose.xyz`
4. Scroll to **Records** section
5. Click **Add** → **A**
6. Configure:
   - **Host**: `wire`
   - **Points to**: `165.227.68.201`
   - **TTL**: 600 seconds (or default)
7. Click **Save**

### Namecheap

1. Log in to Namecheap
2. Go to **Domain List**
3. Click **Manage** next to `pose.xyz`
4. Go to **Advanced DNS** tab
5. Under **Host Records**, click **Add New Record**
6. Configure:
   - **Type**: A Record
   - **Host**: `wire`
   - **Value**: `165.227.68.201`
   - **TTL**: Automatic (or 300)
7. Click **Save** (green checkmark)

### DigitalOcean

1. Log in to DigitalOcean
2. Go to **Networking** → **Domains**
3. Select `pose.xyz` (or add it if not there)
4. Click **Add Record**
5. Configure:
   - **Type**: A
   - **Hostname**: `wire`
   - **Will direct to**: `165.227.68.201`
6. Click **Create Record**

### AWS Route53

1. Log in to AWS Console
2. Go to **Route53** → **Hosted zones**
3. Select `pose.xyz` hosted zone
4. Click **Create record**
5. Configure:
   - **Record name**: `wire`
   - **Record type**: A
   - **Value**: `165.227.68.201`
   - **TTL**: 300
6. Click **Create records**

## Verification Steps

### 1. Check DNS Resolution

```bash
# From your local machine
dig wire.pose.xyz

# Should show:
# wire.pose.xyz.    IN    A    165.227.68.201

# Or use online tool:
# https://dnschecker.org/#A/wire.pose.xyz
```

### 2. Check HTTP Access (Before SSL)

Once DNS propagates, you should be able to access:

```bash
# This will fail with SSL error, but shows DNS is working
curl -I http://wire.pose.xyz

# Or check from server
curl -H "Host: wire.pose.xyz" http://localhost
```

### 3. Test from Browser

Open `http://wire.pose.xyz` in browser (will redirect to HTTPS or show connection, even if site isn't ready yet).

## DNS Record Examples

Your DNS zone should have something like:

```
pose.xyz.              A     165.227.68.201    (root domain, optional)
www.pose.xyz.          A     165.227.68.201    (www subdomain, optional)
api.testnet.pose.xyz.  A     165.227.68.201    (existing pose core)
wire.pose.xyz.         A     165.227.68.201    (NEW - for WIREv2)
```

## Common Issues

### DNS Not Resolving

**Problem**: `dig wire.pose.xyz` returns nothing or wrong IP

**Solutions**:
1. Wait 5-30 minutes for propagation
2. Check record was saved correctly in DNS provider
3. Clear local DNS cache:
   ```bash
   # macOS
   sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder
   
   # Linux
   sudo systemd-resolve --flush-caches
   ```

### Wrong IP Address

**Problem**: DNS resolves to wrong IP

**Solution**: Update A record in DNS provider to `165.227.68.201`

### DNS Works But Site Doesn't Load

**Problem**: DNS resolves correctly but connection fails

**Solution**: This is normal if you haven't deployed yet! DNS just points to the server. The site will load after:
1. Nginx is configured
2. SSL certificate is installed
3. Application is deployed

## Pre-Deployment Checklist

Before deploying WIREv2, ensure:

- [ ] DNS A record added: `wire.pose.xyz` → `165.227.68.201`
- [ ] DNS propagation verified: `dig wire.pose.xyz` returns correct IP
- [ ] Can ping server: `ping 165.227.68.201` works
- [ ] Port 80 accessible: `curl -I http://165.227.68.201` works (even if 404)

## During Deployment

When you run Let's Encrypt (`certbot`), it will:
1. Verify DNS is pointing to your server
2. Verify port 80 is accessible
3. Issue SSL certificate for `wire.pose.xyz`

This is why DNS must be setup **before** SSL certificate setup.

## After DNS Setup

Once DNS is working, you can:

1. **Deploy WIREv2** (DNS check will pass)
2. **Setup SSL certificate** (Let's Encrypt will verify DNS)
3. **Access site** at `https://wire.pose.xyz`

## Quick Test Script

Run this to verify DNS is ready:

```bash
#!/bin/bash
DOMAIN="wire.pose.xyz"
EXPECTED_IP="165.227.68.201"

echo "Checking DNS for $DOMAIN..."
RESOLVED_IP=$(dig +short $DOMAIN | head -n1)

if [ "$RESOLVED_IP" == "$EXPECTED_IP" ]; then
    echo "✅ DNS is correct: $DOMAIN → $RESOLVED_IP"
    echo "✅ Ready to deploy!"
else
    echo "❌ DNS not ready yet"
    echo "   Expected: $EXPECTED_IP"
    echo "   Got: $RESOLVED_IP"
    echo "   Wait a few minutes and try again"
fi
```

## Summary

**Do this NOW:**
1. ✅ Add A record: `wire` → `165.227.68.201` in your DNS provider
2. ✅ Wait 5-30 minutes for propagation
3. ✅ Verify: `dig wire.pose.xyz` returns `165.227.68.201`
4. ✅ Then proceed with deployment

**Then deploy:**
- DNS will be ready for SSL certificate
- Frontend can use `https://wire.pose.xyz` in env vars
- Backend CORS can allow `https://wire.pose.xyz`

---

**TL;DR**: Add `wire` A record pointing to `165.227.68.201`, wait 5-30 min, verify with `dig wire.pose.xyz`, then deploy! 🚀
