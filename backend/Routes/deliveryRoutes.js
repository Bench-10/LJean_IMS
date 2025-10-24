import express from 'express';
import * as deliveryCoantrollers from '../Controllers/deliveryControllers.js';
import { writeOperationLimiter } from '../middleware/rateLimiters.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();


//GET DELIVERY DATA
router.get("/delivery", authenticate, requireRole('Sales Associate'), deliveryCoantrollers.getDeliveries);


//ADDS DELIVERY DATA
router.post("/delivery", authenticate, requireRole('Sales Associate'), writeOperationLimiter, deliveryCoantrollers.addDeliveries);


//SET TO DELIVERED DATA
router.put("/delivery/:id", authenticate, requireRole('Sales Associate'), writeOperationLimiter, deliveryCoantrollers.updateDeliveries);

//TEST DELIVERY NOTIFICATIONS
router.get("/delivery/test/notifications", authenticate, requireRole('Sales Associate'), deliveryCoantrollers.testDeliveryNotifications);





export default router
