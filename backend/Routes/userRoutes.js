import express from 'express';
import * as userControllers from '../Controllers/userControllers.js';

const router = express.Router();


//GETTING BRANCHES
router.get("/branches", userControllers.getBranches);


//GETTING USERS
router.get("/users", userControllers.getUsers);


//USER AUTHENTICATION
router.post("/authentication", userControllers.userCredentials);


//USER CREATION
router.post("/create_account", userControllers.userCreationAccount);


export default router;