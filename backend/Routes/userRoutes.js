import express from 'express';
import * as userControllers from '../Controllers/userControllers.js';

const router = express.Router();


//GETTING BRANCHES
router.get("/branches", userControllers.getBranches);


//GETTING USERS
router.get("/users", userControllers.getUsers);


//USER AUTHENTICATION
router.post("/authentication", userControllers.userCredentials);


//USER LOGOUT
router.put("/authentication/:id", userControllers.userLogout);


//CHECK IF USERNAME IS ALREADY IN THE DATABASE
router.get("/existing_account", userControllers.checkExistingAccount);


//USER CREATION
router.post("/create_account", userControllers.userCreationAccount);


//USER ACCOUNT UPDATE
router.put("/update_account/:id", userControllers.userUpdateAccount);


//USER DELETION
router.delete("/delete_account/:id", userControllers.userDeletionAccount);


//DIABLE/ENABLE USER ACCOUNT USING ADMIN 
router.put("/disable/:id", userControllers.disableStatus);


//DIABLE/ENABLE USER ACCOUNT
router.put("/disable_on_attempt/:username", userControllers.disableStatusOnAttempt);


//CHECK USER STATUS
router.get("/user_status/:id", userControllers.checkUserStatus);


export default router;