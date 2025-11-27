import { SQLquery } from "../../db.js";
import { broadcastNotification, broadcastOwnerNotification, broadcastInventoryUpdate, broadcastValidityUpdate, broadcastHistoryUpdate, broadcastInventoryApprovalRequest, broadcastInventoryApprovalRequestToOwners, broadcastInventoryApprovalUpdate, broadcastToUser } from "../../server.js";
import { checkAndHandleLowStock } from "../Services_Utils/lowStockNotification.js";
import { convertToBaseUnit, getUnitConversion } from "../Services_Utils/unitConversion.js";
import { invalidateAnalyticsCache } from "../analytics/analyticsServices.js";

//HELPER FUNCTION TO GET CATEGORY NAME
const getCategoryName = async (categoryId) => {
    const { rows } = await SQLquery('SELECT category_name FROM Category WHERE category_id = $1', [categoryId]);
    return rows[0]?.category_name || '';
};


const normalizeRoles = (roles) => Array.isArray(roles) ? roles : [];

const needsBranchManagerApproval = (roles) => {
    const normalized = normalizeRoles(roles);

    if (normalized.length === 0) {
        return true;
    }

    return !normalized.some(role => ['Branch Manager', 'Owner'].includes(role));
};

const normalizeWhitespace = (value) => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
const normalizeProductNameKey = (value) => normalizeWhitespace(value).toLowerCase();


export const createSystemInventoryNotification = async ({
    productId = null,
    branchId,
    alertType,
    message,
    bannerColor = 'blue',
    targetUserId = null
}) => {
    if (!branchId || !alertType || !message) {
        return null;
    }

    const alertResult = await SQLquery(
        `INSERT INTO Inventory_Alerts
         (product_id, branch_id, alert_type, message, banner_color, user_id, user_full_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING alert_id, alert_date` ,
        [productId, branchId, alertType, message, bannerColor, targetUserId || 0, 'System']
    );

    if (alertResult.rowCount === 0) {
        return null;
    }

    const { alert_id: alertId, alert_date: alertDate } = alertResult.rows[0];

    const resolvedAlertDate = (() => {
        if (!alertDate) return new Date().toISOString();
        if (alertDate instanceof Date) return alertDate.toISOString();

        const parsedDate = new Date(alertDate);
        if (!Number.isNaN(parsedDate.getTime())) {
            return parsedDate.toISOString();
        }

        return new Date().toISOString();
    })();

    return {
        alert_id: alertId,
        alert_date: resolvedAlertDate
    };
};


class InventoryValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'InventoryValidationError';
    }
}


const toNumberOrNull = (value) => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string' && value.trim() === '') return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
};


const roundToDecimals = (value, decimals) => {
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
};


const sanitizeProductPayload = (productData) => {
    if (!productData) return null;

    const sanitizedName = normalizeWhitespace(productData.product_name);
    const baseUnit = typeof productData.unit === 'string' ? productData.unit.trim() : productData.unit;
    let sanitizedUnitPrice = Number(productData.unit_price);
    if (!Number.isFinite(sanitizedUnitPrice)) {
        sanitizedUnitPrice = null;
    }

    if (!sanitizedUnitPrice || sanitizedUnitPrice <= 0) {
        sanitizedUnitPrice = Number(productData.unit_price);
    }

    // Only use date_added if explicitly provided - avoid defaulting to NOW because it makes update requests look like add-stocks
    let dateAdded = productData?.date_added ?? null;
    if (typeof dateAdded === 'string' && dateAdded.trim() === '') dateAdded = null;

    // Only use a product_validity value if explicitly provided by the requestor. Defaulting to 9999-12-31 causes update requests to appear as if validity was changed.
    let productValidity = productData.product_validity ?? null;
    if (typeof productValidity === 'string' && productValidity.trim() === '') productValidity = null;

    return {
        product_id: productData.product_id ?? null,
    product_name: sanitizedName,
        category_id: Number(productData.category_id),
        branch_id: Number(productData.branch_id),
        unit: baseUnit,
        unit_price: Number(sanitizedUnitPrice),
        unit_cost: Number(productData.unit_cost),
        quantity_added: safeNumber(productData.quantity_added),
        min_threshold: Number(productData.min_threshold),
        max_threshold: Number(productData.max_threshold),
        date_added: dateAdded,
        product_validity: productValidity,
        userID: productData.userID,
        fullName: productData.fullName,
        requestor_roles: normalizeRoles(productData.requestor_roles || productData.userRoles),
        existing_product_id: productData.existing_product_id || null,
        description: productData.description || null
    };
};


const ensureProductIsUniqueForBranch = async ({ branchId, productName, ignorePendingId = null }) => {
    const resolvedBranchId = Number(branchId);
    const normalizedName = normalizeProductNameKey(productName);

    if (!Number.isFinite(resolvedBranchId) || !normalizedName) {
        return;
    }

    const { rows: existingRows } = await SQLquery(
        `SELECT product_id, product_name
         FROM Inventory_Product
         WHERE branch_id = $1
           AND LOWER(TRIM(product_name)) = $2
         LIMIT 1`,
        [resolvedBranchId, normalizedName]
    );

    if (existingRows.length > 0) {
        const existingName = normalizeWhitespace(existingRows[0].product_name || productName);
        throw new Error(`Product already exists in this branch. "${existingName}" is already registered in your branch inventory.`);
    }

    const params = [resolvedBranchId, normalizedName];
    let pendingQuery = `
        SELECT pending_id
        FROM Inventory_Pending_Actions
        WHERE branch_id = $1
          AND status = 'pending'
          AND action_type = 'create'
          AND LOWER(TRIM(payload->'productData'->>'product_name')) = $2`;

    const resolvedIgnorePendingId = ignorePendingId !== null && ignorePendingId !== undefined ? Number(ignorePendingId) : null;

    if (resolvedIgnorePendingId !== null && Number.isFinite(resolvedIgnorePendingId)) {
        params.push(resolvedIgnorePendingId);
        pendingQuery += ' AND pending_id <> $3';
    }

    pendingQuery += ' LIMIT 1';

    const pendingResult = await SQLquery(pendingQuery, params);

    if (pendingResult.rowCount > 0) {
        const displayName = normalizeWhitespace(productName) || productName;
        throw new Error(`Product already exists in this branch. "${displayName}" already has a pending request awaiting approval.`);
    }
};


const mapPendingRequest = (row) => {
    if (!row) return null;

    return {
        pending_id: row.pending_id,
        branch_id: row.branch_id,
        branch_name: row.branch_name,
        product_id: row.product_id,
        action_type: row.action_type,
        status: row.status,
        current_stage: row.current_stage,
        requires_admin_review: row.requires_admin_review,
        created_by: row.created_by,
        created_by_name: row.created_by_name,
        created_by_roles: row.created_by_roles,
        manager_approver_id: row.manager_approver_id,
        manager_approved_at: row.manager_approved_at,
        manager_approver_name: row.manager_approver_name,
        admin_approver_id: row.admin_approver_id,
        admin_approved_at: row.admin_approved_at,
        approved_by: row.approved_by,
        approved_at: row.approved_at,
        rejection_reason: row.rejection_reason,
        cancelled_by: row.cancelled_by,
        cancelled_at: row.cancelled_at,
        cancelled_reason: row.cancelled_reason,
        created_at: row.created_at,
        payload: row.payload,
    };
};



const safeNumber = (value) => {
    if (value === null || value === undefined) return null;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
};

const deriveRequestStatusDetail = (row) => {
    if (!row) {
        return {
            code: 'unknown',
            label: 'Unknown status',
            tone: 'slate',
            is_final: false,
            stage: null
        };
    }

    if (row.status === 'approved') {
        return {
            code: 'approved',
            label: 'Approved',
            tone: 'emerald',
            is_final: true,
            stage: row.current_stage
        };
    }

    if (row.status === 'rejected') {
        return {
            code: 'rejected',
            label: 'Rejected',
            tone: 'rose',
            is_final: true,
            stage: row.current_stage
        };
    }

    if (row.status === 'deleted') {
        return {
            code: 'deleted',
            label: 'Deleted',
            tone: 'slate',
            is_final: true,
            stage: row.current_stage
        };
    }

    if (row.status === 'cancelled') {
        return {
            code: 'cancelled',
            label: 'Cancelled',
            tone: 'slate',
            is_final: true,
            stage: row.current_stage
        };
    }

    if (row.status === 'pending' && row.current_stage === 'admin_review') {
        return {
            code: 'pending_admin',
            label: 'Awaiting owner approval',
            tone: 'blue',
            is_final: false,
            stage: row.current_stage
        };
    }

    if (row.status === 'changes_requested') {
        return {
            code: 'changes_requested',
            label: 'Changes requested',
            tone: 'amber',
            is_final: false,
            stage: row.current_stage
        };
    }

    if (row.status === 'pending') {
        return {
            code: 'pending_manager',
            label: 'Awaiting branch manager approval',
            tone: 'amber',
            is_final: false,
            stage: row.current_stage
        };
    }

    const fallback = String(row.status || 'Unknown').replace(/_/g, ' ');

    return {
        code: String(row.status || 'unknown').toLowerCase(),
        label: fallback.charAt(0).toUpperCase() + fallback.slice(1),
        tone: 'slate',
        is_final: false,
        stage: row.current_stage
    };
};

const buildRequestSummary = (row) => {
    const payload = row?.payload || {};
    const productData = payload?.productData || payload || {};
    const currentState = payload?.currentState || null;

    const categoryName = payload?.category_name
        ?? productData?.category_name
        ?? currentState?.category_name
        ?? null;

    const quantityRequested = (() => {
        // Show requested quantity only for creation or when explicitly specified in update/create payload
        if (!row || !row.action_type) return null;
        const isCreate = row.action_type === 'create';
        const isUpdate = row.action_type === 'update';
        if (isCreate) return safeNumber(productData?.quantity_added ?? productData?.quantity);
        if (isUpdate) {
            // Only show if the productData explicitly contains quantity_added or quantity property
            if (productData && (Object.prototype.hasOwnProperty.call(productData, 'quantity_added') || Object.prototype.hasOwnProperty.call(productData, 'quantity'))) {
                return safeNumber(productData?.quantity_added ?? productData?.quantity);
            }
            return null;
        }
        return safeNumber(productData?.quantity_added ?? productData?.quantity);
    })();

    return {
        product_name: productData?.product_name || currentState?.product_name || 'Inventory item',
        category_name: categoryName,
        action_label: row?.action_type === 'update' ? 'Update existing item' : 'Add new item',
        quantity_requested: quantityRequested,
        current_quantity: safeNumber(currentState?.quantity),
        unit: productData?.unit || currentState?.unit || null,
        unit_price: safeNumber(productData?.unit_price),
        unit_cost: safeNumber(productData?.unit_cost)
    };
};

const mapRequestStatusRow = (row, options = {}) => {
    if (!row) return null;

    const includePayload = Boolean(options.includePayload);
    const statusDetail = deriveRequestStatusDetail(row);
    const summary = buildRequestSummary(row);
    const finalDecisionAt = row.status === 'pending'
        ? null
        : (row.cancelled_at || row.admin_approved_at || row.approved_at || row.manager_approved_at || null);

    const managerTimeline = {
        status: row.manager_approved_at ? 'completed' : 'pending',
        acted_at: row.manager_approved_at || null,
        approver_id: row.manager_approver_id || null,
        approver_name: row.manager_approver_name || null
    };

    const adminTimeline = row.requires_admin_review ? {
        status: row.admin_approved_at ? 'completed' : (statusDetail.code === 'pending_admin' ? 'pending' : null),
        acted_at: row.admin_approved_at || null,
        approver_id: row.admin_approver_id || null,
        approver_name: row.admin_approver_name || null
    } : null;

    const lastActivity = finalDecisionAt
        || row.cancelled_at
        || (adminTimeline?.acted_at ?? null)
        || (managerTimeline.acted_at ?? null)
        || row.created_at
        || null;

    return {
        pending_id: row.pending_id,
        branch_id: row.branch_id,
        branch_name: row.branch_name,
        product_id: row.product_id,
        action_type: row.action_type,
        status: row.status,
        current_stage: row.current_stage,
        requires_admin_review: row.requires_admin_review,
        created_by: row.created_by,
        created_by_name: row.created_by_name,
        created_by_roles: normalizeRoles(row.created_by_roles),
        manager_approver_id: row.manager_approver_id,
        manager_approver_name: row.manager_approver_name,
        manager_approved_at: row.manager_approved_at,
        admin_approver_id: row.admin_approver_id,
        admin_approver_name: row.admin_approver_name,
        admin_approved_at: row.admin_approved_at,
        approved_by: row.approved_by,
        approved_at: row.approved_at,
        rejection_reason: row.rejection_reason,
        cancelled_by: row.cancelled_by,
        cancelled_at: row.cancelled_at,
        cancelled_reason: row.cancelled_reason,
        created_at: row.created_at,
        last_activity_at: lastActivity,
        status_detail: statusDetail,
        summary,
        timeline: {
            submitted_at: row.created_at || null,
            manager: managerTimeline,
            admin: adminTimeline,
            final: {
                status: row.status,
                acted_at: finalDecisionAt,
                rejection_reason: row.status === 'deleted'
                    ? (row.cancelled_reason || row.rejection_reason || null)
                    : (row.rejection_reason || null),
                cancellation_reason: row.status === 'cancelled' ? row.cancelled_reason : null
            }
        },
        payload: includePayload ? row.payload : undefined,
        change_request_type: row.change_request_type || null,
        change_request_comment: row.change_request_comment || null,
        change_requested_by: row.change_requested_by || null,
        change_requested_at: row.change_requested_at || null
    };
};


const getUserFullName = async (userId) => {
    if (!userId) return null;
    const { rows } = await SQLquery('SELECT first_name, last_name FROM Users WHERE user_id = $1', [userId]);
    if (rows.length === 0) return null;
    return `${rows[0].first_name} ${rows[0].last_name}`.trim();
};

const getAdminFullName = async (adminId) => {
    if (!adminId) return null;
    const { rows } = await SQLquery('SELECT first_name, last_name FROM Administrator WHERE admin_id = $1', [adminId]);
    if (rows.length === 0) return null;
    return `${rows[0].first_name ?? ''} ${rows[0].last_name ?? ''}`.trim();
};


const createPendingInventoryAction = async ({
    actionType,
    productData,
    branchId,
    productId = null,
    currentState = null,
    initialStage = 'manager_review',
    managerApproverId = null,
    managerApproverName = null,
    managerApprovedAt = null
}) => {
    const sanitizedPayload = sanitizeProductPayload(productData);
    const categoryName = sanitizedPayload?.category_id ? await getCategoryName(sanitizedPayload.category_id) : null;
    const isCreateAction = actionType === 'create';
    const requiresAdminReview = isCreateAction && !(sanitizedPayload?.existing_product_id);
    const stage = initialStage;

    const managerId = managerApproverId ?? null;
    let managerApprovedTimestamp = managerApprovedAt ? new Date(managerApprovedAt).toISOString() : null;

    if (!managerApprovedTimestamp && stage === 'admin_review' && managerId) {
        managerApprovedTimestamp = new Date().toISOString();
    }

    const approvedByValue = stage === 'admin_review' && managerId ? managerId : null;
    const approvedAtValue = approvedByValue ? managerApprovedTimestamp : null;

    const payload = {
        productData: sanitizedPayload,
        currentState,
        category_name: categoryName
    };

    const insertResult = await SQLquery(
        `INSERT INTO Inventory_Pending_Actions
            (branch_id, product_id, action_type, payload, status, current_stage, requires_admin_review, created_by, created_by_name, created_by_roles, manager_approver_id, manager_approved_at, approved_by, approved_at)
         VALUES ($1, $2, $3, $4::jsonb, 'pending', $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING *`,
        [
            branchId,
            productId,
            actionType,
            JSON.stringify(payload),
            stage,
            requiresAdminReview,
            sanitizedPayload?.userID || null,
            sanitizedPayload?.fullName || null,
            sanitizedPayload?.requestor_roles || [],
            managerId,
            managerApprovedTimestamp,
            approvedByValue,
            approvedAtValue
        ]
    );

    // Fetch the branch_name separately
    const { rows } = await SQLquery(
        `SELECT ipa.*, b.branch_name
         FROM Inventory_Pending_Actions ipa
         LEFT JOIN Branch b ON b.branch_id = ipa.branch_id
         WHERE ipa.pending_id = $1`,
        [insertResult.rows[0].pending_id]
    );

    const mapped = mapPendingRequest(rows[0]);

    if (mapped) {
        const requesterName = sanitizedPayload?.fullName || 'Inventory staff member';
        const productName = sanitizedPayload?.product_name || 'an inventory item';
        const categoryLabel = categoryName ? ` (${categoryName})` : '';
        const verb = actionType === 'update' ? 'update' : 'add';
        const managerName = managerApproverName || requesterName;

        if (mapped.current_stage === 'admin_review') {
            const ownerRequest = managerName
                ? { ...mapped, manager_approver_name: managerName }
                : mapped;

            broadcastInventoryApprovalRequestToOwners({ request: ownerRequest });

            if (requiresAdminReview) {
                const adminNotificationMessage = `${managerName || 'Branch Manager'} submitted a request to ${verb} ${productName}${categoryLabel}. Awaiting owner approval.`;

                const alertResult = await SQLquery(
                    `INSERT INTO Inventory_Alerts 
                    (product_id, branch_id, alert_type, message, banner_color, user_id, user_full_name)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                    RETURNING *`,
                    [
                        productId ?? sanitizedPayload?.product_id ?? null,
                        branchId,
                        'Inventory Admin Approval Needed',
                        adminNotificationMessage,
                        'orange',
                        managerId || sanitizedPayload?.userID || null,
                        'System'
                    ]
                );

                if (alertResult.rows[0]) {
                    broadcastOwnerNotification({
                        alert_id: alertResult.rows[0].alert_id,
                        alert_type: 'Inventory Admin Approval Needed',
                        message: adminNotificationMessage,
                        banner_color: 'orange',
                        alert_date: alertResult.rows[0].alert_date,
                        isDateToday: true,
                        alert_date_formatted: 'Just now'
                    }, { category: 'inventory', targetRoles: ['Owner'] });
                }
            }

            // No direct notification for branch manager in this path to avoid duplicate pop-ups
        } else {
            broadcastInventoryApprovalRequest(branchId, { request: mapped });

            const notificationMessage = `${requesterName} submitted a request to ${verb} ${productName}${categoryLabel}.`;

            const alertResult = await SQLquery(
                `INSERT INTO Inventory_Alerts 
                (product_id, branch_id, alert_type, message, banner_color, user_id, user_full_name)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING *`,
                [productId ?? sanitizedPayload?.product_id ?? null, branchId, 'Inventory Approval Needed', notificationMessage, 'orange', 0, 'System']
            );

            if (alertResult.rows[0]) {
                broadcastNotification(branchId, {
                    alert_id: alertResult.rows[0].alert_id,
                    alert_type: 'Inventory Approval Needed',
                    message: notificationMessage,
                    banner_color: 'orange',
                    user_id: alertResult.rows[0].user_id,
                    user_full_name: 'System',
                    alert_date: alertResult.rows[0].alert_date,
                    alert_timestamp: alertResult.rows[0].alert_date,
                    add_stock_id: null,
                    history_timestamp: null,
                    isDateToday: true,
                    alert_date_formatted: 'Just now',
                    target_roles: ['Branch Manager'],
                    creator_id: sanitizedPayload?.userID || null
                }, { category: 'inventory', targetRoles: ['Branch Manager'] });
            }
        }
    }

    return mapped;
};



// GET ALL UNIQUE PRODUCTS ACROSS ALL BRANCHES (FOR PRODUCT SELECTION)
export const getAllUniqueProducts = async () => {
    const { rows } = await SQLquery(`
        SELECT DISTINCT 
            ip.product_id,
            ip.product_name,
            c.category_id,
            c.category_name,
            ip.unit,
            p.description,
            '[]'::jsonb AS selling_units,
            STRING_AGG(DISTINCT b.branch_name, ', ' ORDER BY b.branch_name) as branches
        FROM inventory_product ip
        LEFT JOIN category c USING(category_id)
        LEFT JOIN branch b ON ip.branch_id = b.branch_id
        LEFT JOIN products p ON ip.product_id = p.product_id
        GROUP BY ip.product_id, ip.product_name, c.category_name, ip.unit, c.category_id, p.description
        ORDER BY ip.product_name ASC
    `);

    return rows;
};



//INVENTORY SERVICES
const getUpdatedInventoryList =  async (productId, branchId) => {
   const { rows } = await SQLquery(
        `SELECT 
            ip.product_id, 
            ip.branch_id, 
            Category.category_id, 
            Category.category_name, 
            ip.product_name, 
            ip.unit, 
            ip.unit_price, 
            ip.unit_cost, 
            '[]'::jsonb AS selling_units,
            COALESCE(SUM(CASE WHEN ast.product_validity < NOW() THEN 0 ELSE ast.quantity_left_display END), 0) AS quantity,
            ip.min_threshold,
            ip.max_threshold,
            p.description
        FROM inventory_product ip
        LEFT JOIN Category USING(category_id)
        LEFT JOIN Add_Stocks ast USING(product_id, branch_id)
        LEFT JOIN products p ON ip.product_id = p.product_id
        WHERE ip.product_id = $1 AND ip.branch_id = $2
        GROUP BY 
            ip.product_id, 
            ip.branch_id, 
            Category.category_id, 
            Category.category_name, 
            ip.product_name, 
            ip.unit, 
            ip.unit_price, 
            ip.unit_cost, 
            ip.min_threshold,
            ip.max_threshold,
            p.description`,
        [productId, branchId],
    );

    return rows[0];
};



export const getProductItems = async(branchId) => {

    if (!branchId){
        const {rows} = await SQLquery(`
            SELECT 
                ip.product_id, 
                ip.branch_id, 
                c.category_id, 
                c.category_name, 
                ip.product_name, 
                ip.unit, 
                ip.unit_price, 
                ip.unit_cost, 
                '[]'::jsonb AS selling_units,
                COALESCE(SUM(CASE WHEN ast.product_validity < NOW() THEN 0 ELSE ast.quantity_left_display END), 0) AS quantity,
                ip.min_threshold,
                ip.max_threshold,
                p.description
            FROM inventory_product ip
            LEFT JOIN category c USING(category_id)
            LEFT JOIN add_stocks ast USING(product_id, branch_id)
            LEFT JOIN products p ON ip.product_id = p.product_id
            GROUP BY 
                ip.product_id, 
                ip.branch_id, 
                c.category_id, 
                c.category_name, 
                ip.product_name, 
                ip.unit, 
                ip.unit_price, 
                ip.unit_cost, 
                ip.min_threshold,
                ip.max_threshold,
                p.description
            ORDER BY ip.product_id ASC;
        `);

        return rows;

    }; 


    const {rows} = await SQLquery(`
        SELECT 
            ip.product_id, 
            ip.branch_id, 
            Category.category_id, 
            Category.category_name, 
            ip.product_name, 
            ip.unit, 
            ip.unit_price, 
            ip.unit_cost, 
            '[]'::jsonb AS selling_units,
            COALESCE(SUM(CASE WHEN ast.product_validity < NOW() THEN 0 ELSE ast.quantity_left_display END), 0) AS quantity,
            ip.min_threshold,
            ip.max_threshold,
            p.description
        FROM inventory_product ip  
        LEFT JOIN Category USING(category_id)
        LEFT JOIN Add_Stocks ast USING(product_id, branch_id)
        LEFT JOIN products p ON ip.product_id = p.product_id
        WHERE ip.branch_id = $1
        GROUP BY 
            ip.product_id, 
            ip.branch_id, 
            Category.category_id, 
            Category.category_name, 
            ip.product_name, 
            ip.unit, 
            ip.unit_price, 
            ip.unit_cost, 
            ip.min_threshold,
            ip.max_threshold,
            p.description
        ORDER BY ip.product_id ASC
    `,[branchId]);

    return rows;

};



export const addProductItem = async (productData, options = {}) => {
    const { bypassApproval = false, requestedBy = null, actingUser = null, pendingActionId = null } = options;

    const roles = normalizeRoles(productData.requestor_roles || productData.userRoles);
    const isBranchManager = roles.includes('Branch Manager');
    const isOwner = roles.includes('Owner');
    const actingUserId = actingUser?.userID ?? productData.userID;
    const actingUserName = actingUser?.fullName ?? productData.fullName;
    const requiresApproval = !bypassApproval && needsBranchManagerApproval(roles);

    const cleanedData = sanitizeProductPayload({
        ...productData,
        userID: actingUserId,
        fullName: actingUserName
    });

    const { product_name, category_id, branch_id, unit, unit_price, unit_cost, quantity_added, min_threshold, max_threshold, date_added: raw_date_added, product_validity: raw_product_validity, userID, fullName, existing_product_id, description } = cleanedData;
    const date_added = raw_date_added ?? new Date().toISOString();
    const product_validity = raw_product_validity ?? '9999-12-31';

    const isNewProductSubmission = !existing_product_id;
    const ignorePendingId = bypassApproval ? pendingActionId : null;

    await ensureProductIsUniqueForBranch({
        branchId: branch_id,
        productName: product_name,
        ignorePendingId
    });

    if (requiresApproval) {
        const pendingRecord = await createPendingInventoryAction({
            actionType: 'create',
            productData: cleanedData,
            branchId: branch_id,
            productId: existing_product_id || null,
            currentState: null
        });

        return { status: 'pending', action: 'create', pending: pendingRecord };
    }

    if (!bypassApproval && isNewProductSubmission && isBranchManager && !isOwner) {
        const pendingRecord = await createPendingInventoryAction({
            actionType: 'create',
            productData: cleanedData,
            branchId: branch_id,
            productId: null,
            currentState: null,
            initialStage: 'admin_review',
            managerApproverId: actingUserId || null,
            managerApproverName: actingUserName || null
        });

        return {
            status: 'pending',
            next_stage: 'admin_review',
            action: 'create',
            pending: pendingRecord
        };
    }

    const productAddedNotifheader = "New Product";
    const requestSuffix = requestedBy?.fullName && requestedBy.userID !== userID ? ` Requested by ${requestedBy.fullName}.` : '';
    const notifMessage = `${product_name} has been added to the inventory with ${quantity_added} ${unit}.${requestSuffix}`;
    const color = 'green';

    let product_id;

    if (existing_product_id) {
        const existsInBranch = await SQLquery(
            'SELECT 1 FROM Inventory_Product WHERE product_id = $1 AND branch_id = $2', 
            [existing_product_id, branch_id]
        );
        
        if (existsInBranch.rowCount > 0) {
            throw new Error(`Product already exists in this branch. "${product_name}" is already registered in your branch inventory.`);
        }
        
        product_id = existing_product_id;
    } else {
        let isUnique = false;
        let retryCount = 0;
        const maxRetries = 10;
        
        while (!isUnique && retryCount < maxRetries) {
            product_id = Math.floor(100000 + Math.random() * 900000); 
            
            try {
                const check = await SQLquery('SELECT 1 FROM Inventory_Product WHERE product_id = $1 FOR UPDATE', [product_id]);
                if (check.rowCount === 0) {
                    isUnique = true;
                } else {
                    retryCount++;
                    await new Promise(resolve => setTimeout(resolve, Math.random() * 50));
                }
            } catch (error) {
                retryCount++;
                if (retryCount >= maxRetries) {
                    throw new Error('Unable to generate unique product ID after multiple attempts');
                }
            }
        }

        if (!isUnique) {
            throw new Error('Unable to generate unique product ID');
        }
    }

    await SQLquery('BEGIN');

    try {
        const prodCheck = await SQLquery('SELECT 1 FROM products WHERE product_id = $1', [product_id]);
        if (prodCheck.rowCount === 0) {
            await SQLquery(
                `INSERT INTO products (product_id, product_name, description)
                 VALUES ($1, $2, $3)` ,
                [product_id, product_name, description || 'N/A']
            );
        }
    } catch (err) {
        await SQLquery('ROLLBACK');
        throw err;
    }

    // Get base unit and conversion factor for the unit
    const unitConversion = getUnitConversion(unit);
    
    await SQLquery(
        `INSERT INTO Inventory_Product 
        (product_id, category_id, branch_id, product_name, unit, unit_price, unit_cost, min_threshold, max_threshold, base_unit, conversion_factor)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [product_id, category_id, branch_id, product_name, unit, unit_price, unit_cost, min_threshold, max_threshold, unitConversion.base_unit, unitConversion.conversion_factor]
    );   

    // Calculate base units for storage - ensure quantity_added is a number
    const quantity_added_base = convertToBaseUnit(Number(quantity_added), unit);
    
    const addStockInsert = await SQLquery(
        `INSERT INTO Add_Stocks 
        (product_id, h_unit_price, h_unit_cost, quantity_added_display, quantity_added_base, date_added, product_validity, quantity_left_display, quantity_left_base, branch_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *`,
        [product_id, unit_price, unit_cost, Number(quantity_added), quantity_added_base, date_added, product_validity, Number(quantity_added), quantity_added_base, branch_id]
    );

    const addedStockRow = addStockInsert.rows?.[0] ?? null;

    const alertResult = await SQLquery(
        `INSERT INTO Inventory_Alerts 
        (product_id, branch_id, alert_type, message, banner_color, user_id, user_full_name)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *`,
        [product_id, branch_id, productAddedNotifheader, notifMessage, color, 0, 'System']
    );

    if (alertResult.rows[0] && addedStockRow?.add_id) {
        await SQLquery(
            `INSERT INTO inventory_alert_history_links (alert_id, add_id, alert_timestamp, history_timestamp)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (alert_id) DO UPDATE
             SET add_id = EXCLUDED.add_id,
                 alert_timestamp = EXCLUDED.alert_timestamp,
                 history_timestamp = EXCLUDED.history_timestamp`,
            [
                alertResult.rows[0].alert_id,
                addedStockRow.add_id,
                alertResult.rows[0].alert_date,
                addedStockRow.date_added
            ]
        );
    }

    await SQLquery('COMMIT');

    invalidateAnalyticsCache();

    const alertTimestamp = alertResult.rows[0]?.alert_date ?? null;

    if (alertResult.rows[0]) {
        broadcastNotification(branch_id, {
            alert_id: alertResult.rows[0].alert_id,
            alert_type: productAddedNotifheader,
            message: notifMessage,
            banner_color: color,
            user_id: alertResult.rows[0].user_id,
            user_full_name: 'System',
            alert_date: alertResult.rows[0].alert_date,
            product_id: product_id,
            add_stock_id: addedStockRow?.add_id ?? null,
            history_timestamp: addedStockRow?.date_added ?? null,
            alert_timestamp: alertTimestamp,
            isDateToday: true,
            alert_date_formatted: 'Just now'
        }); // Removed excludeUserId so all users including requester see the new product notification
    }

    const newProductRow = await getUpdatedInventoryList(product_id, branch_id);

    await checkAndHandleLowStock(product_id, branch_id, {
        triggeredByUserId: userID,
        triggerUserName: 'System'
    });

    broadcastInventoryUpdate(branch_id, {
        action: 'add',
        product: newProductRow,
        user_id: userID,
        requested_by: requestedBy ? { user_id: requestedBy.userID, full_name: requestedBy.fullName } : null
    });

    const categoryName = await getCategoryName(category_id);
    const addedDateObj = new Date(date_added);

    if (product_validity && product_validity !== '9999-12-31') {
        const validityDateObj = new Date(product_validity);
        const currentDate = new Date();
        
        const daysUntilExpiry = Math.ceil((validityDateObj - currentDate) / (1000 * 60 * 60 * 24));
        const near_expy = daysUntilExpiry <= 3 && daysUntilExpiry >= 0;
        const expy = validityDateObj <= currentDate;

        broadcastValidityUpdate(branch_id, {
            action: 'add',
            product: {
                product_id: product_id,
                product_name: product_name,
                category_name: categoryName,
                quantity_added: quantity_added,
                quantity_left: quantity_added,
                formated_date_added: addedDateObj.toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                }),
                formated_product_validity: validityDateObj.toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                }),
                date_added: date_added,
                product_validity: product_validity,
                near_expy: near_expy,
                expy: expy
            },
            user_id: userID
        });
    }

    broadcastHistoryUpdate(branch_id, {
        action: 'add',
        historyEntry: {
            add_id: addedStockRow?.add_id ?? null,
            add_stock_id: addedStockRow?.add_id ?? null,
            product_id: product_id,
            product_name: product_name,
            category_name: categoryName,
            h_unit_cost: unit_cost,
            quantity_added: quantity_added,
            value: unit_cost * quantity_added,
            formated_date_added: addedDateObj.toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            }),
            date_added: date_added,
            branch_id: branch_id,
            alert_timestamp: alertTimestamp,
            history_timestamp: addedStockRow?.date_added ?? null
        },
        user_id: userID
    });

    return { status: 'approved', action: 'create', product: newProductRow };
};



export const updateProductItem = async (productData, itemId, options = {}) => {
    const { bypassApproval = false, requestedBy = null, actingUser = null } = options;

    const roles = normalizeRoles(productData.requestor_roles || productData.userRoles);
    const branchIdNumeric = Number(productData.branch_id);

    if (!bypassApproval && needsBranchManagerApproval(roles)) {
        const currentState = await getUpdatedInventoryList(itemId, branchIdNumeric);
        const pendingRecord = await createPendingInventoryAction({
            actionType: 'update',
            productData: { ...productData, product_id: itemId },
            branchId: branchIdNumeric,
            productId: itemId,
            currentState
        });

        return { status: 'pending', action: 'update', pending: pendingRecord };
    }

    const actingUserId = actingUser?.userID ?? productData.userID;
    const actingUserName = actingUser?.fullName ?? productData.fullName;

    const cleanedData = sanitizeProductPayload({
        ...productData,
        userID: actingUserId,
        fullName: actingUserName,
        branch_id: branchIdNumeric
    });

    const { product_name, branch_id, category_id, unit, unit_price, unit_cost, quantity_added, min_threshold, max_threshold, date_added, product_validity, userID, fullName } = cleanedData;

    const addStocksQuery = async () => {
        // Calculate base units for storage - ensure quantity_added is a number
        const quantity_added_base = convertToBaseUnit(Number(quantity_added), unit);

        const result = await SQLquery(
            `INSERT INTO Add_Stocks 
            (product_id, h_unit_price, h_unit_cost, quantity_added_display, quantity_added_base, date_added, product_validity, quantity_left_display, quantity_left_base, branch_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *`,
            [itemId, unit_price, unit_cost, Number(quantity_added), quantity_added_base, date_added, product_validity, Number(quantity_added), quantity_added_base, branch_id]
        );

        return result.rows?.[0] ?? null;
    };

    const previousData = await SQLquery(
        'SELECT branch_id, unit_price, unit_cost, product_name, unit, min_threshold, max_threshold, category_id FROM Inventory_Product WHERE product_id = $1 AND branch_id = $2 FOR UPDATE',
        [itemId, branch_id]
    );

    if (previousData.rowCount === 0) {
        throw new Error(`Product with ID ${itemId} not found`);
    }

    const prev = previousData.rows[0];
    const returnPreviousPrice = Number(prev.unit_price);
    const returnBranchId = Number(prev.branch_id);
    const unitChanged = prev.unit !== unit;
    const roundedIncomingPrice = roundToDecimals(Number(unit_price), 2);
    const normalizedUnitPrice = Number.isFinite(roundedIncomingPrice) ? roundedIncomingPrice : Number(unit_price);
    const roundedPreviousPrice = roundToDecimals(returnPreviousPrice, 2);
    const previousUnitPriceRounded = Number.isFinite(roundedPreviousPrice) ? roundedPreviousPrice : returnPreviousPrice;
    const priceChanged = previousUnitPriceRounded !== normalizedUnitPrice;

    const productInfoChanged =
        prev.product_name !== product_name ||
        unitChanged ||
        Number(prev.min_threshold) !== Number(min_threshold) ||
        Number(prev.max_threshold) !== Number(max_threshold) ||
        Number(prev.category_id) !== Number(category_id) ||
        Number(prev.unit_cost) !== Number(unit_cost);

    const productAddedNotifheader = "Product Update";
    const requestSuffix = requestedBy?.fullName && requestedBy.userID !== userID ? ` (Requested by ${requestedBy.fullName})` : '';

    const addqQuantityNotifMessage = `Additional ${quantity_added} ${unit} has been added to ${product_name} at a cost of ₱ ${unit_cost}.`;
    const changePriceNotifMessage = `The price of ${product_name} has been changed from ₱ ${previousUnitPriceRounded} to ₱ ${normalizedUnitPrice}.`;
    const color = 'blue';

    await SQLquery('BEGIN');

    let alertResult = null;
    let finalMessage = '';
    let hasQuantityChange = false;
    let hasInfoChange = false;

    let addedStockRow = null;

    if (quantity_added !== null && Number(quantity_added) !== 0) {
        addedStockRow = await addStocksQuery();
        hasQuantityChange = true;
    }

    if (priceChanged) {
        await SQLquery(
            `UPDATE Inventory_Product 
            SET unit_price = $1 
            WHERE product_id = $2 AND branch_id = $3`,
            [normalizedUnitPrice, itemId, branch_id]
        );
    }

    // Build combined message
    const messages = [];

    if (quantity_added !== 0 && priceChanged) {
        messages.push(`${addqQuantityNotifMessage} and ${changePriceNotifMessage}`);
    } else if (quantity_added !== 0 && !priceChanged) {
        messages.push(addqQuantityNotifMessage);
    } else if (quantity_added === 0 && priceChanged) {
        messages.push(changePriceNotifMessage);
    }

    if (productInfoChanged) {
        messages.push(`Product information for ${product_name} has been updated.`);
        hasInfoChange = true;
    }

    if (messages.length > 0) {
        finalMessage = messages.join(' ') + requestSuffix;
        alertResult = await SQLquery(
            `INSERT INTO Inventory_Alerts 
            (product_id, branch_id, alert_type, message, banner_color, user_id, user_full_name)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *`,
            [itemId, returnBranchId, productAddedNotifheader, finalMessage, color, 0, 'System']
        );

        if (alertResult?.rows[0]) {
            const alertTimestamp = alertResult.rows[0]?.alert_date ?? null;

            if (addedStockRow?.add_id) {
                await SQLquery(
                    `INSERT INTO inventory_alert_history_links (alert_id, add_id, alert_timestamp, history_timestamp)
                     VALUES ($1, $2, $3, $4)
                     ON CONFLICT (alert_id) DO UPDATE
                     SET add_id = EXCLUDED.add_id,
                         alert_timestamp = EXCLUDED.alert_timestamp,
                         history_timestamp = EXCLUDED.history_timestamp`,
                    [
                        alertResult.rows[0].alert_id,
                        addedStockRow.add_id,
                        alertResult.rows[0].alert_date,
                        addedStockRow.date_added
                    ]
                );
            }

            broadcastNotification(returnBranchId, {
                alert_id: alertResult.rows[0].alert_id,
                alert_type: productAddedNotifheader,
                message: finalMessage,
                banner_color: color,
                user_id: alertResult.rows[0].user_id,
                user_full_name: 'System',
                alert_date: alertResult.rows[0].alert_date,
                product_id: itemId,
                add_stock_id: addedStockRow?.add_id ?? null,
                history_timestamp: addedStockRow?.date_added ?? null,
                alert_timestamp: alertTimestamp,
                isDateToday: true,
                alert_date_formatted: 'Just now'
            }); // Removed excludeUserId so inventory staff sees the update
        }

        if (requestedBy?.userID && !bypassApproval) {
            const approvalMessage = `Your product update request for ${product_name} has been approved by the branch manager (${actingUser?.fullName}).`;
            const privateAlert = await createSystemInventoryNotification({
                productId: itemId,
                branchId: returnBranchId,
                alertType: 'Product Update Approved',
                message: approvalMessage,
                bannerColor: 'blue',
                targetUserId: requestedBy.userID
            });

            if (privateAlert) {
                broadcastToUser(requestedBy.userID, {
                    alert_id: privateAlert.alert_id,
                    alert_type: 'Product Update Approved',
                    message: approvalMessage,
                    banner_color: 'blue',
                    user_full_name: 'System',
                    alert_date: privateAlert.alert_date,
                    product_id: itemId,
                    isDateToday: true,
                    alert_date_formatted: 'Just now'
                }, { persist: false }); // Skip persistence since already created
            }
        }
    }

    if (productInfoChanged) {
        // Get base unit and conversion factor for the new unit
        const unitConversion = getUnitConversion(unit);
        
        await SQLquery(
            `UPDATE Inventory_Product 
            SET product_name = $1, unit = $2, min_threshold = $3, category_id = $4, unit_cost = $5, base_unit = $6, conversion_factor = $7
            WHERE product_id = $8 AND branch_id = $9 AND max_threshold = $10`,
            [product_name, unit, min_threshold, category_id, unit_cost, unitConversion.base_unit, unitConversion.conversion_factor, itemId, branch_id, max_threshold]
        );
    }

    await SQLquery('COMMIT');

    invalidateAnalyticsCache();

    const updatedProductRow = await getUpdatedInventoryList(itemId, branch_id);

    await checkAndHandleLowStock(itemId, branch_id, {
        triggeredByUserId: userID,
        triggerUserName: 'System'
    });

    broadcastInventoryUpdate(branch_id, {
        action: 'update',
        product: updatedProductRow,
        user_id: userID,
        requested_by: requestedBy ? { user_id: requestedBy.userID, full_name: requestedBy.fullName } : null
    });

    if (quantity_added > 0) {
        const categoryName = await getCategoryName(category_id);
        const addedDateObj = new Date(date_added);

        if (product_validity && product_validity !== '9999-12-31') {
            const validityDateObj = new Date(product_validity);
            const currentDate = new Date();
            const daysUntilExpiry = Math.ceil((validityDateObj - currentDate) / (1000 * 60 * 60 * 24));
            const near_expy = daysUntilExpiry <= 3 && daysUntilExpiry >= 0;
            const expy = validityDateObj <= currentDate;

            broadcastValidityUpdate(branch_id, {
                action: 'update',
                product: {
                    product_id: itemId,
                    product_name: product_name,
                    category_name: categoryName,
                    quantity_added: quantity_added,
                    quantity_left: quantity_added,
                    formated_date_added: addedDateObj.toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                    }),
                    formated_product_validity: validityDateObj.toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                    }),
                    date_added: date_added,
                    product_validity: product_validity,
                    near_expy: near_expy,
                    expy: expy
                },
                user_id: userID
            });
        }

        broadcastHistoryUpdate(branch_id, {
            action: 'update',
            historyEntry: {
                add_id: addedStockRow?.add_id ?? null,
                add_stock_id: addedStockRow?.add_id ?? null,
                product_id: itemId,
                product_name: product_name,
                category_name: categoryName,
                h_unit_cost: unit_cost,
                quantity_added: quantity_added,
                value: unit_cost * quantity_added,
                formated_date_added: addedDateObj.toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                }),
                date_added: date_added,
                branch_id: branch_id,
                alert_timestamp: (alertResult?.rows?.[0]?.alert_date) ?? null,
                history_timestamp: addedStockRow?.date_added ?? null
            },
            user_id: userID
        });
    }

    return { status: 'approved', action: 'update', product: updatedProductRow };
};



export const searchProductItem = async (searchItem) =>{
    const {rows} = await SQLquery('SELECT * FROM Inventory_Product WHERE product_name ILIKE $1', [`%${searchItem}%`]);

    return rows;
};


export const getPendingInventoryRequests = async (branchId) => {
    const { rows } = await SQLquery(
        `SELECT ipa.*, b.branch_name,
                (manager.first_name || ' ' || manager.last_name) AS manager_approver_name
         FROM Inventory_Pending_Actions ipa
         LEFT JOIN Branch b ON ipa.branch_id = b.branch_id
         LEFT JOIN Users manager ON manager.user_id = ipa.manager_approver_id
         WHERE ipa.branch_id = $1 AND ipa.status = 'pending' AND ipa.current_stage = 'manager_review'
         ORDER BY ipa.created_at ASC`,
        [branchId]
    );

    return rows.map(mapPendingRequest);
};

export const getAdminPendingInventoryRequests = async () => {
    const { rows } = await SQLquery(
        `SELECT ipa.*, b.branch_name,
                (manager.first_name || ' ' || manager.last_name) AS manager_approver_name
         FROM Inventory_Pending_Actions ipa
         LEFT JOIN Branch b ON ipa.branch_id = b.branch_id
         LEFT JOIN Users manager ON manager.user_id = ipa.manager_approver_id
         WHERE ipa.status = 'pending' AND ipa.current_stage = 'admin_review'
         ORDER BY ipa.created_at ASC`
    );

    return rows.map(mapPendingRequest);
};


export const getInventoryRequestStatusFeed = async (options = {}) => {
    const {
        scope = 'user',
        branchId = null,
        requesterId = null,
        statuses = null,
        limit = 20,
        offset = 0,
        includePayload = false
    } = options;

    const filters = [];
    const params = [];
    let paramIndex = 1;

    if (scope === 'user' && requesterId) {
        filters.push(`ipa.created_by = $${paramIndex++}`);
        params.push(requesterId);
    } else if (scope === 'branch' && branchId) {
        filters.push(`ipa.branch_id = $${paramIndex++}`);
        params.push(branchId);
    } else if (scope === 'admin' && branchId) {
        filters.push(`ipa.branch_id = $${paramIndex++}`);
        params.push(branchId);
    }

    if (Array.isArray(statuses) && statuses.length > 0) {
        const normalized = statuses
            .map(status => String(status || '').toLowerCase())
            .filter(Boolean);

        const hasPendingAdmin = normalized.includes('pending_admin');
        const withoutPendingAdmin = normalized.filter(status => status !== 'pending_admin');

        if (withoutPendingAdmin.length > 0) {
            filters.push(`LOWER(ipa.status) = ANY($${paramIndex++})`);
            params.push(withoutPendingAdmin);
        }

        if (hasPendingAdmin) {
            filters.push(`(ipa.status = 'pending' AND ipa.current_stage = 'admin_review')`);
        }
    }

    const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

    const numericLimit = Math.max(1, Math.min(Number(limit) || 20, 200));
    const numericOffset = Math.max(0, Number(offset) || 0);

    const query = `
        SELECT ipa.*,
               b.branch_name,
               (manager.first_name || ' ' || manager.last_name) AS manager_approver_name,
               (admin.first_name || ' ' || admin.last_name) AS admin_approver_name
        FROM Inventory_Pending_Actions ipa
        LEFT JOIN Branch b ON ipa.branch_id = b.branch_id
        LEFT JOIN Users manager ON manager.user_id = ipa.manager_approver_id
        LEFT JOIN Administrator admin ON admin.admin_id = ipa.admin_approver_id
        ${whereClause}
        ORDER BY ipa.created_at DESC
        LIMIT $${paramIndex++}
        OFFSET $${paramIndex++}`;

    params.push(numericLimit, numericOffset);

    const { rows } = await SQLquery(query, params);
    return rows.map(row => mapRequestStatusRow(row, { includePayload }));
};


export const approvePendingInventoryRequest = async (pendingId, approverId, options = {}) => {
    const { actorType = 'manager' } = options;

    const pendingResult = await SQLquery(
        `SELECT ipa.*, b.branch_name
         FROM Inventory_Pending_Actions ipa
         LEFT JOIN Branch b ON ipa.branch_id = b.branch_id
         WHERE pending_id = $1`,
        [pendingId]
    );

    if (pendingResult.rowCount === 0) {
        throw new Error('Pending inventory request not found');
    }

    const pending = pendingResult.rows[0];

    if (pending.status !== 'pending') {
        throw new Error('Pending inventory request has already been processed');
    }

    const payload = pending.payload || {};
    const productPayload = payload.productData || payload;
    const requestedBy = {
        userID: pending.created_by,
        fullName: pending.created_by_name,
        roles: pending.created_by_roles
    };

    if (actorType === 'admin') {
        if (!pending.requires_admin_review) {
            throw new Error('This inventory request does not require owner approval');
        }

        if (pending.current_stage !== 'admin_review') {
            throw new Error('Pending inventory request is not awaiting owner approval');
        }

        const adminName = await getAdminFullName(approverId);

        let approvalResult;

        if (pending.action_type === 'update') {
            const targetProductId = pending.product_id || productPayload.product_id;

            if (!targetProductId) {
                throw new Error('Pending update request is missing the target product ID');
            }

            approvalResult = await updateProductItem(
                { ...productPayload, branch_id: pending.branch_id },
                targetProductId,
                {
                    bypassApproval: true,
                    requestedBy,
                    actingUser: {
                        userID: approverId,
                        fullName: adminName
                    }
                }
            );
        } else if (pending.action_type === 'create') {
            approvalResult = await addProductItem(productPayload, {
                bypassApproval: true,
                requestedBy,
                actingUser: {
                    userID: approverId,
                    fullName: adminName
                },
                pendingActionId: pending.pending_id
            });
        } else {
            throw new Error(`Unsupported pending inventory action type: ${pending.action_type}`);
        }

        const { rows: updateRows } = await SQLquery(
            `UPDATE Inventory_Pending_Actions
             SET status = 'approved',
                 current_stage = 'completed',
                 admin_approver_id = $1,
                 admin_approved_at = NOW()
             WHERE pending_id = $2
             RETURNING *`,
            [approverId, pendingId]
        );

        const updatedPending = {
            ...mapPendingRequest(updateRows[0]),
            branch_name: pending.branch_name,
            manager_approver_name: pending.manager_approver_name
        };

        broadcastInventoryApprovalUpdate(pending.branch_id, {
            pending_id: pending.pending_id,
            status: 'approved',
            action: pending.action_type,
            branch_id: pending.branch_id,
            product: approvalResult.product
        });

        const productName = productPayload.product_name || 'Inventory item';

        if (requestedBy.userID) {
            const approvalMessage = `Your inventory request for owner acceptance has been approved by the owner (${adminName}).`;
            const privateAlert = await createSystemInventoryNotification({
                productId: pending.product_id || productPayload.product_id || null,
                branchId: pending.branch_id,
                alertType: 'Inventory Request Approved',
                message: approvalMessage,
                bannerColor: 'green',
                targetUserId: requestedBy.userID
            });

            if (privateAlert) {
                broadcastToUser(requestedBy.userID, {
                    alert_id: privateAlert.alert_id,
                    alert_type: 'Inventory Request Approved',
                    message: approvalMessage,
                    banner_color: 'green',
                    user_full_name: 'System',
                    alert_date: privateAlert.alert_date,
                    product_id: pending.product_id || productPayload.product_id || null,
                    isDateToday: true,
                    alert_date_formatted: 'Just now'
                }, { persist: false });
            }
        }

        // Only send manager notification if the manager is different from the requester
        if (pending.manager_approver_id && pending.manager_approver_id !== requestedBy.userID) {
            const managerApprovalMessage = `${productName} was approved by the owner (${adminName}).`;
            const managerAlert = await createSystemInventoryNotification({
                productId: pending.product_id || productPayload.product_id || null,
                branchId: pending.branch_id,
                alertType: 'Inventory Request Approved',
                message: managerApprovalMessage,
                bannerColor: 'green',
                targetUserId: pending.manager_approver_id
            });

            if (managerAlert) {
                broadcastToUser(pending.manager_approver_id, {
                    alert_id: managerAlert.alert_id,
                    alert_type: 'Inventory Request Approved',
                    message: managerApprovalMessage,
                    banner_color: 'green',
                    user_full_name: 'System',
                    alert_date: managerAlert.alert_date,
                    product_id: pending.product_id || productPayload.product_id || null,
                    isDateToday: true,
                    alert_date_formatted: 'Just now'
                }, { persist: false });
            }
        }


        return {
            status: 'approved',
            action: pending.action_type,
            product: approvalResult.product,
            pending: updatedPending
        };
    }

    if (pending.current_stage !== 'manager_review') {
        throw new Error('Pending inventory request is not awaiting branch manager approval');
    }

    const approverName = await getUserFullName(approverId);

    if (pending.requires_admin_review) {
        const { rows: updatedRows } = await SQLquery(
            `UPDATE Inventory_Pending_Actions
             SET current_stage = 'admin_review',
                 manager_approver_id = $1,
                 manager_approved_at = NOW(),
                 approved_by = $1,
                 approved_at = NOW()
             WHERE pending_id = $2
             RETURNING *`,
            [approverId, pendingId]
        );

        const updatedPending = {
            ...mapPendingRequest(updatedRows[0]),
            branch_name: pending.branch_name,
            manager_approver_name: approverName || pending.manager_approver_name
        };
        const productName = productPayload.product_name || 'Inventory item';
        const requesterName = requestedBy.fullName || 'Inventory staff member';
        const message = `System approved ${productName}. Awaiting owner confirmation.`;

        const alertResult = await SQLquery(
            `INSERT INTO Inventory_Alerts 
            (product_id, branch_id, alert_type, message, banner_color, user_id, user_full_name)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *`,
            [pending.product_id || productPayload.product_id || null, pending.branch_id, 'Inventory Admin Approval Needed', message, 'orange', approverId, 'System']
        );

        if (alertResult.rows[0]) {
            broadcastOwnerNotification({
                alert_id: alertResult.rows[0].alert_id,
                alert_type: 'Inventory Admin Approval Needed',
                message,
                banner_color: 'orange',
                alert_date: alertResult.rows[0].alert_date,
                isDateToday: true,
                alert_date_formatted: 'Just now'
            }, { category: 'inventory', targetRoles: ['Owner'] });
        }

        broadcastInventoryApprovalRequestToOwners({ request: updatedPending });

        if (requestedBy.userID) {
            broadcastToUser(requestedBy.userID, {
                alert_id: `inventory-forwarded-${pendingId}-${Date.now()}`,
                alert_type: 'Inventory Request Forwarded',
                message: `${productName} was approved by System and is awaiting owner approval.`,
                banner_color: 'blue',
                created_at: new Date().toISOString()
            });
        }

        broadcastInventoryApprovalUpdate(pending.branch_id, {
            pending_id: pending.pending_id,
            status: 'pending_admin',
            action: pending.action_type,
            branch_id: pending.branch_id,
            next_stage: 'admin_review'
        });

        return {
            status: 'pending',
            next_stage: 'admin_review',
            action: pending.action_type,
            pending: updatedPending
        };
    }

    let approvalResult;

    if (pending.action_type === 'update') {
        const targetProductId = pending.product_id || productPayload.product_id;

        if (!targetProductId) {
            throw new Error('Pending update request is missing the target product ID');
        }

        approvalResult = await updateProductItem(
            { ...productPayload, branch_id: pending.branch_id },
            targetProductId,
            {
                bypassApproval: true,
                requestedBy,
                actingUser: {
                    userID: approverId,
                    fullName: approverName
                }
            }
        );
    } else if (pending.action_type === 'create') {
        approvalResult = await addProductItem(productPayload, {
            bypassApproval: true,
            requestedBy,
            actingUser: {
                userID: approverId,
                fullName: approverName
            },
            pendingActionId: pending.pending_id
        });
    } else {
        throw new Error(`Unsupported pending inventory action type: ${pending.action_type}`);
    }

    await SQLquery(
        `UPDATE Inventory_Pending_Actions
         SET status = 'approved',
             current_stage = 'completed',
             manager_approver_id = $1,
             manager_approved_at = NOW(),
             approved_by = $1,
             approved_at = NOW()
         WHERE pending_id = $2`,
        [approverId, pendingId]
    );

    broadcastInventoryApprovalUpdate(pending.branch_id, {
        pending_id: pending.pending_id,
        status: 'approved',
        action: pending.action_type,
        branch_id: pending.branch_id,
        product: approvalResult.product
    });

    if (requestedBy.userID) {
        const productName = productPayload.product_name || 'Inventory item';
        const approvalMessage = `Your product update request for ${productName} has been approved by the branch manager (${approverName}).`;
        const privateAlert = await createSystemInventoryNotification({
            productId: pending.product_id || productPayload.product_id || null,
            branchId: pending.branch_id,
            alertType: 'Product Update Approved',
            message: approvalMessage,
            bannerColor: 'blue',
            targetUserId: requestedBy.userID
        });

        if (privateAlert) {
            broadcastToUser(requestedBy.userID, {
                alert_id: privateAlert.alert_id,
                alert_type: 'Product Update Approved',
                message: approvalMessage,
                banner_color: 'blue',
                user_full_name: 'System',
                alert_date: privateAlert.alert_date,
                product_id: pending.product_id || productPayload.product_id || null,
                isDateToday: true,
                alert_date_formatted: 'Just now'
            }, { persist: false }); // Skip persistence since already created
        }
    }

    return {
        status: 'approved',
        action: pending.action_type,
        product: approvalResult.product
    };
};


export const rejectPendingInventoryRequest = async (pendingId, approverId, reason = null, options = {}) => {
    const { actorType = 'manager' } = options;

    const pendingResult = await SQLquery(
        `SELECT * FROM Inventory_Pending_Actions WHERE pending_id = $1`,
        [pendingId]
    );

    if (pendingResult.rowCount === 0) {
        throw new Error('Pending inventory request not found');
    }

    const pending = pendingResult.rows[0];

    if (pending.status !== 'pending') {
        throw new Error('Pending inventory request has already been processed');
    }

    const requestedBy = {
        userID: pending.created_by,
        fullName: pending.created_by_name
    };

    if (actorType === 'admin') {
        if (!pending.requires_admin_review || pending.current_stage !== 'admin_review') {
            throw new Error('Pending inventory request is not awaiting owner approval');
        }

        const adminName = await getAdminFullName(approverId);

        const { rows } = await SQLquery(
            `UPDATE Inventory_Pending_Actions
             SET status = 'rejected',
                 current_stage = 'completed',
                 admin_approver_id = $1,
                 admin_approved_at = NOW(),
                 rejection_reason = $2
             WHERE pending_id = $3
             RETURNING *`,
            [approverId, reason, pendingId]
        );

        const updated = rows[0];

        broadcastInventoryApprovalUpdate(pending.branch_id, {
            pending_id: pendingId,
            status: 'rejected',
            action: pending.action_type,
            branch_id: pending.branch_id,
            reason
        });

        const rejectionMessage = reason
            ? `Inventory request was rejected by the owner (${adminName}): ${reason}`
            : `Inventory request was rejected by the owner (${adminName}).`;

        if (requestedBy.userID) {
            const privateRejectionMessage = reason
                ? `Your inventory request was rejected by the owner (${adminName}): ${reason}`
                : `Your inventory request was rejected by the owner (${adminName}).`;
            let persistedRejectionNotification = null;
            try {
                persistedRejectionNotification = await createSystemInventoryNotification({
                    productId: pending.product_id || null,
                    branchId: pending.branch_id,
                    alertType: 'Inventory Request Rejected',
                    message: privateRejectionMessage,
                    bannerColor: 'red',
                    targetUserId: requestedBy.userID
                });
            } catch (error) {
                console.error('Failed to persist owner rejection notification', {
                    pendingId,
                    error: error?.message || error
                });
            }

            const rejectionTimestamp = persistedRejectionNotification?.alert_date || new Date().toISOString();

            broadcastToUser(requestedBy.userID, {
                alert_id: persistedRejectionNotification?.alert_id || `inventory-admin-reject-${pendingId}-${Date.now()}`,
                alert_type: 'Inventory Request Rejected',
                message: privateRejectionMessage,
                banner_color: 'red',
                created_at: rejectionTimestamp,
                alert_date: rejectionTimestamp,
                user_full_name: 'System',
                isDateToday: true,
                alert_date_formatted: 'Just now'
            }, { persist: false });
        }

        // Only send manager notification if the manager is different from the requester
        if (pending.manager_approver_id && pending.manager_approver_id !== requestedBy.userID) {
            const managerRejectionMessage = rejectionMessage;
            let managerRejectionNotification = null;
            try {
                managerRejectionNotification = await createSystemInventoryNotification({
                    productId: pending.product_id || null,
                    branchId: pending.branch_id,
                    alertType: 'Inventory Request Rejected',
                    message: managerRejectionMessage,
                    bannerColor: 'red',
                    targetUserId: pending.manager_approver_id
                });
            } catch (error) {
                console.error('Failed to persist manager rejection notification', {
                    pendingId,
                    error: error?.message || error
                });
            }

            const rejectionTimestamp = managerRejectionNotification?.alert_date || new Date().toISOString();

            broadcastToUser(pending.manager_approver_id, {
                alert_id: managerRejectionNotification?.alert_id || `inventory-admin-reject-manager-${pendingId}-${Date.now()}`,
                alert_type: 'Inventory Request Rejected',
                message: managerRejectionMessage,
                banner_color: 'red',
                created_at: rejectionTimestamp,
                alert_date: rejectionTimestamp,
                user_full_name: 'System',
                isDateToday: true,
                alert_date_formatted: 'Just now'
            }, { persist: false });
        }

        return mapPendingRequest(updated);
    }

    if (pending.current_stage !== 'manager_review') {
        throw new Error('Pending inventory request is not awaiting branch manager approval');
    }

    const { rows } = await SQLquery(
        `UPDATE Inventory_Pending_Actions
         SET status = 'rejected',
             current_stage = 'completed',
             manager_approver_id = $1,
             manager_approved_at = NOW(),
             approved_by = $1,
             approved_at = NOW(),
             rejection_reason = $2
         WHERE pending_id = $3
         RETURNING *`,
        [approverId, reason, pendingId]
    );

    const updated = rows[0];

    broadcastInventoryApprovalUpdate(pending.branch_id, {
        pending_id: pendingId,
        status: 'rejected',
        action: pending.action_type,
        branch_id: pending.branch_id,
        reason
    });

    if (requestedBy.userID) {
        const productName = pending.payload?.productData?.product_name || 'inventory item';
        const approverName = await getUserFullName(approverId);
        const rejectionMessage = reason 
            ? `Your request to ${pending.action_type} ${productName} was rejected by the branch manager (${approverName}): ${reason}`
            : `Your request to ${pending.action_type} ${productName} was rejected by the branch manager (${approverName}).`;

        let persistedRejectionNotification = null;
        try {
            persistedRejectionNotification = await createSystemInventoryNotification({
                productId: pending.product_id || null,
                branchId: pending.branch_id,
                alertType: 'Inventory Request Rejected',
                message: rejectionMessage,
                bannerColor: 'red',
                targetUserId: requestedBy.userID
            });
        } catch (error) {
            console.error('Failed to persist branch manager rejection notification', {
                pendingId,
                error: error?.message || error
            });
        }

        const rejectionTimestamp = persistedRejectionNotification?.alert_date || new Date().toISOString();

        broadcastToUser(requestedBy.userID, {
            alert_id: persistedRejectionNotification?.alert_id || `inventory-reject-${pendingId}-${Date.now()}`,
            alert_type: 'Inventory Request Rejected',
            message: rejectionMessage,
            banner_color: 'red',
            created_at: rejectionTimestamp,
            alert_date: rejectionTimestamp,
            user_full_name: 'System',
            isDateToday: true,
            alert_date_formatted: 'Just now'
        }, { persist: false }); // Skip persistence since already created
    }

    return mapPendingRequest(updated);
};


export const cancelPendingInventoryRequest = async (pendingId, requesterId, reason = null) => {
    const resolvedPendingId = Number(pendingId);
    const resolvedRequesterId = Number(requesterId);

    if (!Number.isFinite(resolvedPendingId)) {
        const error = new Error('Invalid pending inventory request id');
        error.statusCode = 400;
        throw error;
    }

    if (!Number.isFinite(resolvedRequesterId)) {
        const error = new Error('Invalid requester id');
        error.statusCode = 400;
        throw error;
    }

    const { rows: existingRows } = await SQLquery(
        `SELECT ipa.*, b.branch_name,
                (manager.first_name || ' ' || manager.last_name) AS manager_approver_name
         FROM Inventory_Pending_Actions ipa
         LEFT JOIN Branch b ON b.branch_id = ipa.branch_id
         LEFT JOIN Users manager ON manager.user_id = ipa.manager_approver_id
         WHERE ipa.pending_id = $1`,
        [resolvedPendingId]
    );

    if (existingRows.length === 0) {
        const error = new Error('Pending inventory request not found');
        error.statusCode = 404;
        throw error;
    }

    const pending = existingRows[0];

    if (pending.status !== 'pending') {
        const error = new Error('Only pending inventory requests can be cancelled');
        error.statusCode = 409;
        throw error;
    }

    if (Number(pending.created_by) !== resolvedRequesterId) {
        const error = new Error('You can only cancel requests that you submitted');
        error.statusCode = 403;
        throw error;
    }

    const trimmedReason = typeof reason === 'string' ? reason.trim() : null;
    const normalizedReason = trimmedReason && trimmedReason.length > 0 ? trimmedReason : null;

    await SQLquery('BEGIN');

    try {
        const { rows: updatedRows } = await SQLquery(
            `UPDATE Inventory_Pending_Actions
             SET status = 'cancelled',
                 current_stage = 'cancelled',
                 cancelled_by = $2,
                 cancelled_at = NOW(),
                 cancelled_reason = $3
             WHERE pending_id = $1
             RETURNING *`,
            [resolvedPendingId, resolvedRequesterId, normalizedReason]
        );

        await SQLquery('COMMIT');

        const updatedRaw = updatedRows[0] ? {
            ...pending,
            ...updatedRows[0],
            branch_name: pending.branch_name,
            manager_approver_name: pending.manager_approver_name
        } : pending;

        broadcastInventoryApprovalUpdate(pending.branch_id, {
            pending_id: resolvedPendingId,
            status: 'cancelled',
            action: pending.action_type,
            branch_id: pending.branch_id,
            cancelled_by: resolvedRequesterId,
            reason: normalizedReason
        });

        return mapPendingRequest(updatedRaw);
    } catch (error) {
        await SQLquery('ROLLBACK');
        throw error;
    }
};

export const requestChangesPendingInventoryRequest = async (pendingId, approverId, changeType = null, comment = null, options = {}) => {
    const { actorType = 'manager' } = options;

    const pendingResult = await SQLquery(
        `SELECT * FROM Inventory_Pending_Actions WHERE pending_id = $1`,
        [pendingId]
    );

    if (pendingResult.rowCount === 0) {
        throw new Error('Pending inventory request not found');
    }

    const pending = pendingResult.rows[0];

    if (pending.status !== 'pending') {
        throw new Error('Pending inventory request has already been processed');
    }

    const requestedBy = {
        userID: pending.created_by,
        fullName: pending.created_by_name
    };

    if (actorType === 'admin') {
        if (!pending.requires_admin_review || pending.current_stage !== 'admin_review') {
            throw new Error('Pending inventory request is not awaiting owner approval');
        }

        const adminName = await getAdminFullName(approverId);
        const trimmedComment = typeof comment === 'string' ? comment.trim() : null;

        let rows;
        try {
            const updateResult = await SQLquery(
                `UPDATE Inventory_Pending_Actions
                 SET status = 'changes_requested',
                     change_requested = true,
                     change_request_type = $1,
                     change_request_comment = $2,
                     change_requested_by = $3,
                     change_requested_at = NOW(),
                     admin_approver_id = $3
                 WHERE pending_id = $4
                 RETURNING *`,
                [changeType, trimmedComment, approverId, pendingId]
            );
            rows = updateResult.rows;
        } catch (updateError) {
            // If DB column missing, fallback to setting status only
            if (updateError?.code === '42703') {
                const updateFallback = await SQLquery(
                    `UPDATE Inventory_Pending_Actions
                     SET status = 'changes_requested', admin_approver_id = $1
                     WHERE pending_id = $2
                     RETURNING *`,
                    [approverId, pendingId]
                );
                rows = updateFallback.rows;
            } else {
                throw updateError;
            }
        }

        const updated = rows[0];

        broadcastInventoryApprovalUpdate(pending.branch_id, {
            pending_id: pendingId,
            status: 'changes_requested',
            action: pending.action_type,
            branch_id: pending.branch_id,
            change_request_type: changeType,
            change_request_comment: trimmedComment
        });

        if (requestedBy.userID) {
            const privateMessage = trimmedComment
                ? `Your inventory request requires changes by the owner (${adminName}): ${trimmedComment}`
                : `Your inventory request requires changes by the owner (${adminName}).`;

            const persisted = await createSystemInventoryNotification({
                productId: pending.product_id || null,
                branchId: pending.branch_id,
                alertType: 'Inventory Request Changes Requested',
                message: privateMessage,
                bannerColor: 'amber',
                targetUserId: requestedBy.userID
            }).catch((err) => {
                console.error('Failed to persist change-request notification', err);
                return null;
            });

            broadcastToUser(requestedBy.userID, {
                alert_id: persisted?.alert_id || `inventory-request-changes-${pendingId}-${Date.now()}`,
                alert_type: 'Inventory Request Changes Requested',
                message: privateMessage,
                banner_color: 'amber',
                created_at: persisted?.alert_date || new Date().toISOString(),
                alert_date: persisted?.alert_date || new Date().toISOString(),
                user_full_name: 'System',
                isDateToday: true,
                alert_date_formatted: 'Just now'
            }, { persist: false });
        }

        return mapPendingRequest(rows[0]);
    }

    if (pending.current_stage !== 'manager_review') {
        throw new Error('Pending inventory request is not awaiting branch manager approval');
    }

    const approverName = await getUserFullName(approverId);
    const trimmedComment2 = typeof comment === 'string' ? comment.trim() : null;

    let rows;
    try {
        const updateResult = await SQLquery(
            `UPDATE Inventory_Pending_Actions
             SET status = 'changes_requested',
                 change_requested = true,
                 change_request_type = $1,
                 change_request_comment = $2,
                 change_requested_by = $3,
                 change_requested_at = NOW(),
                 manager_approver_id = $3
             WHERE pending_id = $4
             RETURNING *`,
            [changeType, trimmedComment2, approverId, pendingId]
        );
        rows = updateResult.rows;
    } catch (updateError) {
        if (updateError?.code === '42703') {
            const fallback = await SQLquery(
                `UPDATE Inventory_Pending_Actions
                 SET status = 'changes_requested', manager_approver_id = $1
                 WHERE pending_id = $2
                 RETURNING *`,
                [approverId, pendingId]
            );
            rows = fallback.rows;
        } else {
            throw updateError;
        }
    }

    const updated = rows[0];

    broadcastInventoryApprovalUpdate(pending.branch_id, {
        pending_id: pendingId,
        status: 'changes_requested',
        action: pending.action_type,
        branch_id: pending.branch_id,
        change_request_type: changeType,
        change_request_comment: trimmedComment2
    });

    if (requestedBy.userID) {
        const privateMessage = trimmedComment2
            ? `Your inventory request requires changes by ${approverName}: ${trimmedComment2}`
            : `Your inventory request requires changes by ${approverName}.`;

        const persisted = await createSystemInventoryNotification({
            productId: pending.product_id || null,
            branchId: pending.branch_id,
            alertType: 'Inventory Request Changes Requested',
            message: privateMessage,
            bannerColor: 'amber',
            targetUserId: requestedBy.userID
        }).catch((err) => {
            console.error('Failed to persist change-request notification', err);
            return null;
        });

        broadcastToUser(requestedBy.userID, {
            alert_id: persisted?.alert_id || `inventory-request-changes-${pendingId}-${Date.now()}`,
            alert_type: 'Inventory Request Changes Requested',
            message: privateMessage,
            banner_color: 'amber',
            created_at: persisted?.alert_date || new Date().toISOString(),
            alert_date: persisted?.alert_date || new Date().toISOString(),
            user_full_name: 'System',
            isDateToday: true,
            alert_date_formatted: 'Just now'
        }, { persist: false });
    }

    return mapPendingRequest(rows[0]);
};

export const getPendingInventoryRequestById = async (pendingId) => {
    const { rows } = await SQLquery(
        `SELECT ipa.*, b.branch_name,
                (manager.first_name || ' ' || manager.last_name) AS manager_approver_name
         FROM Inventory_Pending_Actions ipa
         LEFT JOIN Branch b ON ipa.branch_id = b.branch_id
         LEFT JOIN Users manager ON manager.user_id = ipa.manager_approver_id
         WHERE ipa.pending_id = $1
         LIMIT 1`,
        [pendingId]
    );

    if (rows.length === 0) return null;
    return mapPendingRequest(rows[0]);
};

export const resubmitPendingInventoryRequest = async (pendingId, requesterId, productData, options = {}) => {
    const { actingUser = null } = options;
    const resolvedPendingId = Number(pendingId);
    const resolvedRequesterId = Number(requesterId);

    if (!Number.isFinite(resolvedPendingId)) {
        const error = new Error('Invalid pending inventory request id');
        error.statusCode = 400;
        throw error;
    }

    if (!Number.isFinite(resolvedRequesterId)) {
        const error = new Error('Invalid requester id');
        error.statusCode = 400;
        throw error;
    }

    const { rows: existingRows } = await SQLquery(
        `SELECT ipa.*, b.branch_name
         FROM Inventory_Pending_Actions ipa
         LEFT JOIN Branch b ON b.branch_id = ipa.branch_id
         WHERE ipa.pending_id = $1`,
         [resolvedPendingId]
    );

    if (existingRows.length === 0) {
        const error = new Error('Pending inventory request not found');
        error.statusCode = 404;
        throw error;
    }

    const pending = existingRows[0];

    if (Number(pending.created_by) !== resolvedRequesterId) {
        const error = new Error('You can only resubmit requests that you submitted');
        error.statusCode = 403;
        throw error;
    }

    // Only allow resubmission when current status is changes_requested or pending (defensive)
    if (pending.status !== 'changes_requested' && pending.status !== 'pending') {
        const error = new Error('Only requests with changes requested can be resubmitted');
        error.statusCode = 409;
        throw error;
    }

    const sanitized = sanitizeProductPayload(productData);
    const isCreateAction = pending.action_type === 'create';
    const requiresAdminReview = isCreateAction && !(sanitized?.existing_product_id);

    const newPayload = {
        productData: sanitized,
        currentState: pending.payload?.currentState || null,
        category_name: pending.payload?.category_name || null
    };

    await SQLquery('BEGIN');
    try {
        const { rows: updatedRows } = await SQLquery(
            `UPDATE Inventory_Pending_Actions
             SET payload = $2::jsonb,
                 status = 'pending',
                 current_stage = 'manager_review',
                 manager_approver_id = NULL,
                 manager_approved_at = NULL,
                 admin_approver_id = NULL,
                 admin_approved_at = NULL,
                 approved_by = NULL,
                 approved_at = NULL,
                 change_request_type = NULL,
                 change_request_comment = NULL,
                 change_requested_by = NULL,
                 change_requested_at = NULL,
                 change_requested = false,
                 requires_admin_review = $3
             WHERE pending_id = $1
             RETURNING *`,
            [resolvedPendingId, JSON.stringify(newPayload), requiresAdminReview]
        );

        await SQLquery('COMMIT');

        const updated = updatedRows[0] ? { ...pending, ...updatedRows[0], branch_name: pending.branch_name } : pending;

        // Broadcast that the pending request has transitioned back to 'pending'
        const mapped = mapPendingRequest(updated);
        if (mapped) {
            broadcastInventoryApprovalUpdate(mapped.branch_id, {
                pending_id: mapped.pending_id,
                status: 'pending',
                action: mapped.action_type,
                branch_id: mapped.branch_id
            });

            // If this requires owner review, also post the request to owners for awareness
            if (mapped.current_stage === 'admin_review') {
                broadcastInventoryApprovalRequestToOwners({ request: mapped });
            } else {
                broadcastInventoryApprovalRequest(mapped.branch_id, { request: mapped });
            }
        }

        return mapPendingRequest(updated);
    } catch (error) {
        await SQLquery('ROLLBACK');
        throw error;
    }
};