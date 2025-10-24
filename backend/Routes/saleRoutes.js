import express from 'express';
import * as saleControllers from '../Controllers/saleControllers.js';
import { writeOperationLimiter } from '../middleware/rateLimiters.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();


//GETTING SALE
router.get("/sale", authenticate, requireRole('Sales Associate'), saleControllers.getAllSaleInformation);


//GETTING SALE ITEMS
router.get("/sale_items", authenticate, requireRole('Sales Associate'), saleControllers.getAllSaleItems);


//ADDING A SALE
router.post("/sale", authenticate, requireRole('Sales Associate'), writeOperationLimiter, saleControllers.addSaleInformation);




export default router;