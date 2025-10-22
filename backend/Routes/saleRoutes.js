import express from 'express';
import * as saleControllers from '../Controllers/saleControllers.js';
import { writeOperationLimiter } from '../middleware/rateLimiters.js';

const router = express.Router();


//GETTING SALE
router.get("/sale", saleControllers.getAllSaleInformation);


//GETTING SALE
router.get("/sale_items", saleControllers.getAllSaleItems);


//ADDING A SALE
router.post("/sale", writeOperationLimiter, saleControllers.addSaleInformation);




export default router;