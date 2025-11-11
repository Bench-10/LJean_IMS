# Web Push Notification System Architecture

## System Overview
```
┌─────────────────────────────────────────────────────────────────────┐
│                         LJean Centralized System                     │
│                    Web Push Notification Architecture                │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────────┐         ┌──────────────────┐         ┌──────────────────┐
│   User Device    │         │   Push Service   │         │   Backend Server │
│    (Browser)     │         │  (Browser/FCM)   │         │    (Node.js)     │
└──────────────────┘         └──────────────────┘         └──────────────────┘
        │                            │                              │
        │                            │                              │
        ▼                            ▼                              ▼
┌──────────────────┐         ┌──────────────────┐         ┌──────────────────┐
│ Service Worker   │         │  FCM/Browser     │         │ Push Service     │
│ (Push Handler)   │◄────────│  Push Gateway    │◄────────│ (web-push lib)   │
└──────────────────┘         └──────────────────┘         └──────────────────┘
        │                                                           │
        │                                                           │
        ▼                                                           ▼
┌──────────────────┐                                      ┌──────────────────┐
│   Notification   │                                      │    PostgreSQL    │
│     Display      │                                      │  (Subscriptions) │
└──────────────────┘                                      └──────────────────┘
```

## Data Flow

### 1. Subscription Flow
```
┌──────┐                                                    ┌──────────┐
│ User │                                                    │ Database │
└──┬───┘                                                    └────┬─────┘
   │                                                             │
   │ 1. Enable Push Notifications                               │
   ├──────────────────────────────────────┐                     │
   │                                       │                     │
   │ 2. Request Permission                 │                     │
   │ ◄─────────────────────────────────────┤                     │
   │                                       │                     │
   │ 3. Permission Granted                 │                     │
   ├──────────────────────────────────────►│                     │
   │                                       │                     │
   │ 4. Subscribe to Push Manager          │                     │
   ├──────────────────────────────────────►│                     │
   │                                       │                     │
   │ 5. Return Subscription Object         │                     │
   │ ◄─────────────────────────────────────┤                     │
   │                                       │                     │
   │ 6. Send Subscription to Backend       │                     │
   ├───────────────────────────────────────┴────────────────────►│
   │                                                              │
   │ 7. Store Subscription                                        │
   │ ◄────────────────────────────────────────────────────────────┤
   │                                                              │
   │ 8. Confirmation                                              │
   │ ◄────────────────────────────────────────────────────────────┤
   │                                                              │
```

### 2. Notification Delivery Flow
```
┌─────────────┐         ┌──────────┐         ┌────────────┐         ┌──────┐
│ Inventory   │         │ Backend  │         │   Push     │         │ User │
│   Event     │         │  Server  │         │  Service   │         │Device│
└──────┬──────┘         └────┬─────┘         └─────┬──────┘         └───┬──┘
       │                     │                      │                    │
       │ 1. Low Stock        │                      │                    │
       │     Alert           │                      │                    │
       ├────────────────────►│                      │                    │
       │                     │                      │                    │
       │                     │ 2. Create Alert      │                    │
       │                     │    in Database       │                    │
       │                     ├──────────┐           │                    │
       │                     │          │           │                    │
       │                     │◄─────────┘           │                    │
       │                     │                      │                    │
       │                     │ 3. Get User          │                    │
       │                     │    Subscriptions     │                    │
       │                     ├──────────┐           │                    │
       │                     │          │           │                    │
       │                     │◄─────────┘           │                    │
       │                     │                      │                    │
       │                     │ 4. Send Push         │                    │
       │                     │    Notification      │                    │
       │                     ├─────────────────────►│                    │
       │                     │                      │                    │
       │                     │                      │ 5. Deliver Push    │
       │                     │                      ├───────────────────►│
       │                     │                      │                    │
       │                     │                      │ 6. Show Notification
       │                     │                      │                    │
       │                     │                      │                    ▼
       │                     │                      │              ┌─────────┐
       │                     │                      │              │ Display │
       │                     │                      │              └─────────┘
       │                     │                      │                    │
       │                     │ 7. Confirm Delivery  │                    │
       │                     │◄─────────────────────┤                    │
       │                     │                      │                    │
```

### 3. Multi-System Integration
```
┌────────────────────────────────────────────────────────────────────┐
│                        Alert Creation Event                         │
│                     (e.g., Low Stock Detected)                      │
└───────────────────────────┬────────────────────────────────────────┘
                            │
                            ▼
                ┌───────────────────────┐
                │ Create Alert Record   │
                │ in Inventory_Alerts   │
                └───────────┬───────────┘
                            │
            ┌───────────────┼───────────────┐
            │               │               │
            ▼               ▼               ▼
┌───────────────────┐ ┌──────────────┐ ┌──────────────────┐
│   WebSocket       │ │  Database    │ │  Push            │
│   Broadcast       │ │  Tracking    │ │  Notification    │
└────────┬──────────┘ └──────┬───────┘ └────────┬─────────┘
         │                   │                  │
         │                   │                  │
         ▼                   ▼                  ▼
┌───────────────────┐ ┌──────────────┐ ┌──────────────────┐
│  Online Users     │ │ user_        │ │ All Subscribed   │
│  Get Real-time    │ │ notification │ │ Devices          │
│  Notification     │ │ Table        │ │ (Even Offline)   │
└───────────────────┘ └──────────────┘ └──────────────────┘
         │                   │                  │
         │                   │                  │
         └───────────────────┼──────────────────┘
                             │
                             ▼
                  ┌──────────────────┐
                  │  User Sees       │
                  │  Notification    │
                  └──────────────────┘
```

## Database Schema

### push_subscriptions Table
```
┌────────────────────┬──────────────┬─────────────┬──────────┐
│ Column             │ Type         │ Nullable    │ Key      │
├────────────────────┼──────────────┼─────────────┼──────────┤
│ subscription_id    │ SERIAL       │ NOT NULL    │ PK       │
│ user_id            │ INT          │ NULL        │ FK →Users│
│ admin_id           │ INT          │ NULL        │ FK →Admin│
│ user_type          │ VARCHAR(10)  │ NOT NULL    │          │
│ endpoint           │ TEXT         │ NOT NULL    │ UNIQUE   │
│ p256dh_key         │ TEXT         │ NOT NULL    │          │
│ auth_key           │ TEXT         │ NOT NULL    │          │
│ user_agent         │ TEXT         │ NULL        │          │
│ device_name        │ VARCHAR(255) │ NULL        │          │
│ is_active          │ BOOLEAN      │ NOT NULL    │ INDEX    │
│ created_at         │ TIMESTAMP    │ NOT NULL    │          │
│ last_used          │ TIMESTAMP    │ NOT NULL    │          │
└────────────────────┴──────────────┴─────────────┴──────────┘

Constraints:
  - user_id OR admin_id must be set (not both)
  - user_type must be 'user' or 'admin'
  - endpoint must be unique
```

### Relationship Diagram
```
┌──────────────┐         ┌──────────────────┐         ┌────────────────┐
│    Users     │         │ push_            │         │ Administrator  │
│              │         │ subscriptions    │         │                │
│ user_id (PK) │◄────────│ user_id (FK)     │         │ admin_id (PK)  │
│              │         │ admin_id (FK)    │────────►│                │
│              │         │                  │         │                │
└──────────────┘         └──────────────────┘         └────────────────┘
                                 │
                                 │
                                 ▼
                         ┌──────────────────┐
                         │ Inventory_Alerts │
                         │                  │
                         │ alert_id (PK)    │
                         │                  │
                         └──────────────────┘
```

## API Architecture

### Endpoint Structure
```
/api/push/
├── vapid-public-key     [GET]  (Public)
├── subscribe            [POST] (Auth Required)
├── unsubscribe          [POST] (Auth Required)
├── subscriptions        [GET]  (Auth Required)
├── test                 [POST] (Auth Required)
└── cleanup              [POST] (Admin Only)
```

### Request/Response Flow
```
┌────────────┐         ┌────────────┐         ┌────────────┐
│  Frontend  │         │   Routes   │         │ Controller │
└──────┬─────┘         └──────┬─────┘         └──────┬─────┘
       │                      │                       │
       │ POST /api/push/      │                       │
       │      subscribe       │                       │
       ├─────────────────────►│                       │
       │                      │                       │
       │                      │ verifyToken()         │
       │                      ├────────┐              │
       │                      │        │              │
       │                      │◄───────┘              │
       │                      │                       │
       │                      │ subscribe()           │
       │                      ├──────────────────────►│
       │                      │                       │
       │                      │                       ▼
       │                      │              ┌────────────────┐
       │                      │              │    Service     │
       │                      │              └────────┬───────┘
       │                      │                       │
       │                      │                       ▼
       │                      │              ┌────────────────┐
       │                      │              │   Database     │
       │                      │              └────────┬───────┘
       │                      │                       │
       │                      │              ┌────────▼───────┐
       │                      │              │   Response     │
       │                      │              └────────┬───────┘
       │                      │                       │
       │                      │◄──────────────────────┤
       │                      │                       │
       │◄─────────────────────┤                       │
       │                      │                       │
       ▼                      │                       │
┌────────────┐               │                       │
│   Result   │               │                       │
└────────────┘               │                       │
```

## Component Interaction

### Backend Components
```
┌─────────────────────────────────────────────────────────────┐
│                        Backend Server                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐        ┌──────────────┐                  │
│  │   Routes     │───────►│ Controllers  │                  │
│  │ (Express)    │        │              │                  │
│  └──────────────┘        └──────┬───────┘                  │
│                                  │                          │
│                                  ▼                          │
│  ┌─────────────────────────────────────────┐               │
│  │          Push Service Layer             │               │
│  ├─────────────────────────────────────────┤               │
│  │ • subscribeToPush()                     │               │
│  │ • sendPushNotification()                │               │
│  │ • sendAlertPushNotification()           │               │
│  │ • cleanupInactiveSubscriptions()        │               │
│  └────────────────┬────────────────────────┘               │
│                   │                                         │
│                   ▼                                         │
│  ┌─────────────────────────────────────────┐               │
│  │         Database Layer (PostgreSQL)      │               │
│  ├─────────────────────────────────────────┤               │
│  │ • push_subscriptions                    │               │
│  │ • user_notification                     │               │
│  │ • admin_notification                    │               │
│  │ • Inventory_Alerts                      │               │
│  └─────────────────────────────────────────┘               │
│                                                              │
│  ┌─────────────────────────────────────────┐               │
│  │        WebSocket Integration            │               │
│  ├─────────────────────────────────────────┤               │
│  │ • broadcastNotification()               │               │
│  │ • Real-time for online users            │               │
│  └─────────────────────────────────────────┘               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Frontend Components (To Be Implemented)
```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend Application                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────┐                   │
│  │       Service Worker                 │                   │
│  ├──────────────────────────────────────┤                   │
│  │ • Register service worker            │                   │
│  │ • Listen for push events             │                   │
│  │ • Show notifications                 │                   │
│  │ • Handle notification clicks         │                   │
│  └──────────────────────────────────────┘                   │
│                                                              │
│  ┌──────────────────────────────────────┐                   │
│  │      Push Notification Utils         │                   │
│  ├──────────────────────────────────────┤                   │
│  │ • subscribeToPushNotifications()     │                   │
│  │ • unsubscribeFromPushNotifications() │                   │
│  │ • checkPushSubscription()            │                   │
│  │ • sendTestNotification()             │                   │
│  └──────────────────────────────────────┘                   │
│                                                              │
│  ┌──────────────────────────────────────┐                   │
│  │      UI Components                   │                   │
│  ├──────────────────────────────────────┤                   │
│  │ • PushNotificationToggle             │                   │
│  │ • Settings Integration               │                   │
│  │ • Permission Handling                │                   │
│  └──────────────────────────────────────┘                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Security Architecture

### Authentication Flow
```
┌──────────┐         ┌──────────┐         ┌──────────┐
│ Request  │────────►│  Verify  │────────►│ Process  │
│          │         │   JWT    │         │  Request │
│  +JWT    │         │  Token   │         │          │
└──────────┘         └──────────┘         └──────────┘
                           │
                           │ Invalid
                           ▼
                    ┌──────────┐
                    │  Reject  │
                    │   401    │
                    └──────────┘
```

### VAPID Authentication
```
┌────────────────┐         ┌────────────────┐
│  Public Key    │────────►│   Subscriber   │
│  (Frontend)    │         │   (Browser)    │
└────────────────┘         └────────────────┘
                                    │
                                    │
                                    ▼
┌────────────────┐         ┌────────────────┐
│  Private Key   │◄────────│   Push         │
│  (Backend)     │         │   Request      │
└────────────────┘         └────────────────┘
```

## Deployment Architecture

### Development Environment
```
┌─────────────────────────────────────────────┐
│           localhost:5173 (Frontend)          │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│           localhost:5000 (Backend)           │
├─────────────────────────────────────────────┤
│ • Push Notification Service                 │
│ • WebSocket Server                          │
│ • REST API                                  │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│      PostgreSQL Database (Local)            │
└─────────────────────────────────────────────┘
```

### Production Environment
```
┌─────────────────────────────────────────────┐
│         CDN/Static Hosting (Frontend)        │
│              (HTTPS Required)                │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│      Application Server (Backend)           │
│         (HTTPS Required)                     │
├─────────────────────────────────────────────┤
│ • Load Balancer                             │
│ • Push Notification Service                 │
│ • WebSocket Server                          │
│ • REST API                                  │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│    PostgreSQL Database (Production)          │
│    • Backup & Recovery                       │
│    • High Availability                       │
└─────────────────────────────────────────────┘
```

## Performance Considerations

### Subscription Storage
```
┌────────────────┐
│ Subscription   │
│    Created     │
└───────┬────────┘
        │
        ▼
┌────────────────┐
│  Store in DB   │──► Indexed by user_id
│  with Indexes  │──► Indexed by endpoint
└───────┬────────┘──► Indexed by is_active
        │
        ▼
┌────────────────┐
│  Fast Lookup   │
│  O(log n)      │
└────────────────┘
```

### Push Delivery
```
┌────────────────┐         ┌────────────────┐
│  Alert Created │────────►│ Get User       │
└────────────────┘         │ Subscriptions  │
                           └────────┬───────┘
                                    │
                                    ▼
                           ┌────────────────┐
                           │ Parallel Send  │
                           │ to All Devices │
                           └────────┬───────┘
                                    │
                                    ▼
                           ┌────────────────┐
                           │  Non-blocking  │
                           │  Async Process │
                           └────────────────┘
```

---

**Last Updated**: January 2025
**Version**: 1.0.0
