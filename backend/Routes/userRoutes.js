import express from 'express';
import * as userControllers from '../Controllers/userControllers.js';

const router = express.Router();


//GETTING USERS
router.get("/users", userControllers.getUsers);


//USER AUTHENTICATION
router.post("/authentication", userControllers.userCredentials);


export default router;