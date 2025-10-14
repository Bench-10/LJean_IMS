import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import itemRoutes from './Routes/itemRoutes.js';
import userRoutes from './Routes/userRoutes.js';
import saleRoutes from './Routes/saleRoutes.js';
import analyticsRoutes from './Routes/analyticsRoutes.js';
import deliveryRoutes from './Routes/deliveryRoutes.js';
import passwordResetRoutes from './Routes/passwordResetRoutes.js';
import cron from "node-cron";
import { notifyProductShelfLife } from './Services/Services_Utils/productValidityNotification.js';
import { loadUnitConversionCache } from './Services/Services_Utils/unitConversion.js';

const app  = express();

//CONNECTS THE SERVER TO THE FRONTEND
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", //CHANGE THIS WHEN ITS TIME FOR HOSTING
    methods: ["GET", "POST"]
  }
});

dotenv.config();

app.use(cors({
  origin: "*", 
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  credentials: true
}));

app.use(express.json());

const PORT = process.env.PORT;





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



//WEBSOCKET INTEGRATION
// STORE CURRNTLY CONNECTED USERS
const connectedUsers = new Map();

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

const dispatchRoleBasedNotification = ({ branchId = null, notification, category = 'inventory', targetRoles = null }) => {
  const normalizedCategory = category;
  const normalizedTargetRoles = targetRoles ? normalizeRoles(targetRoles) : null;

  for (const [socketId, subscriber] of connectedUsers.entries()) {
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
  socket.on('join-branch', (userData = {}) => {
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
    const normalizedBranchIds = normalizeBranchIds(branchId, branchIds);
    const entityType = userType === 'admin' ? 'admin' : 'user';
    const entityId = entityType === 'admin' ? (adminId ?? userId) : userId;

    if (entityId === undefined || entityId === null) {
      console.warn('Socket attempted to join without valid identifier', userData);
      return;
    }

    connectedUsers.set(socket.id, {
      userId: entityId,
      userType: entityType,
      roles: normalizedRoles,
      branchIds: normalizedBranchIds,
      branchId: normalizedBranchIds[0] ?? (branchId !== null && branchId !== undefined ? String(branchId) : null),
      socketId: socket.id
    });

    if (normalizedBranchIds.length > 0) {
      normalizedBranchIds.forEach(id => socket.join(`branch-${id}`));
    } else if (branchId !== null && branchId !== undefined && branchId !== '') {
      socket.join(`branch-${branchId}`);
    }

    if (normalizedRoles.includes('Owner')) {
      socket.join('owners');
    }

    console.log(`User ${entityId} (${entityType}) connected with roles [${normalizedRoles.join(', ')}]${normalizedBranchIds.length ? ` on branches [${normalizedBranchIds.join(', ')}]` : ''}`);
  });


  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    connectedUsers.delete(socket.id);
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
    targetRoles
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
};



// BROADCAST PRODUCT VALIDITY UPDATE TO ALL USERS IN BRANCH
export const broadcastValidityUpdate = (branchId, validityData) => {
  io.to(`branch-${branchId}`).emit('validity-update', validityData);
};



// BROADCAST PRODUCT HISTORY UPDATE TO ALL USERS IN BRANCH
export const broadcastHistoryUpdate = (branchId, historyData) => {
  io.to(`branch-${branchId}`).emit('history-update', historyData);
};

// BROADCAST SALES UPDATE TO ALL USERS IN BRANCH
export const broadcastSaleUpdate = (branchId, saleData) => {
  io.to(`branch-${branchId}`).emit('sale-update', saleData);
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
export const broadcastToUser = (userId, notification, options = {}) => {
  const targetType = options.userType ?? 'user';
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
cron.schedule('39 15 * * *', async () => { 
  notifyProductShelfLife();
}, { timezone: "Asia/Manila" });