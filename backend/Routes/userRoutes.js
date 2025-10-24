import express from 'express';
import * as userControllers from '../Controllers/userControllers.js';
import { loginLimiter, accountCreationLimiter } from '../middleware/rateLimiters.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

//GET CURRENT USER INFO (from JWT token - cannot be faked)
router.get("/me", authenticate, userControllers.getCurrentUser);

//GETTING BRANCHES
router.get("/branches", authenticate, userControllers.getBranches);

//GETTING USERS
router.get("/users", authenticate, requireRole('Owner', 'Branch Manager'), userControllers.getUsers);


//USER AUTHENTICATION
router.post("/authentication", loginLimiter, userControllers.userCredentials);


//USER LOGOUT
router.put("/authentication/:id", authenticate, userControllers.userLogout);


//CHECK IF USERNAME IS ALREADY IN THE DATABASE
router.get("/existing_account", userControllers.checkExistingAccount);


//USER CREATION
router.post("/create_account", accountCreationLimiter, userControllers.userCreationAccount);


//USER ACCOUNT UPDATE
router.put("/update_account/:id", authenticate, requireRole('Owner', 'Branch Manager'), userControllers.userUpdateAccount);


//APPROVE PENDING USER ACCOUNT
router.patch("/users/:id/approval", authenticate, requireRole('Owner'), userControllers.approvePendingUser);


//USER DELETION
router.delete("/delete_account/:id", authenticate, requireRole('Owner', 'Branch Manager'), userControllers.userDeletionAccount);


//DIABLE/ENABLE USER ACCOUNT
router.put("/disable/:id", authenticate, requireRole('Owner', 'Branch Manager'), userControllers.disableStatus);


//DIABLE/ENABLE USER ACCOUNT ON TOO MANY LOGIN ATTEMPTS
router.put("/disable_on_attempt/:username", userControllers.disableStatusOnAttempt);


//CHECK USER STATUS
router.get("/user_status/:id", authenticate, userControllers.checkUserStatus);


export default router;