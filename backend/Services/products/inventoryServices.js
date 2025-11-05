import { SQLquery } from "../../db.js";
import { broadcastNotification, broadcastOwnerNotification, broadcastInventoryUpdate, broadcastValidityUpdate, broadcastHistoryUpdate, broadcastInventoryApprovalRequest, broadcastInventoryApprovalRequestToOwners, broadcastInventoryApprovalUpdate, broadcastToUser } from "../../server.js";
import { checkAndHandleLowStock } from "../Services_Utils/lowStockNotification.js";
import { convertToBaseUnit, getUnitConversion } from "../Services_Utils/unitConversion.js";

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


const normalizeSellingUnitsPayload = (rawUnits, baseUnit, basePrice) => {
    const sanitizedBaseUnit = typeof baseUnit === 'string' ? baseUnit.trim() : '';
    const seenUnits = new Set();
    const normalizedUnits = [];
    let baseUnitPrice = toNumberOrNull(basePrice);
    let requiresWholeBaseUnit = false;

    if (sanitizedBaseUnit) {
        try {
            const baseConversion = getUnitConversion(sanitizedBaseUnit);
            requiresWholeBaseUnit = baseConversion.conversion_factor === 1;
        } catch (error) {
            throw new InventoryValidationError(`Base unit '${sanitizedBaseUnit}' is not registered in the conversion table.`);
        }
    }

    if (Array.isArray(rawUnits)) {
        rawUnits.forEach((rawUnit) => {
            const unitValue = typeof rawUnit?.unit === 'string' ? rawUnit.unit.trim() : '';
            if (!unitValue || seenUnits.has(unitValue)) {
                return;
            }

            const priceValue = toNumberOrNull(rawUnit.unit_price ?? rawUnit.unitPrice ?? rawUnit.price);
            if (!priceValue || priceValue <= 0) {
                throw new InventoryValidationError(`Invalid price for unit '${unitValue}'. Price must be greater than 0.`);
            }

            const baseQuantityRaw = toNumberOrNull(
                rawUnit.base_quantity_per_sell_unit ??
                rawUnit.baseQuantityPerSellUnit ??
                rawUnit.base_quantity ??
                rawUnit.baseQty
            );

            const unitsPerBaseRaw = toNumberOrNull(rawUnit.units_per_base ?? rawUnit.unitsPerBase);

            let resolvedBaseQuantity = baseQuantityRaw;
            if (!resolvedBaseQuantity || resolvedBaseQuantity <= 0) {
                if (unitsPerBaseRaw && unitsPerBaseRaw > 0) {
                    resolvedBaseQuantity = 1 / unitsPerBaseRaw;
                } else {
                    throw new InventoryValidationError(`Invalid conversion value for unit '${unitValue}'. Provide units per ${sanitizedBaseUnit || 'base unit'} or base quantity.`);
                }
            }

            if (!Number.isFinite(resolvedBaseQuantity) || resolvedBaseQuantity <= 0) {
                throw new InventoryValidationError(`Invalid conversion value for unit '${unitValue}'.`);
            }

            if (requiresWholeBaseUnit && resolvedBaseQuantity < 1) {
                throw new InventoryValidationError(`Unit '${unitValue}' must contain at least 1 ${sanitizedBaseUnit}.`);
            }

            const unitsPerBase = 1 / resolvedBaseQuantity;

            const record = {
                unit: unitValue,
                unit_price: roundToDecimals(priceValue, 2),
                base_quantity_per_sell_unit: roundToDecimals(resolvedBaseQuantity, 6),
                units_per_base: roundToDecimals(unitsPerBase, 6),
                is_base: sanitizedBaseUnit ? unitValue === sanitizedBaseUnit : false
            };

            normalizedUnits.push(record);
            seenUnits.add(unitValue);

            if (record.is_base) {
                baseUnitPrice = record.unit_price;
            }
        });
    }

    if (sanitizedBaseUnit) {
        const hasBaseEntry = normalizedUnits.some(entry => entry.unit === sanitizedBaseUnit);
        if (!hasBaseEntry) {
            if (!baseUnitPrice || baseUnitPrice <= 0) {
                throw new InventoryValidationError('Base unit price must be provided and greater than 0.');
            }

            normalizedUnits.push({
                unit: sanitizedBaseUnit,
                unit_price: roundToDecimals(baseUnitPrice, 2),
                base_quantity_per_sell_unit: 1,
                units_per_base: 1,
                is_base: true
            });
        } else {
            normalizedUnits.forEach(entry => {
                if (entry.unit === sanitizedBaseUnit) {
                    entry.is_base = true;
                    entry.base_quantity_per_sell_unit = 1;
                    entry.units_per_base = 1;
                    if (!baseUnitPrice || baseUnitPrice <= 0) {
                        baseUnitPrice = entry.unit_price;
                    }
                }
            });
        }
    }

    const sortedUnits = normalizedUnits.sort((a, b) => {
        if (a.is_base === b.is_base) {
            return a.unit.localeCompare(b.unit);
        }
        return a.is_base ? -1 : 1;
    });

    return {
        units: sortedUnits,
        basePrice: baseUnitPrice
    };
};


const mapSellingUnitRow = (row) => ({
    unit: row.sell_unit,
    unit_price: Number(row.unit_price),
    base_quantity_per_sell_unit: Number(row.base_quantity_per_sell_unit),
    units_per_base: Number(row.units_per_base ?? (row.base_quantity_per_sell_unit ? (1 / Number(row.base_quantity_per_sell_unit)) : null)),
    is_base: row.is_base
});


const getProductSellingUnits = async (productId, branchId) => {
    const { rows } = await SQLquery(
        `SELECT sell_unit, unit_price, base_quantity_per_sell_unit, units_per_base, is_base
         FROM inventory_product_sell_units
         WHERE product_id = $1 AND branch_id = $2
         ORDER BY is_base DESC, sell_unit ASC`,
        [productId, branchId]
    );

    return rows.map(mapSellingUnitRow);
};


const replaceProductSellingUnits = async (productId, branchId, sellingUnits) => {
    await SQLquery('DELETE FROM inventory_product_sell_units WHERE product_id = $1 AND branch_id = $2', [productId, branchId]);

    if (!Array.isArray(sellingUnits) || sellingUnits.length === 0) {
        return;
    }

    const values = [];
    const placeholders = sellingUnits.map((unit, index) => {
        const baseQuantity = Number(unit.base_quantity_per_sell_unit ?? (unit.units_per_base ? (1 / Number(unit.units_per_base)) : 0));
        const price = Number(unit.unit_price);

        if (!baseQuantity || baseQuantity <= 0) {
            throw new InventoryValidationError(`Invalid conversion ratio for unit '${unit.unit}'.`);
        }

        if (!price || price <= 0) {
            throw new InventoryValidationError(`Invalid price for unit '${unit.unit}'.`);
        }

        const offset = index * 6;
        values.push(productId, branchId, unit.unit, roundToDecimals(baseQuantity, 6), roundToDecimals(price, 2), Boolean(unit.is_base));
        return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6})`;
    });

    await SQLquery(
        `INSERT INTO inventory_product_sell_units (product_id, branch_id, sell_unit, base_quantity_per_sell_unit, unit_price, is_base)
         VALUES ${placeholders.join(', ')}`,
        values
    );
};


const ensureSellingUnitsForResponse = (units, baseUnit, basePrice) => {
    if (Array.isArray(units) && units.length > 0) {
        return units;
    }

    if (!baseUnit) {
        return [];
    }

    const resolvedPrice = toNumberOrNull(basePrice);
    if (!resolvedPrice || resolvedPrice <= 0) {
        return [];
    }

    return [{
        unit: baseUnit,
        unit_price: roundToDecimals(resolvedPrice, 2),
        base_quantity_per_sell_unit: 1,
        units_per_base: 1,
        is_base: true
    }];
};


const sanitizeProductPayload = (productData) => {
    if (!productData) return null;

    const baseUnit = typeof productData.unit === 'string' ? productData.unit.trim() : productData.unit;
    let sanitizedUnitPrice = Number(productData.unit_price);
    if (!Number.isFinite(sanitizedUnitPrice)) {
        sanitizedUnitPrice = null;
    }

    let normalizedSellingUnits = null;
    const hasSellingUnits = Array.isArray(productData.selling_units) && productData.selling_units.length > 0;

    if (hasSellingUnits) {
        const normalized = normalizeSellingUnitsPayload(productData.selling_units, baseUnit, sanitizedUnitPrice);
        normalizedSellingUnits = normalized.units;
        if (normalized.basePrice && normalized.basePrice > 0) {
            sanitizedUnitPrice = normalized.basePrice;
        }
    }

    if (!sanitizedUnitPrice || sanitizedUnitPrice <= 0) {
        sanitizedUnitPrice = Number(productData.unit_price);
    }

    return {
        product_id: productData.product_id ?? null,
        product_name: productData.product_name,
        category_id: Number(productData.category_id),
        branch_id: Number(productData.branch_id),
        unit: baseUnit,
        unit_price: Number(sanitizedUnitPrice),
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
        selling_units: normalizedSellingUnits
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

    if (row.status === 'pending' && row.current_stage === 'admin_review') {
        return {
            code: 'pending_admin',
            label: 'Awaiting owner approval',
            tone: 'blue',
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

    return {
        product_name: productData?.product_name || currentState?.product_name || 'Inventory item',
        category_name: categoryName,
        action_label: row?.action_type === 'update' ? 'Update existing item' : 'Add new item',
        quantity_requested: safeNumber(productData?.quantity_added ?? productData?.quantity),
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
        : (row.admin_approved_at || row.approved_at || row.manager_approved_at || null);

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
                rejection_reason: row.rejection_reason || null
            }
        },
        payload: includePayload ? row.payload : undefined
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

    const { rows } = await SQLquery(
        `INSERT INTO Inventory_Pending_Actions
            (branch_id, product_id, action_type, payload, status, current_stage, requires_admin_review, created_by, created_by_name, created_by_roles, manager_approver_id, manager_approved_at, approved_by, approved_at)
         VALUES ($1, $2, $3, $4::jsonb, 'pending', $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING *` ,
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
                        managerName
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
            COALESCE(
                (
                    SELECT jsonb_agg(jsonb_build_object(
                        'unit', sub.sell_unit,
                        'unit_price', sub.unit_price,
                        'base_quantity_per_sell_unit', sub.base_quantity_per_sell_unit,
                        'units_per_base', sub.units_per_base,
                        'is_base', sub.is_base
                    ) ORDER BY sub.is_base DESC, sub.sell_unit ASC)
                    FROM (
                        SELECT DISTINCT ON (sup.sell_unit)
                            sup.sell_unit,
                            sup.unit_price,
                            sup.base_quantity_per_sell_unit,
                            sup.units_per_base,
                            sup.is_base,
                            sup.updated_at
                        FROM inventory_product_sell_units sup
                        WHERE sup.product_id = ip.product_id
                        ORDER BY sup.sell_unit, sup.updated_at DESC
                    ) sub
                ),
                '[]'::jsonb
            ) AS selling_units,
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
            COALESCE(
                (
                    SELECT jsonb_agg(json_build_object(
                        'unit', sup.sell_unit,
                        'unit_price', sup.unit_price,
                        'base_quantity_per_sell_unit', sup.base_quantity_per_sell_unit,
                        'units_per_base', sup.units_per_base,
                        'is_base', sup.is_base
                    ) ORDER BY sup.is_base DESC, sup.sell_unit ASC)
                    FROM inventory_product_sell_units sup
                    WHERE sup.product_id = ip.product_id
                      AND sup.branch_id = ip.branch_id
                ),
                '[]'::jsonb
            ) AS selling_units,
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
                COALESCE(
                    (
                        SELECT jsonb_agg(json_build_object(
                            'unit', sup.sell_unit,
                            'unit_price', sup.unit_price,
                            'base_quantity_per_sell_unit', sup.base_quantity_per_sell_unit,
                            'units_per_base', sup.units_per_base,
                            'is_base', sup.is_base
                        ) ORDER BY sup.is_base DESC, sup.sell_unit ASC)
                        FROM inventory_product_sell_units sup
                        WHERE sup.product_id = ip.product_id
                          AND sup.branch_id = ip.branch_id
                    ),
                    '[]'::jsonb
                ) AS selling_units,
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
            COALESCE(
                (
                    SELECT jsonb_agg(json_build_object(
                        'unit', sup.sell_unit,
                        'unit_price', sup.unit_price,
                        'base_quantity_per_sell_unit', sup.base_quantity_per_sell_unit,
                        'units_per_base', sup.units_per_base,
                        'is_base', sup.is_base
                    ) ORDER BY sup.is_base DESC, sup.sell_unit ASC)
                    FROM inventory_product_sell_units sup
                    WHERE sup.product_id = ip.product_id
                      AND sup.branch_id = ip.branch_id
                ),
                '[]'::jsonb
            ) AS selling_units,
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
    const { bypassApproval = false, requestedBy = null, actingUser = null } = options;

    const roles = normalizeRoles(productData.requestor_roles || productData.userRoles);
    const pendingBranchId = Number(productData.branch_id ?? productData.branchId);
    const isBranchManager = roles.includes('Branch Manager');
    const isOwner = roles.includes('Owner');
    const existingProductId = productData.existing_product_id ?? productData.existingProductId ?? null;
    const isNewProductSubmission = !existingProductId;
    const actingUserId = actingUser?.userID ?? productData.userID;
    const actingUserName = actingUser?.fullName ?? productData.fullName;
    const requiresApproval = !bypassApproval && needsBranchManagerApproval(roles);

    if (requiresApproval) {
        const pendingRecord = await createPendingInventoryAction({
            actionType: 'create',
            productData,
            branchId: pendingBranchId,
            productId: existingProductId || null,
            currentState: null
        });

        return { status: 'pending', action: 'create', pending: pendingRecord };
    }

    if (!bypassApproval && isNewProductSubmission && isBranchManager && !isOwner) {
        const pendingRecord = await createPendingInventoryAction({
            actionType: 'create',
            productData,
            branchId: pendingBranchId,
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

    const cleanedData = sanitizeProductPayload({
        ...productData,
        userID: actingUserId,
        fullName: actingUserName
    });

    const { product_name, category_id, branch_id, unit, unit_price, unit_cost, quantity_added, min_threshold, max_threshold, date_added, product_validity, userID, fullName, existing_product_id, description, selling_units: sanitizedSellingUnits } = cleanedData;

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
    const sellingUnits = Array.isArray(sanitizedSellingUnits) && sanitizedSellingUnits.length > 0
        ? sanitizedSellingUnits
        : normalizeSellingUnitsPayload([], unit, unit_price).units;
    
    await SQLquery(
        `INSERT INTO Inventory_Product 
        (product_id, category_id, branch_id, product_name, unit, unit_price, unit_cost, min_threshold, max_threshold, base_unit, conversion_factor)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [product_id, category_id, branch_id, product_name, unit, unit_price, unit_cost, min_threshold, max_threshold, unitConversion.base_unit, unitConversion.conversion_factor]
    );   

    await replaceProductSellingUnits(product_id, branch_id, sellingUnits);

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
        [product_id, branch_id, productAddedNotifheader, notifMessage, color, userID, fullName]
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

    const alertTimestamp = alertResult.rows[0]?.alert_date ?? null;

    if (alertResult.rows[0]) {
        broadcastNotification(branch_id, {
            alert_id: alertResult.rows[0].alert_id,
            alert_type: productAddedNotifheader,
            message: notifMessage,
            banner_color: color,
            user_id: alertResult.rows[0].user_id,
            user_full_name: fullName,
            alert_date: alertResult.rows[0].alert_date,
            product_id: product_id,
            add_stock_id: addedStockRow?.add_id ?? null,
            history_timestamp: addedStockRow?.date_added ?? null,
            alert_timestamp: alertTimestamp,
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

    const { product_name, branch_id, category_id, unit, unit_price, unit_cost, quantity_added, min_threshold, max_threshold, date_added, product_validity, userID, fullName, selling_units: sanitizedSellingUnits } = cleanedData;

    const sellingUnitsProvided = Array.isArray(sanitizedSellingUnits) && sanitizedSellingUnits.length > 0;

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

    const basePriceForNormalization = Number.isFinite(normalizedUnitPrice) && normalizedUnitPrice > 0
        ? normalizedUnitPrice
        : Number(unit_price);

    let sellingUnitsToPersist = await getProductSellingUnits(itemId, branch_id);

    if (sellingUnitsProvided) {
        sellingUnitsToPersist = sanitizedSellingUnits;
    }

    if (unitChanged) {
        sellingUnitsToPersist = normalizeSellingUnitsPayload([], unit, basePriceForNormalization).units;
    } else if (!sellingUnitsProvided && (!sellingUnitsToPersist || sellingUnitsToPersist.length === 0)) {
        sellingUnitsToPersist = normalizeSellingUnitsPayload([], unit, basePriceForNormalization).units;
    }

    if (!sellingUnitsProvided && !unitChanged && Array.isArray(sellingUnitsToPersist)) {
        sellingUnitsToPersist = sellingUnitsToPersist.map(entry => {
            if (entry.unit === unit) {
                return {
                    ...entry,
                    unit_price: basePriceForNormalization,
                    is_base: true,
                    base_quantity_per_sell_unit: 1,
                    units_per_base: 1
                };
            }
            return entry;
        });
    }

    sellingUnitsToPersist = normalizeSellingUnitsPayload(sellingUnitsToPersist, unit, basePriceForNormalization).units;
    const shouldUpdateSellingUnits = sellingUnitsProvided || unitChanged || priceChanged || !sellingUnitsToPersist.length;

    let alertResult = null;
    let finalMessage = '';

    let addedStockRow = null;

    if (quantity_added !== 0) {
        addedStockRow = await addStocksQuery();
    }

    if (priceChanged) {
        await SQLquery(
            `UPDATE Inventory_Product 
            SET unit_price = $1 
            WHERE product_id = $2 AND branch_id = $3`,
            [normalizedUnitPrice, itemId, branch_id]
        );
    }

    if (quantity_added !== 0 && priceChanged) {
        finalMessage = `${addqQuantityNotifMessage} and ${changePriceNotifMessage}`;
    } else if (quantity_added !== 0 && !priceChanged) {
        finalMessage = addqQuantityNotifMessage;
    } else if (quantity_added === 0 && priceChanged) {
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
                user_full_name: fullName,
                alert_date: alertResult.rows[0].alert_date,
                product_id: itemId,
                add_stock_id: addedStockRow?.add_id ?? null,
                history_timestamp: addedStockRow?.date_added ?? null,
                alert_timestamp: alertTimestamp,
                isDateToday: true,
                alert_date_formatted: 'Just now'
            });
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
                product_id: itemId,
                add_stock_id: null,
                history_timestamp: null,
                alert_timestamp: infoAlertResult.rows[0].alert_date,
                isDateToday: true,
                alert_date_formatted: 'Just now'
            });
        }
    }

    if (shouldUpdateSellingUnits) {
        await replaceProductSellingUnits(itemId, branch_id, sellingUnitsToPersist);
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
            pending_id: pendingId,
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
        pending_id: pendingId,
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