import express from 'express';
import * as itemControllers from '../Controllers/itemControllers.js';


const router = express.Router();


//INVENTORY CRUD
router.get("/items", itemControllers.getAllItems);
router.post("/items", itemControllers.addItem);
router.put("/items/:id", itemControllers.updateItem);
router.get("/items/search", itemControllers.searchItem);
router.get("/items/unique", itemControllers.getAllUniqueProducts);
router.get("/items/pending", itemControllers.getPendingInventoryRequests);
router.patch("/items/pending/:id/approve", itemControllers.approvePendingInventoryRequest);
router.patch("/items/pending/:id/reject", itemControllers.rejectPendingInventoryRequest);



//CATEGORY ROUTES
router.get("/categories", itemControllers.getAllCategories);
router.post("/categories", itemControllers.addCAtegory);
router.put("/categories/:id", itemControllers.updateCategory);



//PRODUCT HISTORY
router.post("/product_history", itemControllers.getAllProductHistory);



//GET FOR PRODUCT VALIDITY
router.get("/product_validity", itemControllers.getAllProductValidity);



//SHOW NOTIFICATIONSs
router.get("/notifications", itemControllers.getNotification);
router.post("/notifications", itemControllers.markRead);
router.post("/notifications/mark-all-read", itemControllers.markAllRead);



export default router;




