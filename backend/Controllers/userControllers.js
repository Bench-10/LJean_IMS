import * as userDetails from '../Services/users/userDetails.js';
import * as userAuthentication from '../Services/users/userAuthentication.js';
import * as userCreation from '../Services/users/userCreation.js';
import * as disableEnableAccount from '../Services/users/disableEnableAccount.js';
import * as adminAccount from '../Services/users/adminAccount.js';
import { SQLquery } from '../db.js';
import { generateToken } from '../utils/jwt.js';
import { getTokenCookieName, getTokenCookieOptions } from '../utils/authCookies.js';
import { decodeHashedPassword } from '../Services/Services_Utils/passwordHashing.js';


// GET CURRENT USER FROM JWT (CANNOT BE FAKED - READS FROM DATABASE)
export const getCurrentUser = async (req, res) => {
    try {
        // req.user is populated by authenticate middleware
        // Fetch full user details with branch info to match login response structure
        if (req.user.user_type === 'admin') {
            // Admin user - return basic info
            return res.status(200).json({
                admin_id: req.user.admin_id,
                user_id: req.user.admin_id,
                role: req.user.role,
                first_name: req.user.first_name,
                last_name: req.user.last_name,
                full_name: `${req.user.first_name} ${req.user.last_name}`,
                username: req.user.username,
                email: req.user.username,
                user_type: 'admin'
            });
        }

        // Regular user - fetch complete details with branch info
        const userData = await SQLquery(
            `SELECT u.user_id, u.branch_id, b.branch_name, b.address, u.role, 
                    u.first_name || ' ' || u.last_name AS full_name, 
                    u.cell_number, u.hire_date, b.telephone_num, b.cellphone_num, b.branch_email
             FROM Users u
             JOIN Branch b ON u.branch_id = b.branch_id
             WHERE u.user_id = $1`,
            [req.user.user_id]
        );

        if (!userData.rows.length) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.status(200).json(userData.rows[0]);
    } catch (error) {
        console.error('Error fetching current user:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};


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
            const user = result[0];
            
            const token = generateToken(user);
            const cookieName = getTokenCookieName();
            const cookieOptions = getTokenCookieOptions();

            res.cookie(cookieName, token, cookieOptions);

            return res.status(200).json({
                user,
                expiresInMs: cookieOptions.maxAge
            });
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
        const cookieName = getTokenCookieName();
        res.clearCookie(cookieName, getTokenCookieOptions());
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



export const updateOwnerCredentials = async (req, res) => {
    try {
        if (!req.user || req.user.user_type !== 'admin') {
            return res.status(403).json({ message: 'Only owners can update these settings.' });
        }

        const adminId = Number(req.user.admin_id ?? req.user.id ?? req.user.user_id ?? null);
        if (!Number.isFinite(adminId)) {
            return res.status(400).json({ message: 'Invalid administrator account.' });
        }

        const payload = req.body ?? {};
        const rawEmail = typeof payload.email === 'string' ? payload.email.trim() : '';
        const currentPassword = typeof payload.currentPassword === 'string' ? payload.currentPassword : '';
        const newPassword = typeof payload.newPassword === 'string' ? payload.newPassword : '';

        if (!currentPassword) {
            return res.status(400).json({ message: 'Current password is required.' });
        }

        const adminLookup = await SQLquery(
            'SELECT username, password FROM Administrator WHERE admin_id = $1 LIMIT 1',
            [adminId]
        );

        if (!adminLookup.rows.length) {
            return res.status(404).json({ message: 'Administrator account not found.' });
        }

        const { username: storedUsername = '', password: existingPasswordHash } = adminLookup.rows[0];

        const effectiveCurrentUsername = req.user.username || storedUsername || '';
        const wantsEmailChange = Boolean(rawEmail) && rawEmail !== effectiveCurrentUsername;
        const wantsPasswordChange = Boolean(newPassword);

        if (!wantsEmailChange && !wantsPasswordChange) {
            return res.status(400).json({ message: 'No changes submitted.' });
        }

        const passwordValid = await decodeHashedPassword(currentPassword, existingPasswordHash);
        if (!passwordValid) {
            return res.status(400).json({ message: 'Current password is incorrect.' });
        }

        if (wantsEmailChange) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(rawEmail)) {
                return res.status(400).json({ message: 'Please enter a valid email address.' });
            }

            const duplicateCheck = await SQLquery(
                'SELECT 1 FROM Administrator WHERE LOWER(username) = LOWER($1) AND admin_id <> $2',
                [rawEmail, adminId]
            );

            if (duplicateCheck.rowCount > 0) {
                return res.status(409).json({ message: 'Email is already in use.' });
            }
        }

        if (wantsPasswordChange) {
            if (newPassword.trim().length < 8) {
                return res.status(400).json({ message: 'New password must be at least 8 characters long.' });
            }

            const passwordRequirements = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
            if (!passwordRequirements.test(newPassword)) {
                return res.status(400).json({ message: 'New password must include letters, numbers, and a special character.' });
            }

            const sameAsOld = await decodeHashedPassword(newPassword, existingPasswordHash);
            if (sameAsOld) {
                return res.status(400).json({ message: 'New password must be different from the current password.' });
            }
        }

        const updated = await adminAccount.updateAdminCredentials({
            adminId,
            email: wantsEmailChange ? rawEmail : null,
            newPassword: wantsPasswordChange ? newPassword : null
        });

        if (!updated) {
            return res.status(500).json({ message: 'Failed to update account settings.' });
        }

        const fullName = `${updated.first_name ?? ''} ${updated.last_name ?? ''}`.replace(/\s+/g, ' ').trim();

        return res.status(200).json({
            admin_id: updated.admin_id,
            username: updated.username,
            email: updated.username,
            role: updated.role,
            first_name: updated.first_name,
            last_name: updated.last_name,
            full_name: fullName,
            message: 'Account settings updated successfully.'
        });
    } catch (error) {
        console.error('Error updating owner credentials:', error);
        return res.status(500).json({ message: 'Unable to update account settings right now.' });
    }
};



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


export const rejectPendingUser = async (req, res) => {
    try {
        const userID = req.params.id;
        const { admin_id, approver_roles, reason, approverName } = req.body;

        let isOwner = false;

        if (admin_id) {
            const approver = await SQLquery('SELECT role FROM administrator WHERE admin_id = $1', [admin_id]);
            const rolesFromDb = approver.rows[0]?.role || [];
            isOwner = Array.isArray(rolesFromDb) ? rolesFromDb.includes('Owner') : rolesFromDb === 'Owner';
        }

        if (!isOwner && Array.isArray(approver_roles)) {
            isOwner = approver_roles.includes('Owner');
        }

        if (!isOwner) {
            return res.status(403).json({ message: 'Only owners can reject accounts' });
        }

        const result = await userCreation.rejectPendingUser(userID, admin_id ?? null, approverName ?? null, { reason: reason ?? null });
        res.status(200).json(result);
    } catch (error) {
        console.error('Error rejecting user: ', error);
        const statusCode = error.message === 'User not found or already processed' ? 400 : 500;
        res.status(statusCode).json({ message: error.message || 'Internal Server Error' });
    }
};


export const cancelPendingUserRequest = async (req, res) => {
    try {
        const userID = req.params.id;
        const reason = req.body?.reason ?? null;

        const actor = req.user;

        if (!actor) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const roles = Array.isArray(actor.role) ? actor.role : actor.role ? [actor.role] : [];
        const isOwner = roles.includes('Owner');
        const isBranchManager = roles.includes('Branch Manager');

        if (!isOwner && !isBranchManager) {
            return res.status(403).json({ message: 'Only branch managers can cancel requests' });
        }

        const cancellerId = isOwner && actor.user_type === 'admin'
            ? Number(actor.admin_id)
            : Number(actor.user_id);

        if (!Number.isFinite(cancellerId)) {
            return res.status(400).json({ message: 'Unable to resolve cancelling user' });
        }

        const result = await userCreation.cancelPendingUserRequest(
            userID,
            cancellerId,
            {
                reason,
                actorType: isOwner ? 'admin' : 'user'
            }
        );

        res.status(200).json(result);
    } catch (error) {
        console.error('Error cancelling user request: ', error);
        const statusMap = {
            'User not found or already processed': 400,
            'You can only cancel requests that you submitted': 403,
            'Invalid user id': 400,
            'Invalid canceller id': 400,
            'Canceller id is required': 400
        };
        const statusCode = error?.statusCode ?? statusMap[error?.message] ?? 500;
        res.status(statusCode).json({ message: error?.message || 'Internal Server Error' });
    }
};


export const getUserCreationRequests = async (req, res) => {
    try {
        // Normalize roles from JWT
        const rawRoles = req.user?.role;
        const roles = Array.isArray(rawRoles) ? rawRoles : rawRoles ? [rawRoles] : [];
        const isOwner = roles.includes("Owner");
        const isBranchManager = roles.includes("Branch Manager");
        const isInventoryStaff = roles.includes("Inventory Staff");

        if (!isOwner && !isBranchManager && !isInventoryStaff) {
            return res.status(403).json({ message: "Access denied" });
        }

        // Determine fetch scope
        let scope = "user";
        if (isOwner) scope = "admin";
        else if (isBranchManager) scope = "branch";

        const parseNumberOrNull = (value) => {
            if (value === undefined || value === null || value === "") return null;
            const num = Number(value);
            return Number.isFinite(num) ? num : null;
        };

        const branchId = parseNumberOrNull(req.query.branch_id);
        const statusParam = req.query.status;

        const statuses = Array.isArray(statusParam)
            ? statusParam.map((s) => s.trim().toLowerCase()).filter(Boolean)
            : typeof statusParam === "string" && statusParam.trim()
            ? statusParam
                  .split(",")
                  .map((s) => s.trim().toLowerCase())
                  .filter(Boolean)
            : null;

        const normalizeNameKey = (value) =>
            !value ? null : value.replace(/\s+/g, " ").trim().toLowerCase();

        const requesterNameKey =
            scope === "user"
                ? normalizeNameKey(
                      [req.user?.first_name, req.user?.last_name]
                          .filter(Boolean)
                          .join(" ")
                  )
                : null;

        const branchIdFromUser = parseNumberOrNull(req.user?.branch_id);

        const effectiveBranchId =
            scope === "branch"
                ? branchIdFromUser ?? branchId
                : scope === "admin"
                ? branchId
                : null;

        const safeRequesterId = parseNumberOrNull(req.user?.user_id);
        const safeLimit = parseNumberOrNull(req.query.limit);
        const safeOffset = parseNumberOrNull(req.query.offset);

        // Fetch raw pending requests
        const requests = await userCreation.getUserCreationRequests({
            scope,
            branchId: effectiveBranchId ?? null,
            requesterId: safeRequesterId,
            requesterNameKey,
            statuses,
            limit: safeLimit ?? undefined,
            offset: safeOffset ?? undefined
        });

        // ===========================
        // MERGE REAL USER TABLE
        // ===========================
        const enrichedRequests = [];

        for (const reqObj of requests) {
            const pending = { ...reqObj };
            const userId = Number(pending.user_id);

            if (Number.isFinite(userId)) {
                const { rows } = await SQLquery(
                    `SELECT 
                        address,
                        cell_number,
                        permissions,
                        hire_date
                     FROM Users
                     WHERE user_id = $1`,
                    [userId]
                );

                if (rows.length > 0) {
                    const u = rows[0];

                    pending.address = u.address ?? null;
                    pending.cell_number = u.cell_number ?? null;
                    pending.permissions = u.permissions ?? null;
                    pending.hire_date = u.hire_date ?? null;
                }
            }

            enrichedRequests.push(pending);
        }

        // Send final enriched response
        res.status(200).json({
            scope,
            filters: {
                branch_id: effectiveBranchId ?? null,
                statuses
            },
            requests: enrichedRequests
        });
    } catch (error) {
        console.error("Error fetching user creation requests: ", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};




//DELETING AN ACCOUNT
export const userDeletionAccount = async (req, res) =>{
    try {
        const userID = req.params.id;
        
        // GET USER'S BRANCH ID BEFORE DELETION FOR WEBSOCKET BROADCAST
        const { rows } = await SQLquery('SELECT branch_id FROM Users WHERE user_id = $1', [userID]);
        if (!rows.length) {
            return res.status(404).json({ message: 'User not found' });
        }

        const branchId = rows[0].branch_id;

        const performer = req.user || {};
        const deletionOptions = {
            deletedByUserId: performer.user_type === 'user' && performer.user_id ? Number(performer.user_id) : null,
            deletedByAdminId: performer.user_type === 'admin' && performer.admin_id ? Number(performer.admin_id) : null,
            deletedByName: [performer.first_name, performer.last_name].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim() || null,
            deletionReason: req.body?.reason ?? null
        };

        const user = await userCreation.deleteUser(userID, branchId, deletionOptions);
        res.status(200).json(user);
    } catch (error) {
        console.error('Error to delete a user: ', error);
        if (error?.name === 'UserPendingRequestsError') {
            return res.status(409).json({ message: error.message });
        }
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
