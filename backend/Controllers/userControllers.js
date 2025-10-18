import * as userDetails from '../Services/users/userDetails.js';
import * as userAuthentication from '../Services/users/userAuthentication.js';
import * as userCreation from '../Services/users/userCreation.js';
import * as disableEnableAccount from '../Services/users/disableEnableAccount.js';
import { SQLquery } from '../db.js';


export const getBranches = async (req, res) =>{
    try {
        const user = await userDetails.getAllBranches();
        res.status(200).json(user);
    } catch (error) {
        console.error('Error fetching branches: ', error);
        res.status(500).json({message: 'Internal Server Error'})
    }
}



export const getUsers = async (req, res) =>{
    try {
        const branchId = req.query.branch_id;
        const userId = req.query.user_id;
        const user = await userDetails.getAllUsers(branchId, userId);
        res.status(200).json(user);
    } catch (error) {
        console.error('Error fetching users: ', error);
        res.status(500).json({message: 'Internal Server Error'})
    }
}



export const userCredentials = async (req, res) =>{
    try {
        const loginCredentials = req.body;
        const result = await userAuthentication.userAuth(loginCredentials);
        
        // Check if authentication returned an error
        if (result.error) {
            return res.status(401).json({ error: result.error });
        }
        
        // Check if user data was returned
        if (result && result.length > 0) {
            return res.status(200).json(result);
        }
        
        // Handle edge case where no error or user data is returned
        return res.status(401).json({ error: 'Authentication failed' });
    } catch (error) {
        console.error('Error during authentication: ', error);
        res.status(500).json({message: 'Internal Server Error'})
    }
}




export const userLogout = async (req, res) =>{
    try {
        const userId = req.params.id
        const activity = req.body;
        const result = await userAuthentication.userLastLogout(userId, activity);
        res.status(200).json(result);
    } catch (error) {
        console.error('Error during user logout: ', error);
        res.status(500).json({message: 'Internal Server Error'})
    }
}




//CHECKING FOR EXISTING USERNAME
export const checkExistingAccount = async (req, res) =>{
    try {
        const username = req.query.username;
        const ifExisting = await userCreation.checkExistingUsername(username);
        res.status(200).json(ifExisting);
    } catch (error) {
        console.error('Error creating users: ', error);
        res.status(500).json({message: 'Internal Server Error'})
    }
}





//CREAING AN ACCOUNT
export const userCreationAccount = async (req, res) =>{
    try {
        const userData = req.body;
        const user = await userCreation.createUserAccount(userData);
        res.status(200).json(user);
    } catch (error) {
        console.error('Error creating users: ', error);
        res.status(500).json({message: 'Internal Server Error'})
    }
}



export const userUpdateAccount = async (req, res) =>{
    try {
        const userID = req.params.id;
        const userData = req.body;
        const user = await userCreation.updateUserAccount(userID, userData);
        res.status(200).json(user);
    } catch (error) {
        console.error('Error updating users: ', error);
        res.status(500).json({message: 'Internal Server Error'})
    }
}



export const approvePendingUser = async (req, res) => {
    try {
        const userID = req.params.id;
        const { approver_id, approverName, approver_roles } = req.body;

        let isOwner = false;

        if (approver_id) {
            const approver = await SQLquery('SELECT role FROM administrator WHERE admin_id = $1', [approver_id]);
            const rolesFromDb = approver.rows[0]?.role || [];
            isOwner = Array.isArray(rolesFromDb) ? rolesFromDb.includes('Owner') : rolesFromDb === 'Owner';
        }

        //FALLBACK IF THERE IS NO USER ID BUT THERE IS A ROLE
        if (!isOwner && Array.isArray(approver_roles)) {
            isOwner = approver_roles.includes('Owner');
        }

        if (!isOwner) {
            return res.status(403).json({ message: 'Only owners can approve accounts' });
        }

        const user = await userCreation.approvePendingUser(userID, approver_id ?? null, approverName ?? null);
        res.status(200).json(user);
    } catch (error) {
        console.error('Error approving user: ', error);
        const statusCode = error.message === 'User not found or already processed' ? 400 : 500;
        res.status(statusCode).json({message: error.message || 'Internal Server Error'});
    }
};



//DELETING AN ACCOUNT
export const userDeletionAccount = async (req, res) =>{
    try {
        const userID = req.params.id;
        
        // GET USER'S BRANCH ID BEFORE DELETION FOR WEBSOCKET BROADCAST
        const { rows } = await SQLquery('SELECT branch_id FROM Users WHERE user_id = $1', [userID]);
        const branchId = rows[0]?.branch_id;
        
        const user = await userCreation.deleteUser(userID, branchId);
        res.status(200).json(user);
    } catch (error) {
        console.error('Error to delete a user: ', error);
        res.status(500).json({message: 'Internal Server Error'})
    }
}



//DISABLING AND ENABLING AN ACCOUNT WITH OWNER CONTROLL
export const disableStatus = async (req, res) =>{
    try {
        const userID = req.params.id;
        const status = req.body.isDisabled;
        const user = await disableEnableAccount.disableEnableAccount(userID, status);
        res.status(200).json(user);
    } catch (error) {
        console.error('Error to disable/enable a user: ', error);
        res.status(500).json({message: 'Internal Server Error'})
    }
}



//DISABLING AN ACCOUNT WITH OWNER CONTROLL
export const disableStatusOnAttempt = async (req, res) =>{
    try {
        const username = req.params.username;
        const status = req.body.isDisabled;
        const user = await disableEnableAccount.disableAccountOnAttempt(username, status);
        res.status(200).json(user);
    } catch (error) {
        console.error('Error to disable/enable a user: ', error);
        res.status(500).json({message: 'Internal Server Error'})
    }
}



//CHECK USER STATUS
export const checkUserStatus = async (req, res) =>{
    try {
        const userId = req.params.id;
        const result = await SQLquery('SELECT user_id, is_disabled FROM Users WHERE user_id = $1', [userId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({message: 'User not found'});
        }
        
        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error('Error checking user status: ', error);
        res.status(500).json({message: 'Internal Server Error'})
    }
}
