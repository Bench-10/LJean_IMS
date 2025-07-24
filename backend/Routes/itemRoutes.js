import express from 'express';
import * as itemControllers from '../Controllers/itemControllers.js';
import * as userControllers from '../Controllers/userControllers.js';


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
router.post("/product_history", itemControllers.getAllProductHistory);



//GET FOR PRODUCT VALIDITY
router.get("/product_validity", itemControllers.getAllProductValidity);



//SHOW NOTIFICATIONS
router.get("/notifications", itemControllers.getNotification);




export default router;




