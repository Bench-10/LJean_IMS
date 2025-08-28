import express from 'express';
import * as deliveryCoantrollers from '../Controllers/deliveryControllers.js';

const router = express.Router();


//GET DELIVERY DATA
router.get("/delivery", deliveryCoantrollers.getDeliveries);


//ADDS DELIVERY DATA
router.post("/delivery", deliveryCoantrollers.addDeliveries);


//SET TO DELIVERED DATA
router.put("/delivery/:id", deliveryCoantrollers.updateDeliveries);





export default router
