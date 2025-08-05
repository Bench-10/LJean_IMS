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


//USER ACCOUNT UPDATE
router.put("/update_account/:id", userControllers.userUpdateAccount);


//USER DELETION
router.delete("/delete_account/:id", userControllers.userDeletionAccount);


export default router;