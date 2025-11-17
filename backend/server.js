import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';
import { Server } from 'socket.io';
import zlib from 'zlib';
import { speedLimiter, createApiLimiter } from './middleware/rateLimiters.js';
import itemRoutes from './Routes/itemRoutes.js';
import userRoutes from './Routes/userRoutes.js';
import saleRoutes from './Routes/saleRoutes.js';
import analyticsRoutes from './Routes/analyticsRoutes.js';
import deliveryRoutes from './Routes/deliveryRoutes.js';
import passwordResetRoutes from './Routes/passwordResetRoutes.js';
import pushNotificationRoutes from './Routes/pushNotificationRoutes.js';
import debugRoutes from './Routes/debugRoutes.js';
import cron from "node-cron";
import { notifyProductShelfLife } from './Services/Services_Utils/productValidityNotification.js';
import { loadUnitConversionCache } from './Services/Services_Utils/unitConversion.js';
import { SQLquery } from './db.js';
import { createSystemInventoryNotification } from './Services/products/inventoryServices.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// load environment before any other imports that may use process.env
const envName = (process.env.NODE_ENV || 'development').trim();
const envCandidates = [
  path.resolve(__dirname, `.env.${envName}`),
  path.resolve(__dirname, `../.env.${envName}`),
  path.resolve(__dirname, '.env'),
  path.resolve(__dirname, '../.env')
];

for (const candidate of envCandidates) {
  const res = dotenv.config({ path: candidate, override: true });
  if (!res.error) {
    console.log(`✓ Loaded env from: ${candidate}`);
    break;
  }
}
if (!process.env.SECRET_KEY) {
  console.warn('SECRET_KEY is not set after loading env files');
}

console.log('NODE_ENV=', process.env.NODE_ENV);
console.log('PORT=', process.env.PORT);
console.log('CORS_ORIGIN=', process.env.CORS_ORIGIN);

const app  = express();

const isProduction = process.env.NODE_ENV === 'production';
const DEFAULT_DEV_ORIGINS = ['http://localhost:5173', 'http://192.168.1.4:5173'];
const allowedOrigins = (process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',')
  : DEFAULT_DEV_ORIGINS)
  .map(origin => origin.trim())
  .filter(Boolean);

const isOriginAllowed = (origin) => {
  if (!origin) return true;
  if (allowedOrigins.length === 0) return true;
  return allowedOrigins.includes(origin);
};

const corsOptions = {
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'), false);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Disposition']
};

//CONNECTS THE SERVER TO THE FRONTEND
const server = createServer(app);
const io = new Server(server, {
  cors: {
    ...corsOptions,
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'), false);
    },
    methods: ['GET', 'POST']
  }
});


const isTrustedProxy = (ip) => ip === '127.0.0.1' || ip === '::1';
app.set('trust proxy', isTrustedProxy);

app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

//DATA COMPRESSION
app.use(compression({
  level: zlib.constants.Z_BEST_SPEED,
  threshold: 1024, // compress responses > 1KB
  filter: (req, res) => {
    const contentType = String(res.getHeader('Content-Type') || '');
    // Skip compression for binary content, images, videos, and already-compressed formats
    if (/image|video|audio|zip|pdf|gz|octet-stream/.test(contentType)) {
      return false;
    }
    return compression.filter(req, res);
  }
}));

app.use(cors(corsOptions));
app.use(cookieParser());

const requestBodyLimit = process.env.REQUEST_PAYLOAD_LIMIT || '100kb';
app.use(express.json({ limit: requestBodyLimit }));
app.use(express.urlencoded({ extended: true, limit: requestBodyLimit }));


// Apply rate limiting and throttling (imported from middleware/rateLimiters.js)
const rateLimitWindowMinutes = parseInt(process.env.RATE_LIMIT_WINDOW_MINUTES || '15', 10);
const rateLimitMax = parseInt(process.env.RATE_LIMIT_MAX || '300', 10);
const apiLimiter = createApiLimiter(rateLimitWindowMinutes, rateLimitMax);
app.use('/api', speedLimiter, apiLimiter);

const PORT = process.env.PORT || 5000;


//FOR PRODUCT-RELATED DATA
app.use('/api', itemRoutes);

//FOR USER-RELATED DATA
app.use('/api', userRoutes);

//FOR SALE-RELATED DATA
app.use('/api', saleRoutes)

//FOR DELIVERY-RELATED DATA
app.use('/api', deliveryRoutes)

// ANALYTICS (historical inventory + sales aggregates)
app.use('/api', analyticsRoutes);

//FOR PASSWORD RESET
app.use('/api', passwordResetRoutes);

//FOR PUSH NOTIFICATIONS
app.use('/api/push', pushNotificationRoutes);

//DEBUG ROUTES (REMOVE IN PRODUCTION)
if (process.env.NODE_ENV !== 'production') {
  app.use('/api/debug', debugRoutes);
  console.log('⚠️  Debug routes enabled at /api/debug');
}

//WEBSOCKET INTEGRATION
// STORE CURRNTLY CONNECTED USERS
const connectedUsers = new Map();

const fetchUserActivityContext = async (userIdInt) => {
  const { rows } = await SQLquery(
    "SELECT user_id, branch_id, first_name || ' ' || last_name AS full_name FROM Users WHERE user_id = $1",
    [userIdInt]
  );

  return rows[0] || null;
};

const getPrimaryBranchToken = (subscriber) => {
  if (!subscriber) return null;

  if (subscriber.branchId !== undefined && subscriber.branchId !== null && subscriber.branchId !== '') {
    return String(subscriber.branchId);
  }

  if (Array.isArray(subscriber.branchIds) && subscriber.branchIds.length > 0) {
    return String(subscriber.branchIds[0]);
  }

  return null;
};

const hasActiveSocketForUser = (userId, excludeSocketId = null) => {
  const comparison = String(userId);

  for (const [socketId, subscriber] of connectedUsers.entries()) {
    if (excludeSocketId && socketId === excludeSocketId) {
      continue;
    }

    if (subscriber.userType !== 'user') {
      continue;
    }

    if (String(subscriber.userId) === comparison) {
      return true;
    }
  }

  return false;
};

const updateUserActivityFromSocket = async ({ userId, fallbackBranchId = null, isActive, reason }) => {
  const userIdInt = parseInt(userId, 10);

  if (Number.isNaN(userIdInt)) {
    return null;
  }

  try {
    const context = await fetchUserActivityContext(userIdInt);

    if (!context) {
      return null;
    }

    await SQLquery("UPDATE Users SET is_active = $1 WHERE user_id = $2", [isActive, userIdInt]);

    const parsedFallback = (fallbackBranchId !== null && fallbackBranchId !== undefined && fallbackBranchId !== '')
      ? Number(fallbackBranchId)
      : null;

    const effectiveBranchId = context.branch_id ?? (parsedFallback !== null && !Number.isNaN(parsedFallback)
      ? parsedFallback
      : null);

    if (effectiveBranchId !== null && effectiveBranchId !== undefined) {
      broadcastUserStatusUpdate(effectiveBranchId, {
        action: isActive ? 'login' : 'logout',
        user_id: userIdInt,
        full_name: context.full_name,
        is_active: isActive,
        reason
      });
    }

    return context;
  } catch (error) {
    console.error(`Failed to update user ${userIdInt} activity from socket:`, error);
    return null;
  }
};

const normalizeRoles = (roles) => {
  if (!roles) return [];
  const arrayRoles = Array.isArray(roles) ? roles : [roles];
  return [...new Set(arrayRoles
    .map(role => typeof role === 'string' ? role.trim() : role)
    .filter(Boolean))];
};

const normalizeBranchIds = (branchId, branchIds) => {
  const collected = [];

  if (Array.isArray(branchIds)) {
    collected.push(...branchIds);
  } else if (branchIds !== undefined && branchIds !== null && branchIds !== '') {
    collected.push(branchIds);
  }

  if (branchId !== undefined && branchId !== null && branchId !== '') {
    collected.push(branchId);
  }

  return [...new Set(collected
    .map(value => {
      if (value === null || value === undefined || value === '') return null;
      const numeric = Number(value);
      return Number.isNaN(numeric) ? String(value) : String(numeric);
    })
    .filter(Boolean))];
};

const matchesBranch = (subscriber, branchId) => {
  if (branchId === null || branchId === undefined) {
    return true;
  }

  const branchToken = String(branchId);
  const branchPool = (Array.isArray(subscriber.branchIds) && subscriber.branchIds.length > 0)
    ? subscriber.branchIds
    : (subscriber.branchId !== undefined && subscriber.branchId !== null
        ? [String(subscriber.branchId)]
        : []);

  if (subscriber.userType === 'admin' && branchPool.length === 0) {
    return true;
  }

  return branchPool.includes(branchToken);
};

const shouldDispatchNotification = (subscriber, { category, branchId, targetRoles }) => {
  if (!subscriber) return false;

  const roles = normalizeRoles(subscriber.roles);
  if (roles.length === 0) return false;

  if (!matchesBranch(subscriber, branchId)) {
    return false;
  }

  if (targetRoles && targetRoles.length > 0) {
    return targetRoles.some(role => roles.includes(role));
  }

  if (roles.includes('Owner') && category !== 'account-approval') {
    return false;
  }

  switch (category) {
    case 'inventory':
      return roles.includes('Branch Manager') || roles.includes('Inventory Staff');
    case 'sales':
      return roles.includes('Sales Associate');
    case 'account-approval':
      return roles.includes('Owner');
    default:
      return true;
  }
};

const extractTargetRoles = (notification, options = {}) => {
  const candidate = options.targetRoles
    ?? options.target_roles
    ?? notification?.target_roles
    ?? notification?.targetRoles;

  if (!candidate) return null;
  const normalized = normalizeRoles(candidate);
  return normalized.length > 0 ? normalized : null;
};

const dispatchRoleBasedNotification = ({ branchId = null, notification, category = 'inventory', targetRoles = null, excludeUserId = null }) => {
  const normalizedCategory = category;
  const normalizedTargetRoles = targetRoles ? normalizeRoles(targetRoles) : null;

  for (const [socketId, subscriber] of connectedUsers.entries()) {
    if (excludeUserId && String(subscriber.userId) === String(excludeUserId)) {
      continue;
    }
    if (shouldDispatchNotification(subscriber, {
      category: normalizedCategory,
      branchId,
      targetRoles: normalizedTargetRoles
    })) {
      io.to(socketId).emit('new-notification', notification);
    }
  }
};

// CONNECTION HANCLE FOR WEB SOCKET
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // User joins with their branch and user information
  socket.on('join-branch', async (userData = {}) => {
    const {
      userId,
      adminId,
      branchId = null,
      branchIds = null,
      role,
      roles,
      userType = 'user'
    } = userData;

    const normalizedRoles = normalizeRoles(roles ?? role);
    let normalizedBranchIds = normalizeBranchIds(branchId, branchIds);
    const entityType = userType === 'admin' ? 'admin' : 'user';
    const entityId = entityType === 'admin' ? (adminId ?? userId) : userId;

    if (entityId === undefined || entityId === null) {
      console.warn('Socket attempted to join without valid identifier', userData);
      return;
    }

    const subscriberData = {
      userId: entityId,
      userType: entityType,
      roles: normalizedRoles,
      branchIds: normalizedBranchIds,
      branchId: normalizedBranchIds[0] ?? (branchId !== null && branchId !== undefined ? String(branchId) : null),
      socketId: socket.id
    };

    if (entityType === 'user') {
      try {
        const context = await updateUserActivityFromSocket({
          userId: entityId,
          fallbackBranchId: subscriberData.branchId,
          isActive: true,
          reason: 'socket-connect'
        });

        if (context?.branch_id !== undefined && context.branch_id !== null) {
          const branchToken = String(context.branch_id);
          if (!normalizedBranchIds.includes(branchToken)) {
            normalizedBranchIds = [branchToken];
          }
          subscriberData.branchIds = normalizedBranchIds;
          subscriberData.branchId = branchToken;
        }

        if (context?.full_name) {
          subscriberData.fullName = context.full_name;
        }
      } catch (error) {
        console.error(`Socket connect activity update failed for user ${entityId}:`, error);
      }
    }

    connectedUsers.set(socket.id, subscriberData);

    if (subscriberData.branchIds.length > 0) {
      subscriberData.branchIds.forEach(id => socket.join(`branch-${id}`));
    } else if (subscriberData.branchId !== null && subscriberData.branchId !== undefined && subscriberData.branchId !== '') {
      socket.join(`branch-${subscriberData.branchId}`);
    }

    if (normalizedRoles.includes('Owner')) {
      socket.join('owners');
    }

    console.log(`User ${entityId} (${entityType}) connected with roles [${normalizedRoles.join(', ')}]${subscriberData.branchIds.length ? ` on branches [${subscriberData.branchIds.join(', ')}]` : ''}`);
  });


  socket.on('disconnect', async () => {
    console.log('User disconnected:', socket.id);
    const subscriber = connectedUsers.get(socket.id);
    connectedUsers.delete(socket.id);

    if (!subscriber || subscriber.userType !== 'user') {
      return;
    }

    const stillConnected = hasActiveSocketForUser(subscriber.userId);
    if (stillConnected) {
      return;
    }

    const fallbackBranchId = getPrimaryBranchToken(subscriber);
    await updateUserActivityFromSocket({
      userId: subscriber.userId,
      fallbackBranchId,
      isActive: false,
      reason: 'socket-disconnect'
    });
  });
});




// BROADCAST NOTIFICATION TO ALL USERS BASE ON BRANCH
export const broadcastNotification = (branchId, notification, options = {}) => {
  const category = options.category ?? notification?.category ?? 'inventory';
  const targetRoles = extractTargetRoles(notification, options);

  dispatchRoleBasedNotification({
    branchId,
    notification,
    category,
    targetRoles,
    excludeUserId: options.excludeUserId
  });
};


// BROADCAST A NOTIFICATION TO ALL OWNERS (CROSS-BRANCH)
export const broadcastOwnerNotification = (notification, options = {}) => {
  const targetRoles = extractTargetRoles(notification, options) ?? ['Owner'];

  dispatchRoleBasedNotification({
    branchId: options.branchId ?? null,
    notification,
    category: 'account-approval',
    targetRoles
  });
};



// BROADCAST INVENTORY UPDATE TO ALL USERS IN BRANCH
export const broadcastInventoryUpdate = (branchId, inventoryData) => {
  io.to(`branch-${branchId}`).emit('inventory-update', inventoryData);
  // Also notify all Owners (cross-branch aggregate views)
  io.to('owners').emit('inventory-update', { ...inventoryData, __source_branch_id: branchId });
};



// BROADCAST PRODUCT VALIDITY UPDATE TO ALL USERS IN BRANCH
export const broadcastValidityUpdate = (branchId, validityData) => {
  io.to(`branch-${branchId}`).emit('validity-update', validityData);
  // Also notify Owners for aggregate monitoring
  io.to('owners').emit('validity-update', { ...validityData, __source_branch_id: branchId });
};



// BROADCAST PRODUCT HISTORY UPDATE TO ALL USERS IN BRANCH
export const broadcastHistoryUpdate = (branchId, historyData) => {
  io.to(`branch-${branchId}`).emit('history-update', historyData);
};

// BROADCAST SALES UPDATE TO ALL USERS IN BRANCH
export const broadcastSaleUpdate = (branchId, saleData) => {
  io.to(`branch-${branchId}`).emit('sale-update', saleData);
  // Also notify Owners for cross-branch analytics
  io.to('owners').emit('sale-update', { ...saleData, __source_branch_id: branchId });
};



// BROADCAST USER MANAGEMENT UPDATE TO ALL USERS IN BRANCH
export const broadcastUserUpdate = (branchId, userData) => {
  console.log(`Broadcasting user update to branch-${branchId}:`, userData);
  io.to(`branch-${branchId}`).emit('user-update', userData);
  // also notify all owners so they can see updates across branches
  io.to('owners').emit('user-update', userData);
};



// BROADCAST USER STATUS UPDATE (LOGIN/LOGOUT) TO ALL USERS IN BRANCH
export const broadcastUserStatusUpdate = (branchId, statusData) => {
  console.log(`Broadcasting user status update to branch-${branchId}:`, statusData);
  io.to(`branch-${branchId}`).emit('user-status-update', statusData);
  // also notify owners
  io.to('owners').emit('user-status-update', statusData);
};



// SENDS NOTIFICATION TO SPECIFIC USER
export const broadcastToUser = async (userId, notification, options = {}) => {
  const targetType = options.userType ?? 'user';

  // Persist notification to database if requested
  if (options.persist !== false) { // Default to true for persistence
    try {
      // Get user's branch information for persistence
      let userBranchId = null;
      if (targetType === 'user') {
        const userResult = await SQLquery(
          'SELECT branch_id FROM Users WHERE user_id = $1',
          [userId]
        );
        if (userResult.rows.length > 0) {
          userBranchId = userResult.rows[0].branch_id;
        }
      }

      if (userBranchId) {
        const persistedNotification = await createSystemInventoryNotification({
          productId: notification.product_id || null,
          branchId: userBranchId,
          alertType: notification.alert_type || notification.type || 'System Notification',
          message: notification.message,
          bannerColor: notification.banner_color || 'blue',
          targetUserId: userId
        });

        // Update notification with persisted data
        notification.alert_id = persistedNotification.alert_id;
        notification.alert_date = persistedNotification.alert_date;
        notification.isDateToday = true;
        notification.alert_date_formatted = 'Just now';
      }
    } catch (error) {
      console.error('Failed to persist notification for user', userId, ':', error);
      // Continue with broadcasting even if persistence fails
    }
  }

  // Broadcast to connected user
  for (const [socketId, userData] of connectedUsers) {
    if (userData.userType === targetType && String(userData.userId) === String(userId)) {
      io.to(socketId).emit('new-notification', notification);
      break;
    }
  }
};

export const broadcastInventoryApprovalRequest = (branchId, payload) => {
  io.to(`branch-${branchId}`).emit('inventory-approval-request', payload);
};

export const broadcastInventoryApprovalRequestToOwners = (payload) => {
  io.to('owners').emit('inventory-approval-request-admin', payload);
};

export const broadcastInventoryApprovalUpdate = (branchId, payload) => {
  io.to(`branch-${branchId}`).emit('inventory-approval-updated', payload);
  io.to('owners').emit('inventory-approval-updated', payload);
};

export const broadcastUserApprovalRequest = (branchId, payload) => {
  io.to(`branch-${branchId}`).emit('user-approval-request', payload);
  io.to('owners').emit('user-approval-request', payload);
};

export const broadcastUserApprovalUpdate = (branchId, payload) => {
  io.to(`branch-${branchId}`).emit('user-approval-updated', payload);
  io.to('owners').emit('user-approval-updated', payload);
};





server.listen(PORT, '0.0.0.0', async ()=>{
    console.log('Port '+ PORT + ' is currently running....' );
    
    // Initialize unit conversion cache
    try {
        await loadUnitConversionCache();
        console.log('✓ Unit conversion system initialized');
    } catch (error) {
        console.error('⚠ Failed to initialize unit conversion:', error.message);
        console.log('⚠ Fractional quantity features may not work until database migration is complete');
    }
});


app.get("/", (req, res) =>{
    res.send("hello from the backend");
})


//THIS NOTIFIES THE PRODUCT SHELFLIFE EVERY 12 AM
cron.schedule('55 3 * * *', async () => { 
  notifyProductShelfLife();
}, { timezone: "Asia/Manila" });