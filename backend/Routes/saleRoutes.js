import express from 'express';
import * as saleControllers from '../Controllers/saleControllers.js';

const router = express.Router();


//GETTING BRANCHES
router.get("/sale", saleControllers.getAllSaleInformation);


//GETTING USERS
router.post("/add_sale", saleControllers.addSaleInformation);




export default router;