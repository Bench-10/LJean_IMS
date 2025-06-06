import express from 'express';
import * as itemControllers from '../Controllers/itemControllers.js';


const router = express.Router();

router.get("/items", itemControllers.getAllItems);
router.post("/items", itemControllers.addItem);
router.put("/items/:id", itemControllers.updateItem);
router.get("/items/search", itemControllers.searchItem);


export default router;




