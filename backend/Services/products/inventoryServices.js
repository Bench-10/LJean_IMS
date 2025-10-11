import { SQLquery } from "../../db.js";
import { broadcastNotification, broadcastOwnerNotification, broadcastInventoryUpdate, broadcastValidityUpdate, broadcastHistoryUpdate, broadcastInventoryApprovalRequest, broadcastInventoryApprovalRequestToOwners, broadcastInventoryApprovalUpdate, broadcastToUser } from "../../server.js";
import { checkAndHandleLowStock } from "../Services_Utils/lowStockNotification.js";

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


const sanitizeProductPayload = (productData) => {
    if (!productData) return null;

    return {
        product_id: productData.product_id ?? null,
        product_name: productData.product_name,
        category_id: Number(productData.category_id),
        branch_id: Number(productData.branch_id),
        unit: productData.unit,
        unit_price: Number(productData.unit_price),
        unit_cost: Number(productData.unit_cost),
        quantity_added: Number(productData.quantity_added),
        min_threshold: Number(productData.min_threshold),
        max_threshold: Number(productData.max_threshold),
        date_added: productData.date_added,
        product_validity: productData.product_validity,
        userID: productData.userID,
        fullName: productData.fullName,
        requestor_roles: normalizeRoles(productData.requestor_roles || productData.userRoles),
        existing_product_id: productData.existing_product_id || null,
        description: productData.description || null,
    };
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
        created_at: row.created_at,
        payload: row.payload,
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
    currentState = null
}) => {
    const sanitizedPayload = sanitizeProductPayload(productData);
    const categoryName = sanitizedPayload?.category_id ? await getCategoryName(sanitizedPayload.category_id) : null;
    const isCreateAction = actionType === 'create';
    const requiresAdminReview = isCreateAction && !(sanitizedPayload?.existing_product_id);

    const payload = {
        productData: sanitizedPayload,
        currentState,
        category_name: categoryName
    };

    const { rows } = await SQLquery(
        `INSERT INTO Inventory_Pending_Actions
            (branch_id, product_id, action_type, payload, status, current_stage, requires_admin_review, created_by, created_by_name, created_by_roles)
         VALUES ($1, $2, $3, $4::jsonb, 'pending', 'manager_review', $5, $6, $7, $8)
         RETURNING *` ,
        [
            branchId,
            productId,
            actionType,
            JSON.stringify(payload),
            requiresAdminReview,
            sanitizedPayload?.userID || null,
            sanitizedPayload?.fullName || null,
            sanitizedPayload?.requestor_roles || []
        ]
    );

    const mapped = mapPendingRequest(rows[0]);

    if (mapped) {
        broadcastInventoryApprovalRequest(branchId, { request: mapped });

        const requesterName = sanitizedPayload?.fullName || 'Inventory staff member';
        const productName = sanitizedPayload?.product_name || 'an inventory item';
        const categoryLabel = categoryName ? ` (${categoryName})` : '';
        const verb = actionType === 'update' ? 'update' : 'add';
        const notificationMessage = `${requesterName} submitted a request to ${verb} ${productName}${categoryLabel}.`;

        const alertResult = await SQLquery(
            `INSERT INTO Inventory_Alerts 
            (product_id, branch_id, alert_type, message, banner_color, user_id, user_full_name)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *`,
            [productId ?? sanitizedPayload?.product_id ?? null, branchId, 'Inventory Approval Needed', notificationMessage, 'orange', sanitizedPayload?.userID || null, requesterName]
        );

        if (alertResult.rows[0]) {
            broadcastNotification(branchId, {
                alert_id: alertResult.rows[0].alert_id,
                alert_type: 'Inventory Approval Needed',
                message: notificationMessage,
                banner_color: 'orange',
                user_id: alertResult.rows[0].user_id,
                user_full_name: requesterName,
                alert_date: alertResult.rows[0].alert_date,
                isDateToday: true,
                alert_date_formatted: 'Just now',
                target_roles: ['Branch Manager'],
                creator_id: sanitizedPayload?.userID || null
            }, { category: 'inventory', targetRoles: ['Branch Manager'] });
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
            COALESCE(SUM(CASE WHEN ast.product_validity < NOW() THEN 0 ELSE ast.quantity_left END), 0) AS quantity,
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
                COALESCE(SUM(CASE WHEN ast.product_validity < NOW() THEN 0 ELSE ast.quantity_left END), 0) AS quantity,
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
            COALESCE(SUM(CASE WHEN ast.product_validity < NOW() THEN 0 ELSE ast.quantity_left END), 0) AS quantity,
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
    const { bypassApproval = false, requestedBy = null, actingUser = null } = options;

    const roles = normalizeRoles(productData.requestor_roles || productData.userRoles);
    const pendingBranchId = Number(productData.branch_id ?? productData.branchId);
    const requiresApproval = !bypassApproval && needsBranchManagerApproval(roles);

    if (requiresApproval) {
        const pendingRecord = await createPendingInventoryAction({
            actionType: 'create',
            productData,
            branchId: pendingBranchId,
            productId: productData.existing_product_id || null,
            currentState: null
        });

        return { status: 'pending', action: 'create', pending: pendingRecord };
    }

    const actingUserId = actingUser?.userID ?? productData.userID;
    const actingUserName = actingUser?.fullName ?? productData.fullName;

    const cleanedData = sanitizeProductPayload({
        ...productData,
        userID: actingUserId,
        fullName: actingUserName
    });

    const { product_name, category_id, branch_id, unit, unit_price, unit_cost, quantity_added, min_threshold, max_threshold, date_added, product_validity, userID, fullName, existing_product_id, description } = cleanedData;

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

    await SQLquery(
        `INSERT INTO Inventory_Product 
        (product_id, category_id, branch_id, product_name, unit, unit_price, unit_cost, min_threshold, max_threshold)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [product_id, category_id, branch_id, product_name, unit, unit_price, unit_cost, min_threshold, max_threshold]
    );   

    await SQLquery(
        `INSERT INTO Add_Stocks 
        (product_id, h_unit_price, h_unit_cost, quantity_added, date_added, product_validity, quantity_left, branch_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *`,
        [product_id, unit_price, unit_cost, quantity_added, date_added, product_validity, quantity_added, branch_id]
    );

    const alertResult = await SQLquery(
        `INSERT INTO Inventory_Alerts 
        (product_id, branch_id, alert_type, message, banner_color, user_id, user_full_name)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *`,
        [product_id, branch_id, productAddedNotifheader, notifMessage, color, userID, fullName]
    );

    await SQLquery('COMMIT');

    if (alertResult.rows[0]) {
        broadcastNotification(branch_id, {
            alert_id: alertResult.rows[0].alert_id,
            alert_type: productAddedNotifheader,
            message: notifMessage,
            banner_color: color,
            user_id: alertResult.rows[0].user_id,
            user_full_name: fullName,
            alert_date: alertResult.rows[0].alert_date,
            isDateToday: true,
            alert_date_formatted: 'Just now'
        });
    }

    const newProductRow = await getUpdatedInventoryList(product_id, branch_id);

    await checkAndHandleLowStock(product_id, branch_id, {
        triggeredByUserId: userID,
        triggerUserName: fullName
    });

    broadcastInventoryUpdate(branch_id, {
        action: 'add',
        product: newProductRow,
        user_id: userID,
        requested_by: requestedBy ? { user_id: requestedBy.userID, full_name: requestedBy.fullName } : null
    });

    const categoryName = await getCategoryName(category_id);
    const addedDateObj = new Date(date_added);

    if (product_validity) {
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
            branch_id: branch_id
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
        return await SQLquery(
            `INSERT INTO Add_Stocks 
            (product_id, h_unit_price, h_unit_cost, quantity_added, date_added, product_validity, quantity_left, branch_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *`,
            [itemId, unit_price, unit_cost, quantity_added, date_added, product_validity, quantity_added, branch_id]
        );
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

    const productInfoChanged =
        prev.product_name !== product_name ||
        prev.unit !== unit ||
        Number(prev.min_threshold) !== Number(min_threshold) ||
        Number(prev.max_threshold) !== Number(max_threshold) ||
        Number(prev.category_id) !== Number(category_id) ||
        Number(prev.unit_cost) !== Number(unit_cost);

    const productAddedNotifheader = "Product Update";
    const requestSuffix = requestedBy?.fullName && requestedBy.userID !== userID ? ` (Requested by ${requestedBy.fullName})` : '';

    const addqQuantityNotifMessage = `Additional ${quantity_added} ${unit} has been added to ${product_name} at a cost of ₱ ${unit_cost}.`;
    const changePriceNotifMessage = `The price of ${product_name} has been changed from ₱ ${returnPreviousPrice} to ₱ ${unit_price}.`;
    const color = 'blue';

    await SQLquery('BEGIN');

    let alertResult = null;
    let finalMessage = '';

    if (quantity_added !== 0) {
        await addStocksQuery();
    }

    if (returnPreviousPrice !== unit_price) {
        await SQLquery(
            `UPDATE Inventory_Product 
            SET unit_price = $1 
            WHERE product_id = $2 AND branch_id = $3`,
            [unit_price, itemId, branch_id]
        );
    }

    if (quantity_added !== 0 && returnPreviousPrice !== unit_price) {
        finalMessage = `${addqQuantityNotifMessage} and ${changePriceNotifMessage}`;
    } else if (quantity_added !== 0 && returnPreviousPrice === unit_price) {
        finalMessage = addqQuantityNotifMessage;
    } else if (quantity_added === 0 && returnPreviousPrice !== unit_price) {
        finalMessage = changePriceNotifMessage;
    }

    if (finalMessage) {
        finalMessage = `${finalMessage}${requestSuffix}`;
        alertResult = await SQLquery(
            `INSERT INTO Inventory_Alerts 
            (product_id, branch_id, alert_type, message, banner_color, user_id, user_full_name)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *`,
            [itemId, returnBranchId, productAddedNotifheader, finalMessage, color, userID, fullName]
        );

        if (alertResult?.rows[0]) {
            broadcastNotification(returnBranchId, {
                alert_id: alertResult.rows[0].alert_id,
                alert_type: productAddedNotifheader,
                message: finalMessage,
                banner_color: color,
                user_id: alertResult.rows[0].user_id,
                user_full_name: fullName,
                alert_date: alertResult.rows[0].alert_date,
                isDateToday: true,
                alert_date_formatted: 'Just now'
            });
        }
    }

    if (productInfoChanged) {
        await SQLquery(
            `UPDATE Inventory_Product 
            SET product_name = $1, unit = $2, min_threshold = $3, category_id = $4, unit_cost = $5
            WHERE product_id = $6 AND branch_id = $7 AND max_threshold = $8`,
            [product_name, unit, min_threshold, category_id, unit_cost, itemId, branch_id, max_threshold]
        );

        const updateMessage = `Product information for ${product_name} has been updated.${requestSuffix}`;
        const infoAlertResult = await SQLquery(
            `INSERT INTO Inventory_Alerts 
            (product_id, branch_id, alert_type, message, banner_color, user_id, user_full_name)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *`,
            [itemId, returnBranchId, productAddedNotifheader, updateMessage, color, userID, fullName]
        );

        if (infoAlertResult.rows[0]) {
            broadcastNotification(returnBranchId, {
                alert_id: infoAlertResult.rows[0].alert_id,
                alert_type: productAddedNotifheader,
                message: updateMessage,
                banner_color: color,
                user_id: infoAlertResult.rows[0].user_id,
                user_full_name: fullName,
                alert_date: infoAlertResult.rows[0].alert_date,
                isDateToday: true,
                alert_date_formatted: 'Just now'
            });
        }
    }

    await SQLquery('COMMIT');

    const updatedProductRow = await getUpdatedInventoryList(itemId, branch_id);

    await checkAndHandleLowStock(itemId, branch_id, {
        triggeredByUserId: userID,
        triggerUserName: fullName
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

        if (product_validity) {
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
                branch_id: branch_id
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
                }
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
            broadcastToUser(requestedBy.userID, {
                alert_id: `inventory-final-approved-${pendingId}-${Date.now()}`,
                alert_type: 'Inventory Request Approved',
                message: `${productName} was approved by the owner.`,
                banner_color: 'green',
                created_at: new Date().toISOString()
            });
        }

        if (pending.manager_approver_id) {
            broadcastToUser(pending.manager_approver_id, {
                alert_id: `inventory-final-approved-manager-${pendingId}-${Date.now()}`,
                alert_type: 'Inventory Request Approved',
                message: `${productName} was approved by the owner.`,
                banner_color: 'green',
                created_at: new Date().toISOString()
            });
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
        const message = `${approverName || 'Branch Manager'} approved ${productName}. Awaiting owner confirmation.`;

        const alertResult = await SQLquery(
            `INSERT INTO Inventory_Alerts 
            (product_id, branch_id, alert_type, message, banner_color, user_id, user_full_name)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *`,
            [pending.product_id || productPayload.product_id || null, pending.branch_id, 'Inventory Admin Approval Needed', message, 'orange', approverId, approverName]
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
                message: `${productName} was approved by ${approverName || 'Branch Manager'} and is awaiting owner approval.`,
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
            }
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
        broadcastToUser(requestedBy.userID, {
            alert_id: `inventory-approval-${pendingId}-${Date.now()}`,
            alert_type: 'Inventory Request Approved',
            message: `${productPayload.product_name || 'Inventory item'} request has been approved by ${approverName || 'Branch Manager'}.`,
            banner_color: 'green',
            created_at: new Date().toISOString()
        });
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
            pending_id,
            status: 'rejected',
            action: pending.action_type,
            branch_id: pending.branch_id,
            reason
        });

        const rejectionMessage = reason
            ? `Inventory request was rejected by the owner: ${reason}`
            : 'Inventory request was rejected by the owner.';

        if (requestedBy.userID) {
            broadcastToUser(requestedBy.userID, {
                alert_id: `inventory-admin-reject-${pendingId}-${Date.now()}`,
                alert_type: 'Inventory Request Rejected',
                message: rejectionMessage,
                banner_color: 'red',
                created_at: new Date().toISOString()
            });
        }

        if (pending.manager_approver_id) {
            broadcastToUser(pending.manager_approver_id, {
                alert_id: `inventory-admin-reject-manager-${pendingId}-${Date.now()}`,
                alert_type: 'Inventory Request Rejected',
                message: rejectionMessage,
                banner_color: 'red',
                created_at: new Date().toISOString()
            });
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
        pending_id,
        status: 'rejected',
        action: pending.action_type,
        branch_id: pending.branch_id,
        reason
    });

    if (requestedBy.userID) {
        const rejectionMessage = reason ? `Inventory request was rejected: ${reason}` : 'Inventory request was rejected by the branch manager.';

        broadcastToUser(requestedBy.userID, {
            alert_id: `inventory-reject-${pendingId}-${Date.now()}`,
            alert_type: 'Inventory Request Rejected',
            message: rejectionMessage,
            banner_color: 'red',
            created_at: new Date().toISOString()
        });
    }

    return mapPendingRequest(updated);
};