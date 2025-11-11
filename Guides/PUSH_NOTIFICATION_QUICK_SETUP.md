# Web Push Notification - Quick Setup

## Step 1: Add VAPID Keys to Environment

Add these lines to your `.env.development` and `.env.production` files:

```env
# Web Push Notification Configuration
VAPID_PUBLIC_KEY=BMIskejC6mAJ-xyagPl1HfYMxeIUvyMpiiFrPlMX7B_ey5rfyyPdI4GFQVvcTY8-hvlnS0cyZhOv0Pd-cGrH6Mg
VAPID_PRIVATE_KEY=ZJ3Gi8rJq_QVh22pYPx_C3uTJRI48QycUpGfCSwXdiE
VAPID_SUBJECT=mailto:admin@ljean.com
```

⚠️ **IMPORTANT**: For production, generate NEW keys and keep the private key secret!

## Step 2: Run Database Migration

Execute the migration to create the push_subscriptions table:

### Option A: Using psql
```bash
psql -U your_username -d your_database -f migrations/step16_create_push_subscriptions.sql
```

### Option B: Using pgAdmin or Database GUI
Open and run the file: `migrations/step16_create_push_subscriptions.sql`

### Option C: Copy and paste SQL
Run the SQL commands from `migrations/step16_create_push_subscriptions.sql` in your database query tool.

## Step 3: Restart Backend Server

After adding environment variables, restart your server:
```bash
npm run dev
```

## Step 4: Test the Backend API

### Test 1: Get VAPID Public Key (No auth required)
```bash
curl http://localhost:5000/api/push/vapid-public-key
```

Expected response:
```json
{
  "success": true,
  "publicKey": "BMIskejC6mAJ-xy..."
}
```

### Test 2: Subscribe (Requires auth token)
```bash
curl -X POST http://localhost:5000/api/push/subscribe \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "subscription": {
      "endpoint": "https://fcm.googleapis.com/fcm/send/test",
      "keys": {
        "p256dh": "test-p256dh-key",
        "auth": "test-auth-key"
      }
    },
    "deviceInfo": {
      "userAgent": "Test Browser",
      "deviceName": "Test Device"
    }
  }'
```

### Test 3: Send Test Notification (Requires auth token)
```bash
curl -X POST http://localhost:5000/api/push/test \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Notification",
    "message": "Testing push notifications"
  }'
```

## Step 5: Frontend Implementation

### Create Service Worker
Copy the service worker code from the guide and save to:
`frontend/public/service-worker.js`

### Create Utility Functions
Copy the push notification utility code from the guide and save to:
`frontend/src/utils/pushNotification.js`

### Update Frontend Environment
Add to `frontend/.env`:
```env
VITE_API_URL=http://localhost:5000
```

### Add Toggle Component
Copy the PushNotificationToggle component from the guide and integrate into your settings page.

## Step 6: Test End-to-End

1. Open your app in browser (Chrome/Firefox/Edge recommended)
2. Log in as a user
3. Go to settings and enable push notifications
4. Grant notification permission when prompted
5. Trigger a low stock alert or send a test notification
6. Verify you receive the push notification

## Verification Checklist

- [ ] VAPID keys added to .env file
- [ ] Database migration executed successfully
- [ ] Backend server restarted
- [ ] Can access /api/push/vapid-public-key endpoint
- [ ] Service worker file created in frontend/public/
- [ ] Push notification utilities created
- [ ] Frontend can subscribe to push notifications
- [ ] Can send and receive test notifications
- [ ] Push notifications triggered by inventory alerts

## Common Issues

### Issue: "Service Worker registration failed"
**Solution**: Ensure HTTPS is enabled (or using localhost). Clear browser cache.

### Issue: "VAPID keys not configured"
**Solution**: Check .env file exists and has correct keys. Restart server after adding.

### Issue: "Subscription not found in database"
**Solution**: Check database connection. Verify migration ran successfully.

### Issue: "Push notification not received"
**Solution**: 
- Check browser notification permissions
- Verify subscription is active in database
- Check browser console for errors
- Try sending a test notification first

## Browser Testing

Test in multiple browsers:
- ✅ Chrome/Chromium
- ✅ Firefox
- ✅ Edge
- ✅ Safari 16+ (macOS 13+)
- ⚠️ iOS Safari (limited support)

## Production Deployment

Before deploying to production:

1. Generate NEW VAPID keys (don't use development keys!)
2. Add production keys to production .env file
3. Run migration on production database
4. Ensure HTTPS is configured (required!)
5. Test push notifications in production environment
6. Monitor logs for any errors

## Need Help?

Refer to the complete guide: `Guides/WEB_PUSH_NOTIFICATION_GUIDE.md`

---

**Setup complete! You now have web push notifications enabled.**
