import express from 'express';
import * as itemControllers from '../Controllers/itemControllers.js';


const router = express.Router();

router.get("/items", itemControllers.getAllItems);
router.post("/items", itemControllers.addItem);
router.put("/items/:id", itemControllers.updateItem);


export default router;




