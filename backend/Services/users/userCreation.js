import { SQLquery } from "../../db.js";
import * as passwordEncryption from "../Services_Utils/passwordEncryption.js";
import { correctDateFormat } from "../Services_Utils/convertRedableDate.js";
import { broadcastUserUpdate, broadcastOwnerNotification } from "../../server.js";

const getUserFullName = async (userId) => {
    if (!userId) return null;
    const { rows } = await SQLquery(
        `SELECT first_name || ' ' || last_name AS full_name FROM Users WHERE user_id = $1`,
        [userId]
    );

    return rows[0]?.full_name || null;
};




export const checkExistingUsername = async (username) =>{
    const existingUsername = await SQLquery('SELECT 1 FROM Login_Credentials WHERE username = $1',[username]);

    if (existingUsername.rowCount){
        return {result : true};
    }

    return {result : false};
}



export const createUserAccount = async (UserData) => {
    const { branch, role, first_name, last_name, cell_number, address, username, password, created_by_id, created_by, creator_roles } = UserData;

    const {isManager, isInventoryStaff, isSalesAssociate} = role;

    //CREATES A UNIQUE USER ID
    let user_id;
    let isUnique = false;
    while (!isUnique) {
        user_id = Math.floor(100000 + Math.random() * 900000); 
        const check = await SQLquery('SELECT 1 FROM Users WHERE user_id = $1', [user_id]);
        if (check.rowCount === 0) isUnique = true;
    }



    let allowedRoles = [];

    const addRole = (condition, roleName) => {
        if (condition && !allowedRoles.includes(roleName)) {
            allowedRoles.push(roleName);
        }
    };

    addRole(isManager, "Branch Manager");
    addRole(isInventoryStaff, "Inventory Staff");
    addRole(isSalesAssociate, "Sales Associate");




    let permissions = [];

    if (isManager)
        permissions.push(
            "View Dashboard",
            "View Inventory",
            "View Notification",
            "View Product Validity",
            "Confirm Inventory Changes"
        );

    if (isInventoryStaff)
        permissions.push(
            "Manage Inventory",
            "View Product Validity",
            "View Notifications"
        );

    if (isSalesAssociate)
        permissions.push(
            "Manage Sales Transactions",
            "Monitor Deliveries",
        );
        


    const securePassword = await passwordEncryption.encryptPassword(password);

    const creatorId = created_by_id ?? null;
    const creatorRoles = Array.isArray(creator_roles) ? creator_roles : [];
    const isOwnerCreator = creatorRoles.includes("Owner");
    const accountStatus = isOwnerCreator ? 'active' : 'pending';
    const approvedBy = isOwnerCreator ? created_by : null;
    const approvedAt = isOwnerCreator ? new Date() : null;

    await SQLquery('BEGIN');

    await SQLquery(
        `INSERT INTO Users(user_id, branch_id, role, first_name, last_name, cell_number, is_active, last_login, permissions, address, status, created_by, approved_by, approved_at) 
        VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [user_id, branch, allowedRoles, first_name, last_name, cell_number, false, 'Not yet logged in.', permissions, address, accountStatus, created_by, approvedBy, approvedAt]
    );

    await SQLquery(
        `INSERT INTO Login_credentials(user_id, username, password) 
        VALUES($1, $2, $3)`,
        [user_id, username, securePassword]
    );

    await SQLquery('COMMIT');

    // GET THE NEWLY CREATED USER DATA FOR BROADCASTING
    const { rows } = await SQLquery(`
        SELECT Users.user_id, Branch.branch_name as branch, Branch.branch_id, first_name || ' ' || last_name AS full_name, first_name, last_name, role, cell_number, is_active, Users.is_disabled, ${correctDateFormat('hire_date')}, last_login, permissions, Users.address, username, password, status, Users.created_by, Users.approved_by, Users.approved_at
        FROM Users
        JOIN Branch ON Branch.branch_id = Users.branch_id
        JOIN Login_Credentials ON Login_Credentials.user_id = Users.user_id
        WHERE Users.user_id = $1
        ORDER BY hire_date;
    `, [user_id]);

    if (rows[0]) {
        const userWithDecryptedPassword = {
            ...rows[0],
            password: await passwordEncryption.decryptPassword(rows[0].password)
        };

        // BROADCAST NEW USER CREATION TO ALL USERS IN THE BRANCH
        broadcastUserUpdate(branch, {
            action: 'add',
            user: userWithDecryptedPassword
        });

        // NOTIFY OWNERS IF APPROVAL IS REQUIRED
        const creatorIsBranchManager = creatorRoles.includes('Branch Manager');
        if (accountStatus === 'pending' && creatorIsBranchManager) {
            const approvalMessage = `${userWithDecryptedPassword.full_name} needs approval for ${userWithDecryptedPassword.branch}.`;
            const creatorName = await getUserFullName(creatorId) || 'Branch Manager';

            const alertResult = await SQLquery(
                `INSERT INTO Inventory_Alerts 
                (product_id, branch_id, alert_type, message, banner_color, user_id, user_full_name)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING *`,
                [
                    null,
                    userWithDecryptedPassword.branch_id,
                    'User Approval Needed',
                    approvalMessage,
                    'amber',
                    creatorId,
                    creatorName
                ]
            );

            if (alertResult.rows[0]) {
                broadcastOwnerNotification({
                    alert_id: alertResult.rows[0].alert_id,
                    alert_type: 'User Approval Needed',
                    message: approvalMessage,
                    banner_color: 'amber',
                    user_id: alertResult.rows[0].user_id,
                    user_full_name: creatorName,
                    alert_date: alertResult.rows[0].alert_date,
                    isDateToday: true,
                    alert_date_formatted: 'Just now',
                    target_roles: ['Owner'],
                    creator_id: creatorId,
                    created_at: new Date().toISOString()
                }, {
                    branchId: userWithDecryptedPassword.branch_id,
                    targetRoles: ['Owner']
                });
            }
        }

        return userWithDecryptedPassword;
    }

    return null;
};



export const updateUserAccount = async (UserID, UserData) =>{
    const { branch, role, first_name, last_name, cell_number, address, username, password } = UserData;

    const {isManager, isInventoryStaff, isSalesAssociate} = role;

    const securePassword = await passwordEncryption.encryptPassword(password);


    let allowedRoles = [];

    const addRole = (condition, roleName) => {
        if (condition && !allowedRoles.includes(roleName)) {
            allowedRoles.push(roleName);
        }
    };

    addRole(isManager, "Branch Manager");
    addRole(isInventoryStaff, "Inventory Staff");
    addRole(isSalesAssociate, "Sales Associate");



    let permissions = [];

    if (isManager)
        permissions.push(
            "View Dashboard",
            "View Inventory",
            "View Notification",
            "View Product Validity",
            "Confirm Inventory Changes"
        );

    if (isInventoryStaff)
        permissions.push(
            "Manage Inventory",
            "View Product Validity",
            "View Notifications"
        );

    if (isSalesAssociate)
        permissions.push(
            "Manage Sales Transactions",
            "Monitor Deliveries",
        );


    await SQLquery('BEGIN');


    await SQLquery(`UPDATE Users SET role = '{}', permissions = '{}' WHERE user_id = $1 `,[UserID]);


    await SQLquery(`UPDATE Users SET branch_id = $1, role = $2, first_name = $3, last_name = $4, cell_number = $5, permissions = $6, address = $7 WHERE user_id = $8`,[branch, allowedRoles, first_name, last_name, cell_number, permissions, address, UserID]);


    await SQLquery(`UPDATE Login_Credentials SET username = $1, password = $2 WHERE user_id = $3 `,[username, securePassword, UserID]);


    const { rows } = await SQLquery(`
        SELECT Users.user_id, Branch.branch_name as branch, Branch.branch_id, first_name || ' ' || last_name AS full_name, first_name, last_name, role, cell_number, is_active, Users.is_disabled, ${correctDateFormat('hire_date')}, last_login, permissions, Users.address, username, password, status, Users.created_by, Users.approved_by, Users.approved_at
            FROM Users
            JOIN Branch ON Branch.branch_id = Users.branch_id
            JOIN Login_Credentials ON Login_Credentials.user_id = Users.user_id
            WHERE Users.user_id = $1
            ORDER BY hire_date;
        `, [UserID]);
    
    const usersWithDecryptedPasswords = await Promise.all(
        rows.map(async (user) => ({
            ...user,
            password: await passwordEncryption.decryptPassword(user.password)
        }))
    );


    await SQLquery('COMMIT');

    // BROADCAST USER UPDATE TO ALL USERS IN THE BRANCH
    if (usersWithDecryptedPasswords[0]) {
        broadcastUserUpdate(branch, {
            action: 'update',
            user: usersWithDecryptedPasswords[0]
        });
    }
    
    return usersWithDecryptedPasswords[0];

};



export const deleteUser = async (userID, branchId) =>{

    // ENSURE userID IS AN INTEGER
    const userIdInt = parseInt(userID, 10);
    
    console.log(`Deleting user ${userIdInt} from branch ${branchId}`);

    await SQLquery('DELETE FROM Users WHERE user_id = $1', [userIdInt]);

    console.log(`Broadcasting user deletion for user ${userIdInt} in branch ${branchId}`);

    // BROADCAST USER DELETION TO ALL USERS IN THE BRANCH
    broadcastUserUpdate(branchId, {
        action: 'delete',
        user_id: userIdInt
    });

};



export const approvePendingUser = async (userId, approverId, approverName) => {
    const userIdInt = parseInt(userId, 10);
    const approverIdInt = approverId !== null && approverId !== undefined ? parseInt(approverId, 10) : null;

    if (Number.isNaN(userIdInt)) {
        throw new Error('Invalid user id');
    }

    if (approverId !== null && approverId !== undefined && Number.isNaN(approverIdInt)) {
        throw new Error('Invalid approver id');
    }

    const approvalResult = await SQLquery(
        `UPDATE Users
         SET status = 'active', approved_by = $1, approved_at = NOW()
         WHERE user_id = $2 AND status = 'pending'
         RETURNING branch_id`,
        [approverName, userIdInt]
    );

    const { rows } = await SQLquery(`
        SELECT Users.user_id, Branch.branch_name as branch, Branch.branch_id, first_name || ' ' || last_name AS full_name, first_name, last_name, role, cell_number, is_active, Users.is_disabled, ${correctDateFormat('hire_date')}, last_login, permissions, Users.address, username, password, status, Users.created_by, Users.approved_by, Users.approved_at
        FROM Users
        JOIN Branch ON Branch.branch_id = Users.branch_id
        JOIN Login_Credentials ON Login_Credentials.user_id = Users.user_id
        WHERE Users.user_id = $1
    `, [userIdInt]);

    if (rows.length === 0) {
        throw new Error('User not found or already processed');
    }

    const usersWithDecryptedPasswords = await Promise.all(
        rows.map(async (user) => ({
            ...user,
            password: await passwordEncryption.decryptPassword(user.password)
        }))
    );

    const approvedUser = usersWithDecryptedPasswords[0];

    if (approvalResult.rowCount > 0) {
        broadcastUserUpdate(approvedUser.branch_id, {
            action: 'update',
            user: approvedUser
        });
    }

    return approvedUser;
};


