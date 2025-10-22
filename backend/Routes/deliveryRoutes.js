import express from 'express';
import * as deliveryCoantrollers from '../Controllers/deliveryControllers.js';
import { writeOperationLimiter } from '../middleware/rateLimiters.js';

const router = express.Router();


//GET DELIVERY DATA
router.get("/delivery", deliveryCoantrollers.getDeliveries);


//ADDS DELIVERY DATA
router.post("/delivery", writeOperationLimiter, deliveryCoantrollers.addDeliveries);


//SET TO DELIVERED DATA
router.put("/delivery/:id", writeOperationLimiter, deliveryCoantrollers.updateDeliveries);

//TEST DELIVERY NOTIFICATIONS
router.get("/delivery/test/notifications", deliveryCoantrollers.testDeliveryNotifications);





export default router
