import express from 'express';
import * as itemControllers from '../Controllers/itemControllers.js';


const router = express.Router();

router.get("/items", itemControllers.getAllItems);

export default router;




