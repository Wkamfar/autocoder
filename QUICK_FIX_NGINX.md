# Quick Fix for 500 Error on /v2/

If you're getting a 500 error, update the Nginx config on the droplet:

## Option 1: Pull latest and re-run deployment (recommended)

```bash
cd /opt/wire2
git pull origin main
bash scripts/deploy_prod_droplet.sh
```

## Option 2: Manual Nginx fix

If deployment script doesn't work, manually fix Nginx:

```bash
# Edit the Nginx config
nano /etc/nginx/sites-available/wire.pose.xyz
```

Find the `/v2/` location block and replace it with:

```nginx
# Serve the Wire2 SPA under /v2/*
location ^~ /v2/ {
  alias /opt/wire2/frontend/dist-wire/;
  try_files $uri $uri/ @v2_fallback;
}

# Fallback for SPA client-side routing
location @v2_fallback {
  rewrite ^/v2/(.*)$ /v2/index.html last;
}
```

Then test and reload:

```bash
nginx -t
systemctl reload nginx
```

## Option 3: Check what's actually wrong

```bash
# Check Nginx error logs
tail -50 /var/log/nginx/error.log

# Check if frontend files exist
ls -la /opt/wire2/frontend/dist-wire/

# Test Nginx config
nginx -t

# Check Nginx access logs
tail -20 /var/log/nginx/access.log
```

## Common Issues

1. **Missing index.html**: Make sure `/opt/wire2/frontend/dist-wire/index.html` exists
2. **Permissions**: Files should be readable by nginx user
3. **Path issues**: The alias path must end with `/` and match the location path
