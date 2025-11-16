import { SQLquery } from "../../db.js";
import {correctDateFormat} from "../Services_Utils/convertRedableDate.js";
import { checkAndHandleLowStock } from "../Services_Utils/lowStockNotification.js";
import { broadcastInventoryUpdate, broadcastSaleUpdate, broadcastNotification, broadcastValidityUpdate } from "../../server.js";
import { convertToBaseUnit, convertToDisplayUnit } from "../Services_Utils/unitConversion.js";
import { invalidateAnalyticsCache } from "../analytics/analyticsServices.js";


const getSaleUnitConfig = async (productId, branchId, sellUnit) => {
    const { rows } = await SQLquery(
        `SELECT 
            ip.unit AS inventory_unit,
            ip.conversion_factor,
            ip.unit_price AS base_unit_price
         FROM Inventory_Product ip
         WHERE ip.product_id = $1 AND ip.branch_id = $2`,
        [productId, branchId]
    );

    if (rows.length === 0) {
        throw new Error(`Product with ID ${productId} not found in inventory`);
    }

    const row = rows[0];
    const inventoryUnit = row.inventory_unit;
    const conversionFactor = Number(row.conversion_factor ?? 1) || 1;

    if (sellUnit && sellUnit !== inventoryUnit) {
        throw new Error(`Unit '${sellUnit}' is not supported for product ID ${productId}. Use '${inventoryUnit}' instead.`);
    }

    const unitPrice = Number(row.base_unit_price);
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
        throw new Error(`Base unit price is not configured for product ID ${productId}`);
    }

    const baseQuantityPerSellUnit = 1;

    return {
        inventory_unit: inventoryUnit,
        conversion_factor: conversionFactor,
        base_quantity_per_sell_unit: baseQuantityPerSellUnit,
        unit_price: unitPrice
    };
};

// VIEW SALE
export const viewSale = async (branchId) => {
   const { rows } = await SQLquery(`
    SELECT 
        Sales_Information.sales_information_id, 
        Sales_Information.branch_id, 
        charge_to, 
        tin, address, 
        ${correctDateFormat('date')}, 
        vat, 
        amount_net_vat, 
        total_amount_due, 
        discount, 
        transaction_by, 
        delivery_fee, 
        is_for_delivery,
        COALESCE(is_delivered, false) AS is_delivered,
        COALESCE(is_pending, true) AS is_pending
    FROM Sales_Information 
    LEFT JOIN Delivery 
    USING(sales_information_id)
    WHERE Sales_Information.branch_id = $1;`, [branchId]);
   
   return rows;
};

// VIEW A SPECIFIC SALE
export const viewSelectedItem = async (saleId) => {
   const { rows } = await SQLquery(`
        SELECT product_id, branch_id, Inventory_Product.product_name,  Sales_Items.quantity_display as quantity, Sales_Items.unit, Sales_Items.unit_price, amount 
        FROM Sales_Items
        LEFT JOIN Inventory_Product USING(product_id, branch_id)
        WHERE sales_information_id = $1;`
    
    , [saleId]);
   
   return rows;
};

// ADD SALE
export const addSale = async (headerAndProducts = {}) => {
        const { headerInformationAndTotal = {}, productRow = [] } = headerAndProducts;

        const branchId = Number(headerInformationAndTotal.branch_id);
        if (!Number.isInteger(branchId)) {
            throw new Error('branch_id is required to submit a sale.');
        }

        if (!Array.isArray(productRow) || productRow.length === 0) {
            throw new Error('At least one product line is required to submit a sale.');
        }

        const chargeTo = headerInformationAndTotal.chargeTo?.trim?.() ?? '';
        const tin = headerInformationAndTotal.tin?.trim?.() ?? '';
        const address = headerInformationAndTotal.address?.trim?.() ?? '';
        const date = headerInformationAndTotal.date ?? new Date().toISOString().slice(0, 10);
        const vat = Number(headerInformationAndTotal.vat) || 0;
        const amountNetVat = Number(headerInformationAndTotal.amountNetVat) || 0;
        const additionalDiscount = Number(headerInformationAndTotal.additionalDiscount) || 0;
        const deliveryFee = Number(headerInformationAndTotal.deliveryFee) || 0;
        const totalAmountDue = Number(headerInformationAndTotal.totalAmountDue) || 0;
        const transactionBy = headerInformationAndTotal.transactionBy || '';
        const isForDelivery = Boolean(headerInformationAndTotal.isForDelivery);

        const saleUnitConfigCache = new Map();
        const normalizedLines = [];

        let saleId;
        do {
            saleId = Math.floor(1_000_000 + Math.random() * 9_000_000);
        } while ((await SQLquery('SELECT 1 FROM Sales_Information WHERE sales_information_id = $1', [saleId])).rowCount > 0);

        await SQLquery('BEGIN');
        try {
            for (const rawLine of productRow) {
                const productId = Number(rawLine.product_id);
                if (!Number.isInteger(productId)) {
                    throw new Error('Each sale line must include a valid product_id.');
                }

                const rawUnit = typeof rawLine.unit === 'string' ? rawLine.unit.trim() : '';
                if (!rawUnit) {
                    throw new Error(`Selling unit is required for product ID ${productId}.`);
                }

                const quantityDisplay = Number(rawLine.quantity);
                if (!Number.isFinite(quantityDisplay) || quantityDisplay <= 0) {
                    throw new Error(`Invalid quantity for product ID ${productId}. Quantity must be greater than 0.`);
                }

                const cacheKey = `${productId}:${rawUnit}`;
                let saleConfig = saleUnitConfigCache.get(cacheKey);
                if (!saleConfig) {
                    saleConfig = await getSaleUnitConfig(productId, branchId, rawUnit);
                    saleUnitConfigCache.set(cacheKey, saleConfig);
                }

                const baseQuantityOverride = Number(rawLine.baseQuantityPerSellUnit ?? rawLine.base_quantity_per_sell_unit);
                const baseQuantityPerSellUnit = Number.isFinite(baseQuantityOverride) && baseQuantityOverride > 0
                    ? baseQuantityOverride
                    : saleConfig.base_quantity_per_sell_unit;

                const quantityInventoryUnit = quantityDisplay * baseQuantityPerSellUnit;
                const quantityBase = convertToBaseUnit(quantityInventoryUnit, saleConfig.inventory_unit);
                if (!Number.isFinite(quantityBase) || quantityBase <= 0) {
                    throw new Error(`Unable to resolve a valid base quantity for product ID ${productId}.`);
                }

                // NOTE: availability check is deferred until after all lines are normalized
                // to correctly validate combined requested quantities per product (prevents
                // per-line checks from allowing overcommit when a sale contains multiple
                // lines for the same product).

                const requestedUnitPrice = Number(rawLine.unitPrice ?? rawLine.unit_price);
                const lineUnitPrice = Number.isFinite(requestedUnitPrice) && requestedUnitPrice > 0
                    ? requestedUnitPrice
                    : saleConfig.unit_price;

                const lineAmount = Number((lineUnitPrice * quantityDisplay).toFixed(2));

                normalizedLines.push({
                    product_id: productId,
                    sale_unit: rawUnit,
                    quantity_display: quantityDisplay,
                    unit_price: lineUnitPrice,
                    line_amount: lineAmount,
                    quantity_base: quantityBase,
                    base_quantity_per_sell_unit: baseQuantityPerSellUnit,
                    inventory_unit: saleConfig.inventory_unit,
                    conversion_factor: saleConfig.conversion_factor
                });
            }

            // After we've normalized all lines, verify combined availability per product
            // (sum requested base quantities for each product) to prevent overcommit when
            // multiple lines in the same sale reference the same product.

            // Build totals per product
            const totalsByProduct = new Map();
            for (const line of normalizedLines) {
                const prev = totalsByProduct.get(line.product_id) || 0;
                totalsByProduct.set(line.product_id, prev + Number(line.quantity_base));
            }

            // Validate availability for each product
            for (const [productId, requiredBase] of totalsByProduct.entries()) {
                const { rows: stockRows } = await SQLquery(
                    'SELECT COALESCE(SUM(quantity_left_base),0) AS available_quantity_base FROM Add_Stocks WHERE product_id = $1 AND branch_id = $2 AND quantity_left_base > 0',
                    [productId, branchId]
                );

                const availableQuantityBase = Number(stockRows?.[0]?.available_quantity_base) || 0;

                if (requiredBase > availableQuantityBase) {
                    // Find a normalized line for unit/context to format the message
                    const sampleLine = normalizedLines.find(l => l.product_id === productId) || {};
                    const availableInventoryDisplay = convertToDisplayUnit(availableQuantityBase, sampleLine.inventory_unit || '');
                    const requestedDisplay = convertToDisplayUnit(requiredBase, sampleLine.inventory_unit || '');
                    throw new Error(`Insufficient inventory for product ID ${productId}. Available: ${availableInventoryDisplay} ${sampleLine.inventory_unit || ''}, Requested: ${requestedDisplay} ${sampleLine.sale_unit || ''}`);
                }
            }

            await SQLquery(
                `INSERT INTO Sales_Information (sales_information_id, branch_id, charge_to, tin, address, date, vat, amount_net_vat, total_amount_due, discount, transaction_by, delivery_fee, is_for_delivery)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
                [
                    saleId,
                    branchId,
                    chargeTo,
                    tin,
                    address,
                    date,
                    vat,
                    amountNetVat,
                    totalAmountDue,
                    additionalDiscount,
                    transactionBy,
                    deliveryFee,
                    isForDelivery
                ]
            );

            const itemValues = [];
            const placeholders = [];
            normalizedLines.forEach((line, index) => {
                const baseIndex = index * 9;
                placeholders.push(`($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}, $${baseIndex + 6}, $${baseIndex + 7}, $${baseIndex + 8}, $${baseIndex + 9})`);
                itemValues.push(
                    saleId,
                    line.product_id,
                    line.quantity_display,
                    line.quantity_base,
                    line.sale_unit,
                    line.unit_price,
                    line.line_amount,
                    branchId,
                    line.conversion_factor
                );
            });

            if (placeholders.length > 0) {
                await SQLquery(
                    `INSERT INTO Sales_Items (sales_information_id, product_id, quantity_display, quantity_base, unit, unit_price, amount, branch_id, conversion_factor)
                     VALUES ${placeholders.join(', ')}`,
                    itemValues
                );
            }

            // Deduct stock for each line. Collect affected product ids so we can
            // run low-stock checks after the transaction commits (to avoid
            // notification failures rolling back inventory updates).
            const productsToCheck = new Set();
            for (const line of normalizedLines) {
                await deductStockAndTrackUsage(
                    saleId,
                    line.product_id,
                    line.quantity_display,
                    branchId,
                    headerInformationAndTotal.userID,
                    line.sale_unit,
                    line.base_quantity_per_sell_unit
                );
                productsToCheck.add(line.product_id);
            }

            await SQLquery('COMMIT');

            // After commit, run low-stock checks for affected products. These may
            // produce alerts and push notifications but must not run inside the
            // sale transaction to avoid rollback on external failures.
            try {
                for (const pid of productsToCheck) {
                    try {
                        await checkAndHandleLowStock(pid, branchId, { triggeredByUserId: headerInformationAndTotal.userID });
                    } catch (notifyErr) {
                        console.error(`Post-commit checkAndHandleLowStock failed for product=${pid} branch=${branchId}:`, notifyErr?.message || notifyErr);
                        // continue with other products
                    }
                }
            } catch (err) {
                console.error('Error running post-commit low-stock checks:', err?.message || err);
            }

            invalidateAnalyticsCache();

            const { rows: saleRows } = await SQLquery(
                `SELECT 
                    Sales_Information.sales_information_id,
                    Sales_Information.branch_id,
                    charge_to,
                    tin,
                    address,
                    ${correctDateFormat('date')},
                    vat,
                    amount_net_vat,
                    total_amount_due,
                    discount,
                    transaction_by,
                    delivery_fee,
                    is_for_delivery,
                    COALESCE(is_delivered, false) AS is_delivered,
                    COALESCE(is_pending, true) AS is_pending
                 FROM Sales_Information
                 LEFT JOIN Delivery USING(sales_information_id)
                 WHERE Sales_Information.branch_id = $1 AND sales_information_id = $2`,
                [branchId, saleId]
            );

            const newSaleRecord = saleRows[0] ?? null;

            broadcastSaleUpdate(branchId, {
                action: 'add',
                sale: newSaleRecord,
                user_id: headerInformationAndTotal.userID || null
            });

            for (const line of normalizedLines) {
                const { rows: updatedProduct } = await SQLquery(
                    `SELECT 
                        inventory_product.product_id,
                        inventory_product.branch_id,
                        Category.category_id,
                        Category.category_name,
                        product_name,
                        unit,
                        unit_price,
                        unit_cost,
                        COALESCE(SUM(CASE WHEN ast.product_validity < NOW() THEN 0 ELSE ast.quantity_left_display END), 0) AS quantity,
                        min_threshold,
                        max_threshold
                     FROM inventory_product
                     LEFT JOIN Category USING(category_id)
                     LEFT JOIN Add_Stocks ast USING(product_id, branch_id)
                     WHERE inventory_product.product_id = $1 AND inventory_product.branch_id = $2
                     GROUP BY inventory_product.product_id, inventory_product.branch_id, Category.category_id, Category.category_name, product_name, unit, unit_price, unit_cost, min_threshold, max_threshold`,
                    [line.product_id, branchId]
                );

                if (updatedProduct[0]) {
                    broadcastInventoryUpdate(branchId, {
                        action: 'sale_deduction',
                        product: updatedProduct[0],
                        sale_id: saleId,
                        quantity_sold: line.quantity_display,
                        user_id: headerInformationAndTotal.userID || null
                    });
                }
            }

            broadcastValidityUpdate(branchId, {
                action: 'inventory_changed_by_sale',
                sale_id: saleId,
                affected_products: normalizedLines.map(line => line.product_id),
                user_id: headerInformationAndTotal.userID || null
            });

            const saleNotificationMessage = `New sale created by ${transactionBy} for ${chargeTo} - Total: ₱${totalAmountDue}`;
            const alertResult = await SQLquery(
                `INSERT INTO Inventory_Alerts (product_id, branch_id, alert_type, message, banner_color, user_id, user_full_name)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 RETURNING *`,
                [null, branchId, 'New Sale', saleNotificationMessage, 'green', headerInformationAndTotal.userID || null, transactionBy]
            );

            if (alertResult.rows[0]) {
                try {
                    await SQLquery(
                        `INSERT INTO inventory_alert_sale_links (alert_id, sales_information_id, updated_at)
                         VALUES ($1, $2, NOW())
                         ON CONFLICT (alert_id) DO UPDATE
                         SET sales_information_id = EXCLUDED.sales_information_id,
                             updated_at = NOW()`,
                        [alertResult.rows[0].alert_id, saleId]
                    );
                } catch (linkError) {
                    console.error('Failed to link sale notification to sale record:', linkError.message);
                }

                broadcastNotification(
                    branchId,
                    {
                        alert_id: alertResult.rows[0].alert_id,
                        alert_type: 'New Sale',
                        message: saleNotificationMessage,
                        banner_color: 'green',
                        user_id: alertResult.rows[0].user_id,
                        user_full_name: transactionBy,
                        alert_date: alertResult.rows[0].alert_date,
                        isDateToday: true,
                        alert_date_formatted: 'Just now',
                        sales_information_id: saleId,
                        category: 'sales',
                        highlight_context: { reason: 'new-sale', sale_id: saleId },
                        target_roles: ['Sales Associate'],
                        creator_id: headerInformationAndTotal.userID
                    },
                    { category: 'sales', excludeUserId: headerInformationAndTotal.userID }
                );
            }

            return newSaleRecord;
        } catch (error) {
            await SQLquery('ROLLBACK');
            throw error;
        }
    };

export const deductStockAndTrackUsage = async (
    saleId,
    productId,
    quantityDisplay,
    branchId,
    userId = null,
    saleUnit = null,
    baseQuantityPerSellUnit = null
) => {
    const resolvedQuantityDisplay = Number(quantityDisplay);
    if (!Number.isFinite(resolvedQuantityDisplay) || resolvedQuantityDisplay <= 0) {
        throw new Error('A valid quantity is required to deduct stock.');
    }

    console.log(`deductStockAndTrackUsage START saleId=${saleId} productId=${productId} qtyDisplay=${resolvedQuantityDisplay} branchId=${branchId}`);

    const saleConfig = await getSaleUnitConfig(productId, branchId, saleUnit);

    const resolvedBaseQuantityPerSellUnit = Number.isFinite(baseQuantityPerSellUnit) && baseQuantityPerSellUnit > 0
        ? baseQuantityPerSellUnit
        : saleConfig.base_quantity_per_sell_unit;

    const inventoryDisplayQuantity = resolvedQuantityDisplay * resolvedBaseQuantityPerSellUnit;
    const requiredBaseQuantity = convertToBaseUnit(inventoryDisplayQuantity, saleConfig.inventory_unit);

    if (!Number.isFinite(requiredBaseQuantity) || requiredBaseQuantity <= 0) {
        throw new Error('Unable to determine the base quantity needed for stock deduction.');
    }

    let remainingBaseQuantity = requiredBaseQuantity;

    const { rows: stockBatches } = await SQLquery(
        `SELECT add_id, quantity_left_display, quantity_left_base, product_validity
         FROM Add_Stocks
         WHERE product_id = $1
           AND branch_id = $2
           AND quantity_left_base > 0
           AND quantity_left_display > 0
           AND (product_validity IS NULL OR product_validity >= NOW())
         ORDER BY product_validity ASC NULLS LAST, add_id ASC
         FOR UPDATE`,
        [productId, branchId]
    );

    console.log(`Found ${stockBatches.length} stock batch(es) for product ${productId} at branch ${branchId}`);

    if (stockBatches.length === 0) {
        console.error(`No available stock batches to deduct from for product ${productId} (sale ${saleId})`);
        throw new Error('No available stock batches to deduct from.');
    }

    const deductionLog = [];

    for (const batch of stockBatches) {
        if (remainingBaseQuantity <= 0) {
            break;
        }

        const batchBaseLeft = Number(batch.quantity_left_base);
        if (!Number.isFinite(batchBaseLeft) || batchBaseLeft <= 0) {
            continue;
        }

        const baseToDeduct = Math.min(batchBaseLeft, remainingBaseQuantity);

        let displayToDeduct = convertToDisplayUnit(baseToDeduct, saleConfig.inventory_unit);
        if (batchBaseLeft === baseToDeduct) {
            displayToDeduct = Number(Number(batch.quantity_left_display).toFixed(3));
        } else {
            displayToDeduct = Number(displayToDeduct.toFixed(3));
        }

        const updateResult = await SQLquery(
            `UPDATE Add_Stocks
             SET quantity_left_display = quantity_left_display - $1,
                 quantity_left_base = quantity_left_base - $2
             WHERE add_id = $3`,
            [displayToDeduct, baseToDeduct, batch.add_id]
        );

        console.log(`Updated Add_Stocks add_id=${batch.add_id}: rows=${updateResult.rowCount} subtracted display=${displayToDeduct} base=${baseToDeduct}`);

        // Read back the batch to verify values after update (helps diagnose why UI doesn't reflect change)
        try {
            const { rows: verifyRows } = await SQLquery(
                `SELECT add_id, quantity_left_display, quantity_left_base FROM Add_Stocks WHERE add_id = $1`,
                [batch.add_id]
            );
            if (verifyRows && verifyRows[0]) {
                console.log(`Post-update Add_Stocks[${batch.add_id}]: display=${verifyRows[0].quantity_left_display} base=${verifyRows[0].quantity_left_base}`);
            } else {
                console.warn(`Could not read back Add_Stocks row for add_id=${batch.add_id}`);
            }
        } catch (verifyErr) {
            console.error(`Failed to verify Add_Stocks after update for add_id=${batch.add_id}:`, verifyErr.message);
        }

        const insertResult = await SQLquery(
            `INSERT INTO Sales_Stock_Usage (
                sales_information_id,
                product_id,
                branch_id,
                add_stock_id,
                quantity_used_display,
                quantity_used_base
            ) VALUES ($1, $2, $3, $4, $5, $6) RETURNING usage_id`,
            [saleId, productId, branchId, batch.add_id, displayToDeduct, baseToDeduct]
        );

        console.log(`Inserted Sales_Stock_Usage usage_id=${insertResult.rows?.[0]?.usage_id ?? 'n/a'} for sale=${saleId} add_id=${batch.add_id}`);

        deductionLog.push({
            add_stock_id: batch.add_id,
            quantity_used_display: displayToDeduct,
            quantity_used_base: baseToDeduct
        });

        remainingBaseQuantity -= baseToDeduct;
    }

    if (remainingBaseQuantity > 0) {
        throw new Error('Insufficient inventory while deducting stock (partial deduction occurred).');
    }

    // NOTE: low-stock notification is intentionally NOT handled here to avoid
    // performing additional writes / external I/O while still inside the stock
    // deduction transaction. Callers should invoke `checkAndHandleLowStock` after
    // they commit the surrounding transaction to ensure notifications do not
    // cause a rollback of inventory updates.

    return {
        quantity_display: resolvedQuantityDisplay,
        quantity_base: requiredBaseQuantity,
        deductions: deductionLog
    };
};

export const restoreStockFromSale = async (
    salesInformationId,
    reason = 'Sale reversed',
    branchId,
    userID = null
) => {
    try {
        await SQLquery('BEGIN');

        const { rows: stockUsage } = await SQLquery(
            `SELECT usage_id, product_id, add_stock_id,
                    quantity_used_display, quantity_used_base
             FROM Sales_Stock_Usage
             WHERE sales_information_id = $1 AND is_restored = false`,
            [salesInformationId]
        );

        if (stockUsage.length === 0) {
            console.log(`No stock usage found to restore for sale ${salesInformationId}`);
            await SQLquery('COMMIT');
            return { success: true, message: 'No stock to restore' };
        }

        for (const usage of stockUsage) {
            const updateResult = await SQLquery(
                `UPDATE Add_Stocks
                 SET quantity_left_display = quantity_left_display + $1,
                     quantity_left_base = quantity_left_base + $2
                 WHERE add_id = $3`,
                [usage.quantity_used_display, usage.quantity_used_base, usage.add_stock_id]
            );

            if (updateResult.rowCount === 0) {
                throw new Error(`Failed to restore stock to batch ${usage.add_stock_id}`);
            }

            await SQLquery(
                `UPDATE Sales_Stock_Usage
                 SET is_restored = true, restored_date = CURRENT_TIMESTAMP
                 WHERE usage_id = $1`,
                [usage.usage_id]
            );

            console.log(
                `Restored ${usage.quantity_used_display} units to batch ${usage.add_stock_id} from sale ${salesInformationId} (${reason})`
            );
        }

    await SQLquery('COMMIT');

    console.log(`COMMIT completed for salesInformationId=${salesInformationId} branch=${branchId}`);

    invalidateAnalyticsCache();

        const restoredProductIds = [...new Set(stockUsage.map((usage) => usage.product_id))];
        for (const productId of restoredProductIds) {
            await checkAndHandleLowStock(productId, branchId, { triggeredByUserId: userID });
        }

        broadcastValidityUpdate(branchId, {
            action: 'stock_restored',
            sale_id: salesInformationId,
            restored_products: stockUsage.map((usage) => ({
                product_id: usage.product_id,
                quantity_restored: usage.quantity_used_display
            })),
            reason,
            user_id: userID || null
        });

        return { success: true, message: `Stock restored for sale ${salesInformationId}` };
    } catch (error) {
        await SQLquery('ROLLBACK');
        console.error(`Error restoring stock for sale ${salesInformationId}:`, error.message);
        throw error;
    }
};


// REMOVE THE OLD DELIVERY CONFIRMATION FUNCTION SINCE WE NO LONGER NEED IT
// STOCK IS NOW DEDUCTED IMMEDIATELY WHEN SALE IS PLACED


// CANCEL SALE AND RESTORE STOCK TO ORIGINAL BATCHES
export const cancelSale = async (salesInformationId, reason = 'Sale canceled') => {
    try {
        await SQLquery('BEGIN');
        
    // CHECK IF SALE EXISTS AND GET ITS CURRENT STATUS AND BRANCH ID
        const {rows: saleInfo} = await SQLquery(
            'SELECT sales_information_id, is_for_delivery, branch_id FROM Sales_Information WHERE sales_information_id = $1',
            [salesInformationId]
        );
        
        if (saleInfo.length === 0) {
            throw new Error(`Sale with ID ${salesInformationId} not found`);
        }
        
        const branchId = saleInfo[0].branch_id;
        
    // RESTORE STOCK TO ORIGINAL BATCHES
        await restoreStockFromSale(salesInformationId, reason, branchId);
        
    // OPTIONAL: MARK SALE AS CANCELED (YOU MIGHT WANT TO ADD A STATUS COLUMN)
        // await SQLquery('UPDATE Sales_Information SET status = $1 WHERE sales_information_id = $2', ['canceled', salesInformationId]);
        
        await SQLquery('COMMIT');

    invalidateAnalyticsCache();
        return { success: true, message: `Sale ${salesInformationId} canceled and stock restored` };
        
    } catch (error) {
        await SQLquery('ROLLBACK');
        throw error;
    }
};