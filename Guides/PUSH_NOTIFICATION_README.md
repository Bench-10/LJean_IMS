# 🔔 Web Push Notifications - Feature Documentation

> **Status**: Backend Complete ✅ | Frontend Pending ⏳  
> **Version**: 1.0.0  
> **Last Updated**: January 2025

---

## 📋 Overview

Web push notifications allow users to receive alerts even when the LJean Centralized application is closed. This feature works alongside existing WebSocket notifications and database notification tracking to provide a comprehensive notification system.

### Key Benefits
- ✅ Receive alerts when app is closed
- ✅ Multi-device support (desktop, mobile)
- ✅ Works across browsers (Chrome, Firefox, Edge, Safari)
- ✅ Role-based notification filtering
- ✅ Automatic subscription management
- ✅ Zero impact on existing notification systems

---

## 🚀 Quick Start

### For Developers

1. **Setup Environment**
   ```bash
   cp .env.example .env.development
   # Edit .env.development with your database credentials
   # VAPID keys are already included
   ```

2. **Run Database Migration**
   ```bash
   psql -U your_user -d your_db -f migrations/step16_create_push_subscriptions.sql
   ```

3. **Start Server**
   ```bash
   npm run dev
   ```

4. **Test Backend**
   ```bash
   curl http://localhost:5000/api/push/vapid-public-key
   ```

5. **Implement Frontend** (code examples in guides)

### For Users

Once implemented, users can:
1. Go to Settings
2. Toggle "Push Notifications" on
3. Grant browser permission
4. Start receiving notifications even when app is closed

---

## 📁 Project Structure

```
LJean_Centralized/
├── backend/
│   ├── Services/
│   │   └── pushNotificationService.js       ✅ Complete
│   ├── Controllers/
│   │   └── pushNotificationController.js    ✅ Complete
│   └── Routes/
│       └── pushNotificationRoutes.js        ✅ Complete
├── migrations/
│   └── step16_create_push_subscriptions.sql ✅ Complete
├── Guides/
│   ├── WEB_PUSH_NOTIFICATION_GUIDE.md       ✅ Complete
│   ├── PUSH_NOTIFICATION_QUICK_SETUP.md     ✅ Complete
│   ├── PUSH_NOTIFICATION_ARCHITECTURE.md    ✅ Complete
│   ├── PUSH_NOTIFICATION_CHECKLIST.md       ✅ Complete
│   └── PUSH_NOTIFICATION_IMPLEMENTATION_SUMMARY.md ✅ Complete
└── frontend/ (to be implemented)
    ├── public/
    │   └── service-worker.js                ⏳ Pending
    └── src/
        ├── utils/
        │   └── pushNotification.js          ⏳ Pending
        └── components/
            └── PushNotificationToggle.jsx   ⏳ Pending
```

---

## 🔌 API Endpoints

### Public Endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/push/vapid-public-key` | GET | Get VAPID public key |

### Protected Endpoints (Requires Authentication)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/push/subscribe` | POST | Subscribe to push notifications |
| `/api/push/unsubscribe` | POST | Unsubscribe from push notifications |
| `/api/push/subscriptions` | GET | Get user's active subscriptions |
| `/api/push/test` | POST | Send test notification |

### Admin Endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/push/cleanup` | POST | Remove inactive subscriptions |

---

## 🎯 Features

### ✅ Implemented (Backend)
- Push subscription management (subscribe/unsubscribe)
- Multi-device support per user
- Role-based notification filtering (Branch Manager, Inventory Staff, etc.)
- Automatic delivery to all user's devices
- Expired subscription detection and cleanup
- Integration with inventory alerts
- Test notification sending
- VAPID authentication
- Database persistence
- Error handling and logging

### ⏳ To Be Implemented (Frontend)
- Service worker for push event handling
- Browser notification permission handling
- UI toggle component for settings
- Subscription status display
- Notification click handling
- Auto-subscribe on login (optional)

---

## 💡 How It Works

### System Flow
```
1. User enables push notifications
2. Browser requests permission
3. Service worker subscribes to push
4. Subscription sent to backend
5. Backend stores in database

When alert occurs:
6. Alert created in Inventory_Alerts
7. Backend sends WebSocket (online users)
8. Backend sends Push (all devices)
9. Service worker receives push
10. Browser shows notification
11. User clicks → Opens app
```

### Integration with Existing Systems
- **WebSocket**: Real-time for online users (unchanged)
- **Database**: Tracks read/unread status (unchanged)
- **Push**: New layer for offline delivery

All three work together seamlessly!

---

## 🔧 Configuration

### Environment Variables
```env
# Required
VAPID_PUBLIC_KEY=<your_public_key>
VAPID_PRIVATE_KEY=<your_private_key>
VAPID_SUBJECT=mailto:admin@ljean.com
```

### Generate VAPID Keys
```bash
npx web-push generate-vapid-keys
```

⚠️ **Important**: Generate NEW keys for production!

---

## 🧪 Testing

### Backend Tests
```bash
# Test 1: Get public key
curl http://localhost:5000/api/push/vapid-public-key

# Test 2: Run test script
node backend/test_push_notifications.js

# Test 3: Subscribe (requires JWT token)
curl -X POST http://localhost:5000/api/push/subscribe \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "subscription": {...}, "deviceInfo": {...} }'

# Test 4: Send test notification
curl -X POST http://localhost:5000/api/push/test \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "title": "Test", "message": "Testing" }'
```

### End-to-End Tests (After Frontend Implementation)
1. Enable push notifications in settings
2. Grant browser permission
3. Trigger low stock alert
4. Verify push notification received
5. Test with app closed
6. Test on multiple devices

---

## 📊 Database Schema

### push_subscriptions Table
```sql
CREATE TABLE push_subscriptions (
    subscription_id SERIAL PRIMARY KEY,
    user_id INT NULL,
    admin_id INT NULL,
    user_type VARCHAR(10) NOT NULL,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh_key TEXT NOT NULL,
    auth_key TEXT NOT NULL,
    user_agent TEXT,
    device_name VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    last_used TIMESTAMP DEFAULT NOW(),
    -- Foreign keys and constraints
);
```

---

## 🌐 Browser Support

| Browser | Desktop | Mobile | Notes |
|---------|---------|--------|-------|
| Chrome | ✅ | ✅ | Full support |
| Firefox | ✅ | ✅ | Full support |
| Edge | ✅ | ✅ | Full support |
| Safari | ✅ (16+) | ⚠️ | iOS: Home screen only |
| Opera | ✅ | ✅ | Full support |

---

## 🔒 Security

- **VAPID Authentication**: Secure push delivery
- **JWT Tokens**: All endpoints (except public key) require auth
- **Role-Based Access**: Admin endpoints restricted
- **HTTPS Required**: Production must use HTTPS
- **Endpoint Validation**: Subscriptions tied to user accounts

---

## 📚 Documentation

### Quick Reference
- **Setup**: `Guides/PUSH_NOTIFICATION_QUICK_SETUP.md`
- **Checklist**: `Guides/PUSH_NOTIFICATION_CHECKLIST.md`

### Comprehensive Guides
- **Full Guide**: `Guides/WEB_PUSH_NOTIFICATION_GUIDE.md`
- **Architecture**: `Guides/PUSH_NOTIFICATION_ARCHITECTURE.md`
- **Summary**: `Guides/PUSH_NOTIFICATION_IMPLEMENTATION_SUMMARY.md`

---

## 🐛 Troubleshooting

### Common Issues

**Issue**: Server won't start
- ✓ Check VAPID keys in .env file
- ✓ Verify database connection

**Issue**: API returns 404
- ✓ Verify routes imported in server.js
- ✓ Restart server after changes

**Issue**: Can't subscribe
- ✓ Check JWT token is valid
- ✓ Verify database migration ran
- ✓ Check browser console for errors

**Issue**: No notifications received
- ✓ Check browser permission granted
- ✓ Verify subscription is active in database
- ✓ Test with simple test notification first

**Issue**: iOS Safari not working
- ✓ Add app to home screen (iOS requirement)
- ✓ iOS Safari has limited support

### Debug Checklist
- [ ] Environment variables configured
- [ ] Database migration completed
- [ ] Server running without errors
- [ ] Public key endpoint accessible
- [ ] JWT token valid
- [ ] Browser permission granted
- [ ] Subscription in database
- [ ] Service worker registered (frontend)

---

## 🚢 Deployment

### Pre-Deployment Checklist
- [ ] Generate new production VAPID keys
- [ ] Add keys to production .env
- [ ] Run database migration on production
- [ ] Verify HTTPS enabled
- [ ] Test in staging environment

### Production Requirements
- HTTPS enabled (required)
- PostgreSQL database
- Node.js server
- Environment variables configured

---

## 🔄 Maintenance

### Regular Tasks
- **Monthly**: Run subscription cleanup
- **Weekly**: Check failed delivery logs
- **Daily**: Monitor subscription count

### Cleanup Command
```bash
curl -X POST https://your-api.com/api/push/cleanup \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -d '{ "daysInactive": 90 }'
```

### Health Monitoring
```sql
-- Check subscription stats
SELECT user_type, is_active, COUNT(*) 
FROM push_subscriptions 
GROUP BY user_type, is_active;

-- Find inactive subscriptions
SELECT COUNT(*) 
FROM push_subscriptions 
WHERE last_used < NOW() - INTERVAL '90 days';
```

---

## 📈 Roadmap

### Current Version (1.0.0)
- ✅ Backend API complete
- ✅ Database schema
- ✅ Basic notification delivery
- ✅ Multi-device support
- ✅ Documentation

### Future Enhancements
- [ ] Rich notifications with images
- [ ] Action buttons in notifications
- [ ] Notification categories/channels
- [ ] Per-alert-type preferences
- [ ] Push notification analytics
- [ ] Batch notification sending
- [ ] Scheduled notifications
- [ ] Notification templates

---

## 🤝 Contributing

### Adding New Alert Types

1. Create alert in `Inventory_Alerts` table
2. Call `sendPushForAlert(alert)` after creation
3. System automatically sends to appropriate users

Example:
```javascript
import { sendPushForAlert } from '../Services/products/notificationServices.js';

// After creating alert
const alertResult = await SQLquery(`
  INSERT INTO Inventory_Alerts (...) 
  VALUES (...) 
  RETURNING *
`);

// Send push notification
sendPushForAlert(alertResult.rows[0]);
```

### Extending Functionality

See `pushNotificationService.js` for service functions:
- Add new functions as needed
- Follow existing patterns
- Update documentation

---

## 📞 Support

### Getting Help
1. Check documentation in `Guides/` folder
2. Review troubleshooting section
3. Check browser console for errors
4. Verify environment configuration
5. Test with simple test notification

### Useful Commands
```bash
# Check if server is running
curl http://localhost:5000/api/push/vapid-public-key

# Run test script
node backend/test_push_notifications.js

# Check database subscriptions
psql -d your_db -c "SELECT * FROM push_subscriptions;"
```

---

## 📝 License

This feature is part of the LJean Centralized system.

---

## 👥 Credits

**Implementation**: Backend push notification system  
**Technology**: Node.js, web-push, PostgreSQL  
**Integration**: Inventory alerts, user notifications  

---

## 📌 Quick Links

- [Setup Guide](./PUSH_NOTIFICATION_QUICK_SETUP.md)
- [Complete Documentation](./WEB_PUSH_NOTIFICATION_GUIDE.md)
- [Architecture Diagram](./PUSH_NOTIFICATION_ARCHITECTURE.md)
- [Implementation Checklist](./PUSH_NOTIFICATION_CHECKLIST.md)
- [Implementation Summary](./PUSH_NOTIFICATION_IMPLEMENTATION_SUMMARY.md)

---

**Backend Status**: ✅ Complete and Ready  
**Frontend Status**: ⏳ Awaiting Implementation  
**Production Status**: 🔄 Ready for Deployment After Frontend

---

*For detailed implementation instructions, see the comprehensive guide in `Guides/WEB_PUSH_NOTIFICATION_GUIDE.md`*
