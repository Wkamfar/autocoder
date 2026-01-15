# Navigation and URL Structure Updates

## Changes Made

### 1. URL Structure Change: `/wire/` → `/v2/`
- ✅ Updated `main-wire.tsx`: Changed `basename` from `/wire` to `/v2`
- ⚠️ **TODO**: Update nginx configuration on server to serve from `/v2` path
- ⚠️ **TODO**: Rebuild and redeploy frontend

### 2. Sign Out/Logout Functionality
- ✅ Added `logout` method to `AuthContext`
- ✅ Added `logout` API method to `wireApi` client
- ✅ Added user dropdown menu with "Settings" and "Sign Out" options
- ✅ Added logout button to mobile menu
- ✅ Logout clears session storage and redirects to home

### 3. Help in Top Navigation
- ✅ Added "Help" tab to `TAB_CONFIG` array
- ✅ Help links to `/settings/help`
- ✅ Help tab highlights when on any settings page

### 4. User Settings Access
- ✅ User menu dropdown with "Settings" link
- ✅ Settings accessible from user avatar/name in top right
- ✅ Settings accessible from mobile menu

### 5. Signup/Login Flow
- ✅ Signup page exists at `/signup` route
- ℹ️ Currently uses password gate (sessionStorage-based)
- ℹ️ Full authentication flow requires backend database migrations

## Deployment Steps

1. **Update Nginx Configuration**
   ```bash
   ssh root@165.227.68.201
   # Update /etc/nginx/sites-available/wire.pose.xyz
   # Change location / to location /v2 (see nginx config below)
   nginx -t
   systemctl reload nginx
   ```

2. **Rebuild Frontend**
   ```bash
   cd wire2/frontend
   npm run build
   ```

3. **Redeploy Frontend**
   ```bash
   # Copy dist-wire to server
   rsync -avz --delete dist-wire/ root@165.227.68.201:/opt/wire2/frontend/dist-wire/
   ```

## Nginx Configuration Update

The nginx config needs to be updated to serve from `/v2` path:

```nginx
location /v2 {
    alias /opt/wire2/frontend/dist-wire;
    try_files $uri $uri/ /v2/index-wire.html;
    index index-wire.html;
    
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}

location = / {
    return 301 https://$host/v2/;
}
```

## Testing Checklist

- [ ] Verify `/v2/` loads correctly
- [ ] Verify `/v2/settings/accounts` works
- [ ] Verify Help link in top nav works
- [ ] Verify user menu dropdown appears
- [ ] Verify Sign Out button works
- [ ] Verify Settings link from user menu works
- [ ] Verify all navigation links work with new `/v2` path
- [ ] Verify signup page at `/v2/signup` is accessible

## Current Status

✅ Code changes complete
⚠️ Deployment pending (nginx config + rebuild + redeploy)
