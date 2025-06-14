import express from 'express';
import * as itemControllers from '../Controllers/itemControllers.js';


const router = express.Router();


//INVENTORY CRUD
router.get("/items", itemControllers.getAllItems);
router.post("/items", itemControllers.addItem);
router.put("/items/:id", itemControllers.updateItem);
router.get("/items/search", itemControllers.searchItem);



//CATEGORY ROUTES
router.get("/categories", itemControllers.getAllCategories);
router.post("/categories", itemControllers.addCAtegory);
router.put("/categories/:id", itemControllers.updateCategory);



//PRODUCT HISTORY
router.get("/product_history", itemControllers.getAllProductHistory);



export default router;




