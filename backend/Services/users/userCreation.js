import { SQLquery } from "../../db.js";
import * as passwordEncryption from "../Services_Utils/passwordEncryption.js";
import { correctDateFormat } from "../Services_Utils/convertRedableDate.js";
import { broadcastUserUpdate, broadcastOwnerNotification, broadcastUserApprovalRequest, broadcastUserApprovalUpdate, broadcastToUser } from "../../server.js";
import { sendPushNotification, sendAlertPushNotification } from "../pushNotificationService.js";

const getUserFullName = async (userId) => {
    if (!userId) return null;
    const { rows } = await SQLquery(
        `SELECT first_name || ' ' || last_name AS full_name FROM Users WHERE user_id = $1`,
        [userId]
    );

    return rows[0]?.full_name || null;
};

const normalizeRoleArray = (roles) => {
    if (!roles) return [];
    if (Array.isArray(roles)) return roles.filter(Boolean);
    return [roles];
};

const mapUserCreationRequestRow = (row) => {
    if (!row) {
        return null;
    }

    const effectiveRoles = normalizeRoleArray(row.effective_roles);

    return {
        request_id: row.request_id,
        user_id: row.pending_user_id,
        pending_user_id: row.pending_user_id,
        status: row.effective_status,
        request_status: row.resolution_status,
        resolution_status: row.resolution_status,
        created_at: row.created_at,
        request_created_at: row.created_at,
        resolved_at: row.resolved_at,
        request_resolved_at: row.resolved_at,
        request_decision_at: row.resolved_at,
        request_approved_at: row.resolved_at,
        request_rejection_reason: row.resolution_reason,
        resolution_reason: row.resolution_reason,
        deleted_at: row.deleted_at,
        deleted_by_user_id: row.deleted_by_user_id,
        deleted_by_admin_id: row.deleted_by_admin_id,
        created_by_id: row.creator_user_id,
        created_by: row.creator_user_id ?? row.creator_name,
        created_by_name: row.creator_name,
        created_by_roles: normalizeRoleArray(row.creator_roles),
        manager_approver_id: row.manager_approver_id,
        manager_approved_at: row.manager_approved_at,
        owner_resolved_by: row.owner_resolved_by,
        branch_id: row.effective_branch_id,
        branch: row.effective_branch_name,
        branch_name: row.effective_branch_name,
        current_branch_id: row.current_branch_id,
        current_branch_name: row.current_branch_name,
        role: effectiveRoles,
        target_roles: normalizeRoleArray(row.target_roles),
        full_name: row.effective_full_name,
        target_full_name: row.target_full_name,
        username: row.effective_username,
        target_username: row.target_username,
        cell_number: row.effective_cell_number,
        target_cell_number: row.target_cell_number,
        current_status: row.current_status,
        current_username: row.current_username,
        current_cell_number: row.current_cell_number
    };
};

const fetchUserCreationRequestById = async (pendingUserId) => {
    const resolvedId = Number(pendingUserId);

    if (!Number.isFinite(resolvedId)) {
        return null;
    }

    const { rows } = await SQLquery(`
        SELECT 
            ucr.request_id,
            ucr.pending_user_id,
            ucr.creator_user_id,
            ucr.creator_name,
            ucr.creator_roles,
            ucr.resolution_status,
            ucr.created_at,
            ucr.resolved_at,
            ucr.manager_approver_id,
            ucr.manager_approved_at,
            ucr.owner_resolved_by,
            ucr.resolution_reason,
            ucr.deleted_at,
            ucr.deleted_by_user_id,
            ucr.deleted_by_admin_id,
            ucr.target_branch_id,
            ucr.target_branch_name,
            ucr.target_roles,
            ucr.target_full_name,
            ucr.target_username,
            ucr.target_cell_number,
            COALESCE(u.branch_id, ucr.target_branch_id) AS effective_branch_id,
            COALESCE(b.branch_name, ucr.target_branch_name) AS effective_branch_name,
            COALESCE(u.role, ucr.target_roles) AS effective_roles,
            COALESCE(u.first_name || ' ' || u.last_name, ucr.target_full_name) AS effective_full_name,
            COALESCE(lc.username, ucr.target_username) AS effective_username,
            COALESCE(u.cell_number, ucr.target_cell_number) AS effective_cell_number,
            COALESCE(u.status, ucr.resolution_status) AS effective_status,
            u.branch_id AS current_branch_id,
            b.branch_name AS current_branch_name,
            u.role AS current_role,
            u.status AS current_status,
            u.cell_number AS current_cell_number,
            lc.username AS current_username
        FROM User_Creation_Requests ucr
        LEFT JOIN Users u ON u.user_id = ucr.pending_user_id
        LEFT JOIN Branch b ON b.branch_id = u.branch_id
        LEFT JOIN Login_Credentials lc ON lc.user_id = u.user_id
        WHERE ucr.pending_user_id = $1
        LIMIT 1
    `, [resolvedId]);

    if (rows.length === 0) {
        return null;
    }

    return mapUserCreationRequestRow(rows[0]);
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

    const creatorName = typeof created_by === 'string'
        ? created_by.replace(/\s+/g, ' ').trim()
        : created_by ?? null;

    const resolveExistingUserId = async (candidate) => {
        if (candidate === null || candidate === undefined) {
            return null;
        }

        const normalizedCandidate = typeof candidate === 'string' ? candidate.trim() : candidate;
        if (normalizedCandidate === '') {
            return null;
        }

        const numericId = Number(normalizedCandidate);
        if (!Number.isFinite(numericId)) {
            return null;
        }

        const { rowCount } = await SQLquery('SELECT 1 FROM Users WHERE user_id = $1', [numericId]);
        return rowCount > 0 ? numericId : null;
    };

    let creatorId = await resolveExistingUserId(created_by_id);

    if (creatorId === null && typeof creatorName === 'string' && creatorName) {
        creatorId = await resolveExistingUserId(creatorName);
    }

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

    const creatorRoles = Array.isArray(creator_roles) ? creator_roles : [];
    const isOwnerCreator = creatorRoles.includes("Owner");
    const isBranchManagerCreator = creatorRoles.includes('Branch Manager');
    
    // Owner creates → active, no request record
    // Branch Manager creates → pending, create request record
    const accountStatus = isOwnerCreator ? 'active' : 'pending';
    const approvedBy = isOwnerCreator ? (creatorName || null) : null;
    const approvedAt = isOwnerCreator ? new Date() : null;

    const { rows: branchRows } = await SQLquery('SELECT branch_name FROM branch WHERE branch_id = $1 LIMIT 1', [branch]);
    const targetBranchName = branchRows[0]?.branch_name || null;
    const normalizedTargetFullName = [first_name, last_name]
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim() || null;

    const snapshotRoles = allowedRoles.length > 0 ? allowedRoles : null;
    const sanitizedCreatorRoles = creatorRoles.length > 0 ? creatorRoles : null;

    await SQLquery('BEGIN');

    try {
        // 1. Create user in Users table
        await SQLquery(
            `INSERT INTO Users(user_id, branch_id, role, first_name, last_name, cell_number, is_active, last_login, permissions, address, status, created_by, approved_by, approved_at) 
            VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
            [user_id, branch, allowedRoles, first_name, last_name, cell_number, false, 'Not yet logged in.', permissions, address, accountStatus, creatorName, approvedBy, approvedAt]
        );

        // 2. Create login credentials
        await SQLquery(
            `INSERT INTO Login_credentials(user_id, username, password) 
            VALUES($1, $2, $3)`,
            [user_id, username, securePassword]
        );

        // 3. ONLY create request record if creator is Branch Manager (NOT Owner)
        if (isBranchManagerCreator && !isOwnerCreator) {
            await SQLquery(
                `INSERT INTO User_Creation_Requests (
                    pending_user_id,
                    creator_user_id,
                    creator_name,
                    creator_roles,
                    resolution_status,
                    created_at,
                    resolved_at,
                    manager_approver_id,
                    manager_approved_at,
                    owner_resolved_by,
                    resolution_reason,
                    deleted_at,
                    deleted_by_user_id,
                    deleted_by_admin_id,
                    target_branch_id,
                    target_branch_name,
                    target_roles,
                    target_full_name,
                    target_username,
                    target_cell_number
                )
                 VALUES ($1, $2, $3, $4, $5, NOW(), NULL, $6, NOW(), NULL, NULL, NULL, NULL, NULL, $7, $8, $9, $10, $11, $12)
                 ON CONFLICT (pending_user_id) DO UPDATE
                 SET creator_user_id = EXCLUDED.creator_user_id,
                     creator_name = EXCLUDED.creator_name,
                     creator_roles = EXCLUDED.creator_roles,
                     resolution_status = EXCLUDED.resolution_status,
                     manager_approver_id = EXCLUDED.manager_approver_id,
                     manager_approved_at = EXCLUDED.manager_approved_at,
                     target_branch_id = EXCLUDED.target_branch_id,
                     target_branch_name = EXCLUDED.target_branch_name,
                     target_roles = EXCLUDED.target_roles,
                     target_full_name = EXCLUDED.target_full_name,
                     target_username = EXCLUDED.target_username,
                     target_cell_number = EXCLUDED.target_cell_number`,
                [
                    user_id,
                    creatorId,
                    creatorName || null,
                    sanitizedCreatorRoles,
                    'pending', // Always pending for Branch Manager requests
                    creatorId, // manager_approver_id = creator
                    branch,
                    targetBranchName,
                    snapshotRoles,
                    normalizedTargetFullName,
                    username,
                    cell_number
                ]
            );
        }

        await SQLquery('COMMIT');
    } catch (error) {
        await SQLquery('ROLLBACK');
        throw error;
    }

    // GET THE NEWLY CREATED USER DATA FOR BROADCASTING
    const { rows } = await SQLquery(`
    SELECT Users.user_id, Branch.branch_name as branch, Branch.branch_id, first_name || ' ' || last_name AS full_name, first_name, last_name, role, cell_number, is_active, Users.is_disabled, ${correctDateFormat('hire_date')}, last_login, permissions, Users.address, username, password, status, Users.created_by, Users.approved_by, Users.approved_at, ucr.creator_user_id AS created_by_id, ucr.resolution_status AS creator_request_status, ucr.resolved_at AS creator_request_resolved_at
        FROM Users
        JOIN Branch ON Branch.branch_id = Users.branch_id
        JOIN Login_Credentials ON Login_Credentials.user_id = Users.user_id
        LEFT JOIN User_Creation_Requests ucr ON ucr.pending_user_id = Users.user_id
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

        // NOTIFY OWNERS IF APPROVAL IS REQUIRED (only for Branch Manager requests)
        if (isBranchManagerCreator && !isOwnerCreator && accountStatus === 'pending') {
            const approvalMessage = `${userWithDecryptedPassword.full_name} needs approval for ${userWithDecryptedPassword.branch}.`;
            const creatorDisplayName = creatorId ? (await getUserFullName(creatorId)) || 'Branch Manager' : (creatorName || 'Branch Manager');

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
                    creatorDisplayName,
                ]
            );

            if (alertResult.rows[0]) {
                // Send push notifications for this alert (owners/admins) if subscriptions exist
                try {
                    await sendAlertPushNotification(alertResult.rows[0]);
                } catch (err) {
                    console.error('Failed to send push notifications for owner alert:', err);
                }

                broadcastOwnerNotification({
                    alert_id: alertResult.rows[0].alert_id,
                    alert_type: 'User Approval Needed',
                    message: approvalMessage,
                    banner_color: 'amber',
                    user_id: alertResult.rows[0].user_id,
                    user_full_name: creatorDisplayName,
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

            // Broadcast user approval request WebSocket event
            const requestSnapshot = await fetchUserCreationRequestById(user_id);
            if (requestSnapshot) {
                broadcastUserApprovalRequest(branch, {
                    request: requestSnapshot,
                    pending_user_id: user_id,
                    branch_id: requestSnapshot.branch_id ?? requestSnapshot.effective_branch_id ?? branch
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
        SELECT Users.user_id, Branch.branch_name as branch, Branch.branch_id, first_name || ' ' || last_name AS full_name, first_name, last_name, role, cell_number, is_active, Users.is_disabled, ${correctDateFormat('hire_date')}, last_login, permissions, Users.address, username, password, status, Users.created_by, Users.approved_by, Users.approved_at, ucr.creator_user_id AS created_by_id, ucr.resolution_status AS creator_request_status, ucr.resolved_at AS creator_request_resolved_at
            FROM Users
            JOIN Branch ON Branch.branch_id = Users.branch_id
            JOIN Login_Credentials ON Login_Credentials.user_id = Users.user_id
            LEFT JOIN User_Creation_Requests ucr ON ucr.pending_user_id = Users.user_id
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



export const deleteUser = async (userID, branchId, options = {}) =>{

    // ENSURE userID IS AN INTEGER
    const userIdInt = parseInt(userID, 10);

    if (Number.isNaN(userIdInt)) {
        throw new Error('Invalid user id');
    }

    console.log(`Deleting user ${userIdInt} from branch ${branchId}`);

    const {
        deletedByUserId = null,
        deletedByAdminId = null,
        deletedByName = null,
        deletionReason = null
    } = options || {};

    const normalizedDeletionReason = typeof deletionReason === 'string'
        ? deletionReason.trim()
        : '';

    const resolvedDeletionReason = normalizedDeletionReason
        ? normalizedDeletionReason
        : (deletedByName ? `Deleted by ${deletedByName}` : null);

    const { rows: userRows } = await SQLquery(
        `SELECT first_name, last_name, role
         FROM Users
         WHERE user_id = $1`,
        [userIdInt]
    );

    if (userRows.length === 0) {
        return;
    }

    const { first_name, last_name, role } = userRows[0];
    const fullName = [first_name, last_name].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim() || 'Former User';
    const normalizedFullName = fullName.toLowerCase();
    const normalizedRoles = Array.isArray(role)
        ? role.filter(Boolean)
        : role ? [role] : [];

    const { rows: pendingInventoryRequests } = await SQLquery(
        `SELECT pending_id
         FROM Inventory_Pending_Actions
         WHERE created_by = $1
           AND status = 'pending'
         LIMIT 1`,
        [userIdInt]
    );

    if (pendingInventoryRequests.length > 0) {
        const error = new Error('Cannot delete this user while they still have pending inventory requests. Please approve or reject their requests first.');
        error.name = 'UserPendingRequestsError';
        throw error;
    }

    const { rowCount: pendingUserApprovals } = await SQLquery(
        `SELECT 1
         FROM User_Creation_Requests
         WHERE resolution_status = 'pending'
           AND (
                creator_user_id = $1
                OR (
                    creator_user_id IS NULL
                    AND creator_name IS NOT NULL
                    AND LOWER(regexp_replace(TRIM(creator_name), '\\s+', ' ', 'g')) = $2
                )
           )
         LIMIT 1`,
        [userIdInt, normalizedFullName]
    );

    if (pendingUserApprovals > 0) {
        const error = new Error('Cannot delete this user while user accounts they requested are still pending approval. Please resolve those requests first.');
        error.name = 'UserPendingRequestsError';
        throw error;
    }

    // IMPORTANT: Auto-reject BEFORE nullifying created_by, otherwise we lose the reference
    // If the original requester (Inventory Staff) is deleted and their request is in "changes_requested" status,
    // automatically reject the request since no one can fulfill the revision request.
    
    // First, get the pending_ids that will be auto-rejected so we can log history
    const { rows: requestsToAutoReject } = await SQLquery(
        `SELECT pending_id, payload
         FROM Inventory_Pending_Actions
         WHERE created_by = $1
           AND status = 'changes_requested'`,
        [userIdInt]
    );

    // Log history for each auto-rejected request
    for (const request of requestsToAutoReject) {
        await SQLquery(
            `INSERT INTO inventory_request_history
             (pending_id, action_type, action_description, user_name, user_role, old_payload, additional_data)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
                request.pending_id,
                'rejected',
                `Request auto-rejected: Requester account (${fullName}) was deleted`,
                'System',
                'System',
                request.payload ? JSON.stringify(request.payload) : null,
                JSON.stringify({ auto_rejected: true, deleted_user: fullName, deleted_user_id: userIdInt })
            ]
        );
    }

    // Now update the requests to rejected status
    await SQLquery(
        `UPDATE Inventory_Pending_Actions
         SET status = 'rejected',
             rejection_reason = CONCAT(
                 COALESCE(rejection_reason, ''),
                 CASE WHEN rejection_reason IS NOT NULL AND rejection_reason <> '' THEN ' | ' ELSE '' END,
                 'Auto-rejected: Requester account (', $1::text, ') was deleted.'
             )
         WHERE created_by = $2
           AND status = 'changes_requested'`,
        [fullName, userIdInt]
    );

    await SQLquery(
        `UPDATE Inventory_Pending_Actions
         SET created_by_name = COALESCE(created_by_name, $1),
             created_by_roles = CASE
                 WHEN created_by_roles IS NULL OR array_length(created_by_roles, 1) = 0 THEN $2
                 ELSE created_by_roles
             END,
             created_by = NULL
         WHERE created_by = $3`,
        [fullName, normalizedRoles, userIdInt]
    );

    await SQLquery(
        `UPDATE Inventory_Pending_Actions
         SET manager_approver_id = NULL
         WHERE manager_approver_id = $1`,
        [userIdInt]
    );

    await SQLquery(
        `UPDATE Inventory_Pending_Actions
         SET approved_by = NULL
         WHERE approved_by = $1`,
        [userIdInt]
    );

    // Nullify revision_requested_by references (Branch Manager who requested changes was deleted)
    // Don't reject the request - just clear the reference so someone else can handle it
    await SQLquery(
        `UPDATE Inventory_Pending_Actions
         SET revision_requested_by = NULL
         WHERE revision_requested_by = $1`,
        [userIdInt]
    );

    // Nullify change_requested_by for any remaining references
    await SQLquery(
        `UPDATE Inventory_Pending_Actions
         SET change_requested_by = NULL
         WHERE change_requested_by = $1`,
        [userIdInt]
    );

    await SQLquery(
        `UPDATE User_Creation_Requests
         SET resolution_status = 'deleted',
             resolved_at = NOW(),
             deleted_at = NOW(),
             deleted_by_user_id = COALESCE($2, deleted_by_user_id),
             deleted_by_admin_id = COALESCE($3, deleted_by_admin_id),
             resolution_reason = COALESCE($4, resolution_reason)
         WHERE pending_user_id = $1`,
        [
            userIdInt,
            deletedByUserId,
            deletedByAdminId,
            resolvedDeletionReason
        ]
    );

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

    if (approvalResult.rowCount > 0) {
        await SQLquery(
            `UPDATE User_Creation_Requests
             SET resolution_status = 'approved',
                 resolved_at = NOW(),
                 owner_resolved_by = COALESCE($2, owner_resolved_by)
             WHERE pending_user_id = $1`,
            [userIdInt, approverIdInt]
        );
    }

    const { rows } = await SQLquery(`
    SELECT Users.user_id, Branch.branch_name as branch, Branch.branch_id, first_name || ' ' || last_name AS full_name, first_name, last_name, role, cell_number, is_active, Users.is_disabled, ${correctDateFormat('hire_date')}, last_login, permissions, Users.address, username, password, status, Users.created_by, Users.approved_by, Users.approved_at, ucr.creator_user_id AS created_by_id, ucr.resolution_status AS creator_request_status, ucr.resolved_at AS creator_request_resolved_at
        FROM Users
        JOIN Branch ON Branch.branch_id = Users.branch_id
        JOIN Login_Credentials ON Login_Credentials.user_id = Users.user_id
        LEFT JOIN User_Creation_Requests ucr ON ucr.pending_user_id = Users.user_id
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

        const requestSnapshot = await fetchUserCreationRequestById(userIdInt);

        if (requestSnapshot) {
            broadcastUserApprovalUpdate(approvedUser.branch_id, {
                pending_user_id: userIdInt,
                status: 'approved',
                branch_id: approvedUser.branch_id,
                request: requestSnapshot
            });
        }

        // Send targeted WebSocket notification to the creator (branch manager)
        if (approvedUser.created_by_id) {
            broadcastToUser(approvedUser.created_by_id, {
                alert_type: 'User Request Approved',
                message: `Your request to create user "${approvedUser.full_name}" has been approved by the owner (${approverName}).`,
                banner_color: 'green',
                user_full_name: 'System',
                alert_date: new Date().toISOString(),
                product_id: null,
                isDateToday: true,
                alert_date_formatted: 'Just now',
                is_targeted: true,
                data: {
                    type: 'user-approval',
                    user_id: userIdInt,
                    status: 'approved',
                    url: '/user-management'
                }
            }); // Persist to database for notification history
        }

        // Send push notification to the requester (creator of the user account)
        
    }

    return approvedUser;
};


export const rejectPendingUser = async (userId, approverId, approverName, options = {}) => {
    const userIdInt = parseInt(userId, 10);
    const approverIdInt = approverId !== null && approverId !== undefined ? parseInt(approverId, 10) : null;

    if (Number.isNaN(userIdInt)) {
        throw new Error('Invalid user id');
    }

    if (approverId !== null && approverId !== undefined && Number.isNaN(approverIdInt)) {
        throw new Error('Invalid approver id');
    }

    const normalizedReason = typeof options?.reason === 'string' ? options.reason.trim() : '';
    const resolvedReason = normalizedReason.length > 0 ? normalizedReason : null;

    await SQLquery('BEGIN');

    let branchId = null;
    let rejectedUser = null;

    try {
        const { rows } = await SQLquery(`
    SELECT Users.user_id, Branch.branch_name as branch, Branch.branch_id, first_name || ' ' || last_name AS full_name, first_name, last_name, role, cell_number, is_active, Users.is_disabled, ${correctDateFormat('hire_date')}, last_login, permissions, Users.address, username, password, status, Users.created_by, Users.approved_by, Users.approved_at, ucr.creator_user_id AS created_by_id, ucr.resolution_status AS creator_request_status, ucr.resolved_at AS creator_request_resolved_at, ucr.resolution_reason AS creator_request_reason
        FROM Users
        JOIN Branch ON Branch.branch_id = Users.branch_id
        JOIN Login_Credentials ON Login_Credentials.user_id = Users.user_id
        LEFT JOIN User_Creation_Requests ucr ON ucr.pending_user_id = Users.user_id
        WHERE Users.user_id = $1
        FOR UPDATE OF Users, Login_Credentials
    `, [userIdInt]);

        if (rows.length === 0) {
            await SQLquery('ROLLBACK');
            throw new Error('User not found or already processed');
        }

        const pendingRecord = rows[0];
        const currentStatus = typeof pendingRecord.status === 'string' ? pendingRecord.status.toLowerCase() : pendingRecord.status;

        if (currentStatus !== 'pending') {
            await SQLquery('ROLLBACK');
            throw new Error('User not found or already processed');
        }

        branchId = pendingRecord.branch_id;

        // Populate snapshot columns before deleting user so rejected request history is preserved
        await SQLquery(
            `UPDATE User_Creation_Requests
             SET resolution_status = 'rejected',
                 resolved_at = NOW(),
                 owner_resolved_by = COALESCE($2, owner_resolved_by),
                 resolution_reason = COALESCE($3, resolution_reason),
                 target_branch_id = COALESCE(target_branch_id, $4),
                 target_branch_name = COALESCE(target_branch_name, $5),
                 target_roles = COALESCE(target_roles, $6),
                 target_full_name = COALESCE(target_full_name, $7),
                 target_username = COALESCE(target_username, $8),
                 target_cell_number = COALESCE(target_cell_number, $9)
             WHERE pending_user_id = $1`,
            [
                userIdInt, 
                approverIdInt, 
                resolvedReason,
                pendingRecord.branch_id,
                pendingRecord.branch,
                pendingRecord.role,
                pendingRecord.full_name,
                pendingRecord.username,
                pendingRecord.cell_number
            ]
        );

        const decryptedPassword = await passwordEncryption.decryptPassword(pendingRecord.password);

        rejectedUser = {
            ...pendingRecord,
            password: decryptedPassword,
            status: 'rejected',
            creator_request_status: 'rejected',
            creator_request_resolved_at: new Date().toISOString(),
            creator_request_reason: resolvedReason ?? pendingRecord.creator_request_reason
        };

        await SQLquery('DELETE FROM Login_Credentials WHERE user_id = $1', [userIdInt]);
        await SQLquery('DELETE FROM Users WHERE user_id = $1', [userIdInt]);

        await SQLquery('COMMIT');
    } catch (error) {
        await SQLquery('ROLLBACK');
        throw error;
    }

    broadcastUserUpdate(branchId, {
        action: 'delete',
        user_id: userIdInt,
        reason: resolvedReason || 'rejected'
    });

    const requestSnapshot = await fetchUserCreationRequestById(userIdInt);

    if (requestSnapshot) {
        broadcastUserApprovalUpdate(branchId, {
            pending_user_id: userIdInt,
            status: 'rejected',
            branch_id: branchId,
            reason: resolvedReason || null,
            request: requestSnapshot
        });
    }

    // Send targeted WebSocket notification to the creator (branch manager)
    if (rejectedUser?.created_by_id) {
        const reasonText = resolvedReason ? ` Reason: ${resolvedReason}` : '';
        broadcastToUser(rejectedUser.created_by_id, {
            alert_type: 'User Request Rejected',
            message: `Your request to create user "${rejectedUser.full_name}" has been rejected by the owner (${approverName}).${reasonText}`,
            banner_color: 'red',
            user_full_name: 'System',
            alert_date: new Date().toISOString(),
            product_id: null,
            isDateToday: true,
            alert_date_formatted: 'Just now',
            is_targeted: true,
            data: {
                type: 'user-rejection',
                user_id: userIdInt,
                status: 'rejected',
                reason: resolvedReason,
                url: '/user-management'
            }
        }); // Persist to database for notification history
    }

    // Send push notification to the requester (creator of the user account)

    return rejectedUser;
};


export const cancelPendingUserRequest = async (userId, cancellerId, options = {}) => {
    const userIdInt = parseInt(userId, 10);
    const cancellerIdInt = cancellerId !== null && cancellerId !== undefined ? parseInt(cancellerId, 10) : null;

    if (Number.isNaN(userIdInt)) {
        throw new Error('Invalid user id');
    }

    if (cancellerId !== null && cancellerId !== undefined && Number.isNaN(cancellerIdInt)) {
        throw new Error('Invalid canceller id');
    }

    const normalizedReason = typeof options?.reason === 'string' ? options.reason.trim() : '';
    const resolvedReason = normalizedReason.length > 0 ? normalizedReason : null;
    const actorType = options?.actorType === 'admin' ? 'admin' : 'user';

    await SQLquery('BEGIN');

    let branchId = null;
    let cancelledUser = null;
    let newHistoryRow = null;

    try {
        const { rows } = await SQLquery(`
    SELECT Users.user_id, Branch.branch_name as branch, Branch.branch_id, first_name || ' ' || last_name AS full_name, first_name, last_name, role, cell_number, is_active, Users.is_disabled, ${correctDateFormat('hire_date')}, last_login, permissions, Users.address, username, password, status, Users.created_by, Users.approved_by, Users.approved_at, ucr.creator_user_id AS created_by_id, ucr.creator_roles, ucr.resolution_status AS creator_request_status, ucr.resolved_at AS creator_request_resolved_at, ucr.resolution_reason AS creator_request_reason
        FROM Users
        JOIN Branch ON Branch.branch_id = Users.branch_id
        JOIN Login_Credentials ON Login_Credentials.user_id = Users.user_id
        JOIN User_Creation_Requests ucr ON ucr.pending_user_id = Users.user_id
        WHERE Users.user_id = $1
        FOR UPDATE OF Users, Login_Credentials
    `, [userIdInt]);

        if (rows.length === 0) {
            await SQLquery('ROLLBACK');
            throw new Error('User not found or already processed');
        }

        const pendingRecord = rows[0];
        const currentStatus = typeof pendingRecord.status === 'string' ? pendingRecord.status.toLowerCase() : pendingRecord.status;
        const requestStatus = typeof pendingRecord.creator_request_status === 'string' ? pendingRecord.creator_request_status.toLowerCase() : pendingRecord.creator_request_status;

        if (currentStatus !== 'pending' || requestStatus !== 'pending') {
            await SQLquery('ROLLBACK');
            throw new Error('User not found or already processed');
        }

        if (actorType !== 'admin') {
            if (!Number.isFinite(cancellerIdInt)) {
                await SQLquery('ROLLBACK');
                throw new Error('Canceller id is required');
            }

            if (Number(pendingRecord.created_by_id) !== cancellerIdInt) {
                await SQLquery('ROLLBACK');
                throw new Error('You can only cancel requests that you submitted');
            }
        }

        branchId = pendingRecord.branch_id;

        const decryptedPassword = await passwordEncryption.decryptPassword(pendingRecord.password);

        cancelledUser = {
            ...pendingRecord,
            password: decryptedPassword,
            status: 'cancelled',
            creator_request_status: 'cancelled',
            creator_request_resolved_at: new Date().toISOString(),
            creator_request_reason: resolvedReason ?? pendingRecord.creator_request_reason
        };

        // Create a separate history row for this cancellation so multiple
        // cancellations are preserved as discrete events (audit/history).
        // We'll attempt to insert with resolution_status 'cancelled' and
        // fall back to 'deleted' if constrained.
        try {
            const { rows: insertRows } = await SQLquery(
                `INSERT INTO User_Creation_Requests (
                    pending_user_id,
                    creator_user_id,
                    creator_name,
                    creator_roles,
                    resolution_status,
                    created_at,
                    resolved_at,
                    owner_resolved_by,
                    resolution_reason,
                    deleted_by_user_id,
                    deleted_by_admin_id,
                    target_branch_id,
                    target_branch_name,
                    target_roles,
                    target_full_name,
                    target_username,
                    target_cell_number
                ) VALUES ($1,$2,$3,$4,$5,NOW(),NOW(),$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
                   RETURNING *`,
                [
                    null, // pending_user_id - NULL, it's a historical snapshot
                    pendingRecord.creator_user_id ?? null,
                    pendingRecord.creator_name ?? null,
                    pendingRecord.creator_roles ?? null,
                    'cancelled',
                    null,
                    resolvedReason,
                    actorType === 'user' ? cancellerIdInt : null,
                    actorType === 'admin' ? cancellerIdInt : null,
                    pendingRecord.branch_id,
                    pendingRecord.branch,
                    pendingRecord.role,
                    pendingRecord.full_name,
                    pendingRecord.username,
                    pendingRecord.cell_number
                ]
            );

            newHistoryRow = insertRows[0] ?? null;
        } catch (ie) {
            // Fall back to 'deleted' status where 'cancelled' is not allowed
            const isConstraintViolation = ie && (ie.code === '23514' || (ie.constraint && String(ie.constraint).includes('user_creation_requests_resolution_status_check')));
            if (!isConstraintViolation) throw ie;

            const { rows: insertRows } = await SQLquery(
                `INSERT INTO User_Creation_Requests (
                    pending_user_id,
                    creator_user_id,
                    creator_name,
                    creator_roles,
                    resolution_status,
                    created_at,
                    resolved_at,
                    owner_resolved_by,
                    resolution_reason,
                    deleted_by_user_id,
                    deleted_by_admin_id,
                    target_branch_id,
                    target_branch_name,
                    target_roles,
                    target_full_name,
                    target_username,
                    target_cell_number
                ) VALUES ($1,$2,$3,$4,$5,NOW(),NOW(),$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
                   RETURNING *`,
                [
                    null,
                    pendingRecord.creator_user_id ?? null,
                    pendingRecord.creator_name ?? null,
                    pendingRecord.creator_roles ?? null,
                    'deleted',
                    null,
                    resolvedReason,
                    actorType === 'user' ? cancellerIdInt : null,
                    actorType === 'admin' ? cancellerIdInt : null,
                    pendingRecord.branch_id,
                    pendingRecord.branch,
                    pendingRecord.role,
                    pendingRecord.full_name,
                    pendingRecord.username,
                    pendingRecord.cell_number
                ]
            );
            newHistoryRow = insertRows[0] ?? null;
        }

        // UPDATE the main request record to indicate cancelled/deleted status
        try {
            await SQLquery(
                `UPDATE User_Creation_Requests
                 SET resolution_status = 'cancelled',
                     resolved_at = NOW(),
                     resolution_reason = COALESCE($2, resolution_reason),
                     target_branch_id = COALESCE(target_branch_id, $3),
                     target_branch_name = COALESCE(target_branch_name, $4),
                     target_roles = COALESCE(target_roles, $5),
                     target_full_name = COALESCE(target_full_name, $6),
                     target_username = COALESCE(target_username, $7),
                     target_cell_number = COALESCE(target_cell_number, $8),
                     deleted_by_user_id = COALESCE(deleted_by_user_id, $9),
                     deleted_by_admin_id = COALESCE(deleted_by_admin_id, $10)
                 WHERE pending_user_id = $1`,
                [
                    userIdInt,
                    resolvedReason,
                    pendingRecord.branch_id,
                    pendingRecord.branch,
                    pendingRecord.role,
                    pendingRecord.full_name,
                    pendingRecord.username,
                    pendingRecord.cell_number,
                    actorType === 'user' ? cancellerIdInt : null,
                    actorType === 'admin' ? cancellerIdInt : null
                ]
            );
        } catch (e) {
            // If the DB rejects 'cancelled' via a constraint (e.g., 23514),
            // use 'deleted' instead and ensure deleted_by_* fields are set.
            const isConstraintViolation = e && (e.code === '23514' || (e.constraint && String(e.constraint).includes('user_creation_requests_resolution_status_check')));
            if (!isConstraintViolation) throw e;

            await SQLquery(
                `UPDATE User_Creation_Requests
                 SET resolution_status = 'deleted',
                     resolved_at = NOW(),
                     resolution_reason = COALESCE($2, resolution_reason),
                     target_branch_id = COALESCE(target_branch_id, $3),
                     target_branch_name = COALESCE(target_branch_name, $4),
                     target_roles = COALESCE(target_roles, $5),
                     target_full_name = COALESCE(target_full_name, $6),
                     target_username = COALESCE(target_username, $7),
                     target_cell_number = COALESCE(target_cell_number, $8),
                     deleted_by_user_id = COALESCE(deleted_by_user_id, $9),
                     deleted_by_admin_id = COALESCE(deleted_by_admin_id, $10)
                 WHERE pending_user_id = $1`,
                [
                    userIdInt,
                    resolvedReason,
                    pendingRecord.branch_id,
                    pendingRecord.branch,
                    pendingRecord.role,
                    pendingRecord.full_name,
                    pendingRecord.username,
                    pendingRecord.cell_number,
                    actorType === 'user' ? cancellerIdInt : null,
                    actorType === 'admin' ? cancellerIdInt : null
                ]
            );
        }

        // DELETE the user from Users and Login_Credentials
        await SQLquery('DELETE FROM Login_Credentials WHERE user_id = $1', [userIdInt]);
        await SQLquery('DELETE FROM Users WHERE user_id = $1', [userIdInt]);

        await SQLquery('COMMIT');
    } catch (error) {
        await SQLquery('ROLLBACK');
        throw error;
    }

    // Broadcast user deletion
    broadcastUserUpdate(branchId, {
        action: 'delete',
        user_id: userIdInt,
        reason: resolvedReason || 'cancelled'
    });

    // Broadcast request cancellation. Prefer the newly inserted history
    // row for accurate event details; otherwise fall back to the main
    // request snapshot.
    let broadcastRequest = null;
    if (newHistoryRow) {
        // Normalize the history row into the expected shape
        broadcastRequest = {
            pending_user_id: userIdInt,
            creator_user_id: newHistoryRow.creator_user_id ?? null,
            creator_name: newHistoryRow.creator_name ?? null,
            creator_roles: newHistoryRow.creator_roles ?? null,
            resolution_status: newHistoryRow.resolution_status ?? null,
            created_at: newHistoryRow.created_at ?? null,
            resolved_at: newHistoryRow.resolved_at ?? null,
            resolution_reason: newHistoryRow.resolution_reason ?? null,
            deleted_by_user_id: newHistoryRow.deleted_by_user_id ?? null,
            deleted_by_admin_id: newHistoryRow.deleted_by_admin_id ?? null,
            target_branch_id: newHistoryRow.target_branch_id ?? null,
            target_branch_name: newHistoryRow.target_branch_name ?? null,
            target_roles: newHistoryRow.target_roles ?? null,
            target_full_name: newHistoryRow.target_full_name ?? null,
            target_username: newHistoryRow.target_username ?? null,
            target_cell_number: newHistoryRow.target_cell_number ?? null
        };
    } else {
        const requestSnapshot = await fetchUserCreationRequestById(userIdInt);
        broadcastRequest = requestSnapshot;
    }

    broadcastUserApprovalUpdate(branchId, {
        pending_user_id: userIdInt,
        status: (broadcastRequest?.resolution_status ?? 'cancelled'),
        branch_id: branchId,
        reason: resolvedReason || null,
        request: broadcastRequest
    });

    // Send targeted notification to the creator if they didn't cancel their own request
    if (cancelledUser?.created_by_id && Number(cancelledUser.created_by_id) !== cancellerIdInt) {
        broadcastToUser(cancelledUser.created_by_id, {
            alert_type: 'User Request Cancelled',
            message: `Your request to create user "${cancelledUser.full_name}" has been cancelled.`,
            banner_color: 'orange',
            user_full_name: 'System',
            alert_date: new Date().toISOString(),
            product_id: null,
            isDateToday: true,
            alert_date_formatted: 'Just now',
            is_targeted: true,
            data: {
                type: 'user-cancellation',
                user_id: userIdInt,
                status: 'cancelled',
                reason: resolvedReason,
                url: '/user-management'
            }
        }); // Persist to database for notification history
    }

    return cancelledUser;
};

export const getUserCreationRequests = async (options = {}) => {
    const {
        scope = 'user',
        branchId = null,
        requesterId = null,
        requesterNameKey = null,
        statuses = null,
        limit = 100,
        offset = 0
    } = options;

    const filters = [];
    const params = [];
    let paramIndex = 1;

    const resolvedScope = ['user', 'branch', 'admin'].includes(scope) ? scope : 'user';

    if (resolvedScope === 'user') {
        const userConditions = [];

        if (Number.isFinite(requesterId)) {
            userConditions.push(`ucr.creator_user_id = $${paramIndex++}`);
            params.push(requesterId);
        }

        if (requesterNameKey) {
            userConditions.push(`(
                ucr.creator_user_id IS NULL
                AND ucr.creator_name IS NOT NULL
                AND LOWER(regexp_replace(TRIM(ucr.creator_name), '\\s+', ' ', 'g')) = $${paramIndex}
            )`);
            params.push(requesterNameKey);
            paramIndex += 1;
        }

        if (userConditions.length === 0) {
            throw new Error('Unable to resolve requester for user-scoped creation requests');
        }

        filters.push(`(${userConditions.join(' OR ')})`);
    } else if (resolvedScope === 'branch') {
        if (!Number.isFinite(branchId)) {
            throw new Error('branchId is required for branch scope');
        }

        filters.push(`COALESCE(u.branch_id, ucr.target_branch_id) = $${paramIndex++}`);
        params.push(branchId);
    } else if (resolvedScope === 'admin' && Number.isFinite(branchId)) {
        filters.push(`COALESCE(u.branch_id, ucr.target_branch_id) = $${paramIndex++}`);
        params.push(branchId);
    }

    if (Array.isArray(statuses) && statuses.length > 0) {
        const normalized = statuses
            .map(status => String(status || '').toLowerCase())
            .filter(Boolean);
        // If the caller provided explicit statuses, respect the list but
        // * Do NOT include cancelled entries unless the scope is 'branch'.
        // * If the resulting set of statuses is empty, return an empty result
        //   rather than falling back to returning everything.
        const canSeeCancelled = resolvedScope === 'branch';
        // Expand the 'cancelled' status into both 'cancelled' and 'deleted' in
        // DB when the scope can see cancelled requests. This allows older DBs
        // that store cancellations as 'deleted' to be queried when asking for
        // 'cancelled'. If the caller isn't allowed to see cancelled records,
        // then filter them out.
        // Expand 'cancelled' to include 'deleted' where the DB uses 'deleted'
        // for cancellation events so callers asking for 'cancelled' still get
        // results in those deployments.
        const expanded = [];
        normalized.forEach((s) => {
            if (s === 'cancelled') {
                // include both values for broad compatibility with DBs
                expanded.push('cancelled', 'deleted');
            } else {
                expanded.push(s);
            }
        });

        const filtered = expanded.filter(s => canSeeCancelled || s !== 'cancelled');

        if (filtered.length === 0) {
            return [];
        }

        // Translate statuses for DB: map 'cancelled' -> ['cancelled','deleted'] when allowed.
        const dbStatuses = [];
        for (const s of filtered) {
            if (s === 'cancelled') {
                dbStatuses.push('cancelled');
                dbStatuses.push('deleted');
            } else {
                dbStatuses.push(s);
            }
        }

        filters.push(`LOWER(ucr.resolution_status) = ANY($${paramIndex++})`);
        params.push(dbStatuses);
    }
    else {
        // No explicit status filter provided: exclude cancelled requests unless
        // the consumer is fetching as a branch manager (scope === 'branch').
        if (resolvedScope !== 'branch') {
            // Exclude 'cancelled' if present as explicit status, but also hide
            // records where resolution_status = 'deleted' and deleted_by_user_id is set
            // since these are cancellations by branch managers (not admin deletions).
            filters.push(`LOWER(ucr.resolution_status) != 'cancelled'`);
            filters.push(`NOT (LOWER(ucr.resolution_status) = 'deleted' AND ucr.deleted_by_user_id IS NOT NULL)`);
        }
    }

    const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

    const numericLimit = Math.max(1, Math.min(Number(limit) || 100, 200));
    const numericOffset = Math.max(0, Number(offset) || 0);

    params.push(numericLimit, numericOffset);

    const query = `
        SELECT 
            ucr.request_id,
            ucr.pending_user_id,
            ucr.creator_user_id,
            ucr.creator_name,
            ucr.creator_roles,
            ucr.resolution_status,
            ucr.created_at,
            ucr.resolved_at,
            ucr.manager_approver_id,
            ucr.manager_approved_at,
            ucr.owner_resolved_by,
            ucr.resolution_reason,
            ucr.deleted_at,
            ucr.deleted_by_user_id,
            ucr.deleted_by_admin_id,
            ucr.target_branch_id,
            ucr.target_branch_name,
            ucr.target_roles,
            ucr.target_full_name,
            ucr.target_username,
            ucr.target_cell_number,
            COALESCE(u.branch_id, ucr.target_branch_id) AS effective_branch_id,
            COALESCE(b.branch_name, ucr.target_branch_name) AS effective_branch_name,
            COALESCE(u.role, ucr.target_roles) AS effective_roles,
            COALESCE(u.first_name || ' ' || u.last_name, ucr.target_full_name) AS effective_full_name,
            COALESCE(lc.username, ucr.target_username) AS effective_username,
            COALESCE(u.cell_number, ucr.target_cell_number) AS effective_cell_number,
            COALESCE(u.status, ucr.resolution_status) AS effective_status,
            u.branch_id AS current_branch_id,
            b.branch_name AS current_branch_name,
            u.role AS current_role,
            u.status AS current_status,
            u.cell_number AS current_cell_number,
            lc.username AS current_username
        FROM User_Creation_Requests ucr
        LEFT JOIN Users u ON u.user_id = ucr.pending_user_id
        LEFT JOIN Branch b ON b.branch_id = u.branch_id
        LEFT JOIN Login_Credentials lc ON lc.user_id = u.user_id
        ${whereClause}
        ORDER BY ucr.created_at DESC
        LIMIT $${paramIndex++}
        OFFSET $${paramIndex++}`;

    const { rows } = await SQLquery(query, params);
    return rows.map(mapUserCreationRequestRow).filter(Boolean);
};


