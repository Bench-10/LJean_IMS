# Quick Mobile Notification Testing Guide

## What Was Fixed
✅ Implemented full service worker (`frontend/public/sw.js`)  
✅ Registered service worker in app (`frontend/src/main.jsx`)  
✅ Fixed notification API to use service worker on mobile (`Notification.jsx`)  
✅ Changed icon paths to mobile-safe public folder paths  

---

## Test Now (5 Minutes)

### Step 1: Rebuild Frontend
```bash
cd frontend
npm run build
# or for dev:
npm run dev
```

### Step 2: Clear Browser Cache
**Desktop**:
- Chrome: Ctrl+Shift+Delete > Clear cache
- Firefox: Ctrl+Shift+Delete > Clear cache

**Mobile**:
- Android Chrome: Settings > Privacy > Clear browsing data
- iOS Safari: Settings > Safari > Clear History and Website Data

### Step 3: Test on Desktop First
1. Open app in browser
2. Check console: Should see `[Service Worker] Registered successfully`
3. Trigger a notification (create inventory alert, etc.)
4. Notification should appear
5. No errors in console

### Step 4: Test on Mobile
1. Access app from mobile browser
2. Grant notification permission when prompted
3. Trigger a notification
4. **Expected**: Notification shows, NO white screen
5. App continues working normally

---

## Quick Console Checks

### Check Service Worker Status
```javascript
// Paste in browser console
navigator.serviceWorker.getRegistrations().then(r => {
  console.log('SW Registered:', r.length > 0);
  console.log('Details:', r);
});
```

### Check Notification Permission
```javascript
// Paste in browser console
console.log('Notification:', Notification.permission);
console.log('ServiceWorker:', 'serviceWorker' in navigator);
console.log('PushManager:', 'PushManager' in window);
```

### Manual Test Notification
```javascript
// Paste in browser console (after granting permission)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.ready.then(reg => {
    reg.showNotification('Test', {
      body: 'Testing mobile notifications',
      icon: '/vite.svg',
      tag: 'test'
    });
  });
}
```

---

## Expected Results

### ✅ Success Indicators
- Service worker registers without errors
- Console shows: `[Service Worker] Registered successfully`
- Notifications appear as popups
- App doesn't crash or show white screen
- Clicking notification opens/focuses app
- Mobile vibrates on notification (Android)

### ❌ If Still Having Issues

**White screen persists**:
1. Completely close and reopen browser
2. Clear all site data (not just cache)
3. Check HTTPS is enabled (required for service worker)
4. Try different browser

**Service worker not registering**:
1. Check `/sw.js` file exists in public folder
2. Verify file is not empty (should be ~150 lines)
3. Check browser console for specific errors
4. Try accessing directly: `your-url.com/sw.js`

**Notifications not showing**:
1. Check permission: `console.log(Notification.permission)`
2. Should be `"granted"`, not `"denied"` or `"default"`
3. Reset permission: Browser settings > Site settings > Notifications
4. Grant permission again

---

## iOS Safari Special Notes

**Limited Support**:
- Push notifications only work when app is "Add to Home Screen"
- Regular Safari tab has very limited support

**To Test on iOS**:
1. Open app in Safari
2. Tap Share button
3. Tap "Add to Home Screen"
4. Open app from home screen icon
5. Now notifications should work

---

## Remote Debugging (Mobile)

### Android Chrome
```bash
# 1. Enable USB debugging on phone
# 2. Connect phone to computer
# 3. Open Chrome on computer
# 4. Go to: chrome://inspect
# 5. Click "inspect" under your device
# 6. Now you can see console logs from phone
```

### iOS Safari
```bash
# 1. Enable Web Inspector on iPhone:
#    Settings > Safari > Advanced > Web Inspector
# 2. Connect iPhone to Mac
# 3. Open Safari on Mac
# 4. Develop menu > [Your iPhone] > [Your Page]
# 5. Now you can see console logs from iPhone
```

---

## Quick Fixes for Common Issues

### Issue: "Service worker failed to register"
```javascript
// Check if sw.js is accessible
fetch('/sw.js').then(r => console.log('SW file OK:', r.ok));
```

### Issue: "Failed to show notification"
```javascript
// Check all requirements
console.log('HTTPS:', window.location.protocol === 'https:');
console.log('Permission:', Notification.permission);
console.log('SW Ready:', navigator.serviceWorker.controller !== null);
```

### Issue: White screen appears
```javascript
// Check for JavaScript errors
window.addEventListener('error', (e) => {
  console.error('Global error:', e.message, e.filename, e.lineno);
});
```

---

## Files to Check

If issues persist, verify these files were updated:

1. **`frontend/public/sw.js`** (should be ~150 lines, not empty)
2. **`frontend/src/main.jsx`** (should have service worker registration)
3. **`frontend/src/Pages/Notification.jsx`** (should have try-catch around notifications)

---

## Production Deployment

Before deploying to production:

- [ ] Test on multiple mobile devices
- [ ] Test on multiple browsers (Chrome, Firefox, Safari)
- [ ] Ensure HTTPS is enabled
- [ ] Test notification permissions
- [ ] Test offline functionality
- [ ] Monitor error logs after deployment

---

## Support Commands

```bash
# Rebuild frontend
npm run build

# Check for build errors
npm run build 2>&1 | grep -i error

# Start dev server with clean cache
npm run dev -- --force

# Clear node_modules and reinstall (if needed)
rm -rf node_modules package-lock.json
npm install
```

---

**Ready to test?** Follow Step 1-4 above and check the expected results!

**Still broken?** Check the detailed guide: `MOBILE_NOTIFICATION_FIX.md`
