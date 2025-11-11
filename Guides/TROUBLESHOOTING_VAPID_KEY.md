# Troubleshooting "Failed to get VAPID public key"

## Problem
The frontend shows "Failed to get VAPID public key" when trying to enable push notifications.

## Root Cause
The backend VAPID keys are not properly configured in the production environment.

## Solution

### 1. Check if VAPID keys exist on production server

SSH to your server and run:
```bash
cd /var/www/LJean_IMS
grep VAPID backend/.env
```

**Expected output:**
```
VAPID_PUBLIC_KEY=BAxtJ3RERycO2m9HVQ_KQxDEE-7_Ux85kOtO_n7AhibyeXzvBHyqLvPSH62B9mj1zmJAdiISrvgvKomIHao5WCc
VAPID_PRIVATE_KEY=QiXZZkzET_iONiOoVG9P7g3Jj2lOSokQ-l7ZH7PqYsE
VAPID_SUBJECT=mailto:admin@ljean.com
```

### 2. If keys are missing, add them

```bash
cd /var/www/LJean_IMS/backend

# Generate new production keys
npx web-push generate-vapid-keys

# Copy the output keys, then add to .env:
nano .env
```

Add these lines (use the keys from the generate command):
```env
# Web Push Notification VAPID Keys
VAPID_PUBLIC_KEY=<your-public-key-here>
VAPID_PRIVATE_KEY=<your-private-key-here>
VAPID_SUBJECT=mailto:admin@yourdomain.com
```

Save and exit (Ctrl+X, Y, Enter)

### 3. Verify the keys are correct

Run the diagnostic script:
```bash
cd /var/www/LJean_IMS
node backend/test_vapid_config.js
```

**Expected output:**
```
✅ VAPID configuration looks good!
✅ Push notifications should work correctly.
```

### 4. Restart the backend server

```bash
pm2 restart ljean-api
# or
pm2 restart all
```

### 5. Check backend logs

```bash
pm2 logs ljean-api --lines 50
```

Look for:
- `✓ web-push VAPID configured` (good!)
- Any VAPID-related errors (bad)

### 6. Test the endpoint

```bash
curl http://localhost:5000/api/push/vapid-public-key
```

**Expected response:**
```json
{
  "success": true,
  "publicKey": "BAxtJ3RERycO2m9HVQ_KQxDEE-7_Ux85kOtO_n7AhibyeXzvBHyqLvPSH62B9mj1zmJAdiISrvgvKomIHao5WCc"
}
```

### 7. Test from frontend

Open browser console and run:
```javascript
fetch('/api/push/vapid-public-key')
  .then(r => r.json())
  .then(d => console.log('VAPID key:', d))
  .catch(e => console.error('Error:', e));
```

---

## Alternative: Copy keys from local to production

If you want to use the same keys from your local environment:

### On your local machine:
```bash
cd C:\Users\bench\OneDrive\Documents\LJean_Centralized
# Show the keys
type .env | findstr VAPID
```

### On production server:
```bash
cd /var/www/LJean_IMS/backend
nano .env

# Add the exact same keys from local:
VAPID_PUBLIC_KEY=BAxtJ3RERycO2m9HVQ_KQxDEE-7_Ux85kOtO_n7AhibyeXzvBHyqLvPSH62B9mj1zmJAdiISrvgvKomIHao5WCc
VAPID_PRIVATE_KEY=QiXZZkzET_iONiOoVG9P7g3Jj2lOSokQ-l7ZH7PqYsE
VAPID_SUBJECT=mailto:admin@ljean.com
```

**Important:** Using the same keys across environments is acceptable for push notifications, but generate separate keys for production if you prefer.

---

## Common Issues

### Issue 1: `.env` file in wrong location
**Solution:** VAPID keys should be in `/var/www/LJean_IMS/backend/.env` OR `/var/www/LJean_IMS/.env`

Check where server.js loads the .env:
```bash
cd /var/www/LJean_IMS
grep -n "dotenv" backend/server.js
```

### Issue 2: Keys have quotes or extra spaces
**Wrong:**
```env
VAPID_PUBLIC_KEY="BAxtJ3RERycO2m9HVQ_K..."
VAPID_PUBLIC_KEY=BAxtJ3RERycO2m9HVQ_K... 
```

**Correct:**
```env
VAPID_PUBLIC_KEY=BAxtJ3RERycO2m9HVQ_K...
```

### Issue 3: Server not restarted after adding keys
**Solution:** Always restart after changing .env:
```bash
pm2 restart ljean-api
```

### Issue 4: Wrong file permissions
**Solution:** Ensure .env is readable:
```bash
chmod 600 /var/www/LJean_IMS/backend/.env
chown ljean:ljean /var/www/LJean_IMS/backend/.env
```

---

## Quick Fix Command (Production)

Run this on your production server (replace with your actual keys):

```bash
cd /var/www/LJean_IMS/backend

# Backup existing .env
cp .env .env.backup.$(date +%Y%m%d)

# Add VAPID keys
cat >> .env << 'EOF'

# Web Push Notification VAPID Keys
VAPID_PUBLIC_KEY=BAxtJ3RERycO2m9HVQ_KQxDEE-7_Ux85kOtO_n7AhibyeXzvBHyqLvPSH62B9mj1zmJAdiISrvgvKomIHao5WCc
VAPID_PRIVATE_KEY=QiXZZkzET_iONiOoVG9P7g3Jj2lOSokQ-l7ZH7PqYsE
VAPID_SUBJECT=mailto:admin@ljean.com
EOF

# Verify
grep VAPID .env

# Restart
pm2 restart ljean-api

# Check logs
pm2 logs ljean-api --lines 20
```

---

## Success Indicators

✅ `pm2 logs` shows: `✓ web-push VAPID configured`  
✅ Endpoint returns: `{"success":true,"publicKey":"BAxtJ..."}`  
✅ Frontend shows: "Enable Push Notifications" button  
✅ No console errors when clicking enable  

---

**Still having issues?** Share:
1. Output of `node backend/test_vapid_config.js`
2. Output of `pm2 logs ljean-api --lines 50`
3. Output of `curl http://localhost:5000/api/push/vapid-public-key`
