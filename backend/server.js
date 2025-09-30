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
import cron from "node-cron";
import { notifyProductShelfLife } from './Services/Services_Utils/productValidityNotification.js';

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



//WEBSOCKET INTEGRATION
// STORE CURRNTLY CONNECTED USERS
const connectedUsers = new Map();

// CONNECTION HANCLE FOR WEB SOCKET
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // User joins with their branch and user information
  socket.on('join-branch', (userData) => {
    const { userId, branchId, role } = userData;

    
    // Store user information with socket ID
    connectedUsers.set(socket.id, {
      userId,
      branchId,
      role,
      socketId: socket.id
    });

    // Join branch-specific room
    socket.join(`branch-${branchId}`);
    
    console.log(`User ${userId} joined branch ${branchId}`);
  });


  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    connectedUsers.delete(socket.id);
  });
});




// BROADCAST NOTIFICATION TO ALL USERS BASE ON BRANCH
export const broadcastNotification = (branchId, notification) => {
  io.to(`branch-${branchId}`).emit('new-notification', notification);
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
};



// BROADCAST USER STATUS UPDATE (LOGIN/LOGOUT) TO ALL USERS IN BRANCH
export const broadcastUserStatusUpdate = (branchId, statusData) => {
  console.log(`Broadcasting user status update to branch-${branchId}:`, statusData);
  io.to(`branch-${branchId}`).emit('user-status-update', statusData);
};



// SENDS NOTIFICATION TO SPECIFIC USER
export const broadcastToUser = (userId, notification) => {
  for (const [socketId, userData] of connectedUsers) {
    if (userData.userId === userId) {
      io.to(socketId).emit('new-notification', notification);
      break;
    }
  }
};





server.listen(PORT, '0.0.0.0', async ()=>{
    console.log('Port '+ PORT + ' is currently running....' )
});


app.get("/", (req, res) =>{
    res.send("hello from the backend");
})


//THIS NOTIFIES THE PRODUCT SHELFLIFE EVERY 12 AM
cron.schedule('00 00 * * *', async () => { 
  notifyProductShelfLife();
}, { timezone: "Asia/Manila" });