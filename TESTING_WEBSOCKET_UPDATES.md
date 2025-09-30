# 🧪 Testing WebSocket Real-Time Updates

## Quick Test Steps

### 1. **Start the Application**
```bash
# Terminal 1: Start Backend
npm run dev

# Terminal 2: Start Frontend  
cd frontend
npm run dev
```

### 2. **Test Real-Time Inventory Updates**

#### Option A: Multiple Browser Windows
1. Open the app in 2+ browser windows: `http://localhost:5173`
2. Login with users from the same branch
3. Go to the **Product Inventory** page in both windows
4. In window 1: Click "ADD ITEM" and add a new product
5. ✅ **Expected**: The new product should appear instantly in window 2

#### Option B: WebSocket Monitor
1. Open `websocket_test.html` in a browser
2. Set Branch ID to match your test user's branch
3. Click "Connect" 
4. In the main app, add/update a product
5. ✅ **Expected**: Real-time updates appear in the monitor

### 3. **Test Real-Time Product Validity Updates**

1. Open **Product Validity** page in multiple windows
2. In one window, go to **Product Inventory** 
3. Add a product with an expiry date (Product Validity field)
4. ✅ **Expected**: The new validity entry appears instantly in the Product Validity page of other windows

### 4. **Test Notifications**

1. Keep the WebSocket monitor open (`websocket_test.html`)
2. Add a product in the main application
3. ✅ **Expected**: 
   - Notification appears in the monitor
   - In-app notification shows in other browser windows
   - Banner notification appears for inventory staff

## What to Look For

### ✅ **Success Indicators:**
- Products appear instantly without page refresh
- In-app notifications show: "Product X has been added by another user"
- WebSocket monitor shows real-time events
- Product validity page updates automatically
- Console logs show WebSocket events

### ❌ **Common Issues:**
- **No updates**: Check if users are in the same branch
- **Self-updates showing**: User ID filtering issue
- **Connection failed**: Check backend port (3000) and frontend API URL
- **No WebSocket**: Check if Socket.IO is working in browser dev tools

## Debug Tips

### Browser Console Commands:
```javascript
// Check WebSocket connection
console.log('Socket connected:', !!window.socket?.connected);

// Manual test event
window.dispatchEvent(new CustomEvent('validity-update', {
  detail: { action: 'add', product: {product_name: 'Test'}, user_id: 999 }
}));
```

### Browser Network Tab:
- Look for WebSocket connection in Network tab
- Check for Socket.IO polling/websocket protocols
- Verify 101 (Switching Protocols) response

### Backend Logs:
```
User connected: [socket-id]
User [user-id] joined branch [branch-id]
New notification received: [notification-data]
```

## Expected User Experience

1. **Inventory Staff** adds a product on their tablet
2. **Branch Manager** on desktop sees it instantly appear
3. **Other Inventory Staff** get a notification
4. **Product Validity page** updates with new expiry data
5. **All devices stay synchronized** without manual refresh

## Test Scenarios

### Scenario 1: Multi-Device Inventory Management
- Device A: Add product "Rice 25kg"
- Device B: Should see "Rice 25kg" appear instantly
- Device C: Should receive notification

### Scenario 2: Real-Time Validity Tracking  
- Device A: Add product with expiry date tomorrow
- Device B: Go to Product Validity page
- Device B: Should see new entry with "Near Expiry" status

### Scenario 3: Cross-User Updates
- User A: Update product quantity 
- User B: Should see quantity change in real-time
- User B: Should get "Product updated by another user" notification

## Performance Notes

- Updates are **branch-specific** (users only see their branch data)
- **Self-updates are filtered** (you don't get notifications for your own changes)  
- **Automatic cleanup** when users disconnect
- **Memory efficient** with message limits and cleanup routines