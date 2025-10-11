import { SQLquery } from "../../db.js";
import {correctDateFormat} from "../Services_Utils/convertRedableDate.js";
import { checkAndHandleLowStock } from "../Services_Utils/lowStockNotification.js";
import { broadcastInventoryUpdate, broadcastSaleUpdate, broadcastNotification, broadcastValidityUpdate } from "../../server.js";



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
        COALESCE(is_pending, false) AS is_pending
    FROM Sales_Information 
    LEFT JOIN Delivery 
    USING(sales_information_id)
    WHERE Sales_Information.branch_id = $1;`, [branchId]);
   
   return rows;
};



// VIEW A SPECIFIC SALE
export const viewSelectedItem = async (saleId) => {
   const { rows } = await SQLquery(`

        SELECT product_id, branch_id, Inventory_Product.product_name,  Sales_Items.quantity, Sales_Items.unit, Sales_Items.unit_price, amount 
        FROM Sales_Items
        LEFT JOIN Inventory_Product USING(product_id, branch_id)
        WHERE sales_information_id = $1;`
    
    , [saleId]);
   
   return rows;
};



// ADD SALE
export const addSale = async (headerAndProducts) => {

    const {headerInformationAndTotal = {}, productRow = []} = headerAndProducts;

    const {chargeTo, tin, address, date, branch_id, seniorPw,  vat, amountNetVat, additionalDiscount,
        deliveryFee, totalAmountDue, transactionBy, isForDelivery } = headerInformationAndTotal;

   
    let sale_id;
    let isUnique = false;
    while (!isUnique) {
        sale_id = Math.floor(1000000 + Math.random() * 9000000); 
        const check = await SQLquery('SELECT 1 FROM Sales_Information WHERE sales_information_id = $1', [sale_id]);
        if (check.rowCount === 0) isUnique = true;
    }

    try {
        await SQLquery('BEGIN');

    // CHECK DATABASE AGAIN FOR IF AVAILABLE QUANTITY IS ENOUGH (INSIDE TRANSACTION)
        if (productRow && productRow.length > 0) {
            for (const product of productRow) {
                // CHECK AVAILABLE QUANTITY WITHOUT FOR UPDATE ON AGGREGATE
                const inventoryCheck = await SQLquery(
                    'SELECT SUM(quantity_left) as available_quantity FROM Add_Stocks WHERE product_id = $1 AND branch_id = $2 AND quantity_left > 0',
                    [product.product_id, branch_id]
                );
                
                if (inventoryCheck.rowCount === 0 || !inventoryCheck.rows[0].available_quantity) {
                    throw new Error(`Product with ID ${product.product_id} not found in inventory`);
                }
                
                const availableQuantity = Number(inventoryCheck.rows[0].available_quantity);
                if (Number(product.quantity) > availableQuantity) {
                    throw new Error(`Insufficient inventory for product ID ${product.product_id}. Available: ${availableQuantity}, Requested: ${product.quantity}`);
                }
            }
        }

    
        await SQLquery(`
            INSERT INTO Sales_Information ( sales_information_id, branch_id, charge_to, tin, address, date, vat, amount_net_vat, total_amount_due, discount, transaction_by, delivery_fee, is_for_delivery ) VALUES ( $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13);

        `, [sale_id, branch_id, chargeTo, tin, address, date, vat, amountNetVat, totalAmountDue, additionalDiscount, transactionBy, deliveryFee, isForDelivery]);



    
   
        if (productRow && productRow.length > 0) {


            const values = [];
            const placeholders = [];
            productRow.forEach((p, i) => {
            const baseIndex = i * 7;
            placeholders.push(`($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}, $${baseIndex + 6}, $${baseIndex + 7})`);
            values.push(sale_id, p.product_id, p.quantity, p.unit, p.unitPrice, p.amount, branch_id);
            });

            const query = `INSERT INTO Sales_Items(sales_information_id, product_id, quantity, unit, unit_price, amount, branch_id) VALUES ${placeholders.join(', ')}`;
            await SQLquery(query, values);

        // FIFO STOCK DEDUCTION WITH DEADLOCK PREVENTION
        // ALWAYS DEDUCT STOCK IMMEDIATELY WHEN SALE IS PLACED (REGARDLESS OF DELIVERY STATUS)
        // THIS PREVENTS PHANTOM INVENTORY WHERE PENDING ORDERS DON'T REFLECT IN AVAILABLE STOCK
            for (const product of productRow) {
                await deductStockAndTrackUsage(sale_id, product.product_id, Number(product.quantity), branch_id, headerInformationAndTotal.userID);
            }
        };


        await SQLquery('COMMIT');


        const {rows} = await SQLquery(`
            SELECT 
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
            LEFT JOIN Delivery 
            USING(sales_information_id)
            WHERE Sales_Information.branch_id = $1 AND sales_information_id = $2;`
        , [branch_id, sale_id]);

        const newSaleRecord = rows[0];

        // BROADCAST SALE UPDATE TO ALL USERS IN THE BRANCH
        broadcastSaleUpdate(branch_id, {
            action: 'add',
            sale: newSaleRecord,
            user_id: headerInformationAndTotal.userID || null
        });

        // BROADCAST INVENTORY UPDATES FOR ALL PRODUCTS THAT HAD STOCK DEDUCTED
        if (productRow && productRow.length > 0) {
            for (const product of productRow) {
                // GET UPDATED INVENTORY DATA FOR EACH AFFECTED PRODUCT
                const { rows: updatedProduct } = await SQLquery(`
                    SELECT 
                        inventory_product.product_id, 
                        inventory_product.branch_id, 
                        Category.category_id, 
                        Category.category_name, 
                        product_name, 
                        unit, 
                        unit_price, 
                        unit_cost, 
                        COALESCE(SUM(CASE WHEN ast.product_validity < NOW() THEN 0 ELSE ast.quantity_left END), 0) AS quantity,
                        min_threshold,
                        max_threshold
                    FROM inventory_product
                    LEFT JOIN Category USING(category_id)
                    LEFT JOIN Add_Stocks ast USING(product_id, branch_id)
                    WHERE inventory_product.product_id = $1 AND inventory_product.branch_id = $2
                    GROUP BY 
                        inventory_product.product_id, 
                        inventory_product.branch_id, 
                        Category.category_id, 
                        Category.category_name, 
                        product_name, 
                        unit, 
                        unit_price, 
                        unit_cost, 
                        min_threshold,
                        max_threshold`,
                    [product.product_id, branch_id]
                );

                if (updatedProduct[0]) {
                    broadcastInventoryUpdate(branch_id, {
                        action: 'sale_deduction',
                        product: updatedProduct[0],
                        sale_id: sale_id,
                        quantity_sold: product.quantity,
                        user_id: headerInformationAndTotal.userID || null
                    });
                }
            }

            // BROADCAST GENERAL VALIDITY UPDATE FOR PRODUCT VALIDITY PAGE REFRESH
            broadcastValidityUpdate(branch_id, {
                action: 'inventory_changed_by_sale',
                sale_id: sale_id,
                affected_products: productRow.map(p => p.product_id),
                user_id: headerInformationAndTotal.userID || null
            });
        }

        // BROADCAST NOTIFICATION FOR NEW SALE (WITH ROLE FILTERING)
        const saleNotificationMessage = `New sale created by ${transactionBy} for ${chargeTo} - Total: ₱${totalAmountDue}`;
        
        const alertResult = await SQLquery(
            `INSERT INTO Inventory_Alerts 
            (product_id, branch_id, alert_type, message, banner_color, user_id, user_full_name)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *`,
            [null, branch_id, 'New Sale', saleNotificationMessage, 'green', headerInformationAndTotal.userID || null, transactionBy]
        );

        if (alertResult.rows[0]) {
            broadcastNotification(branch_id, {
                alert_id: alertResult.rows[0].alert_id,
                alert_type: 'New Sale',
                message: saleNotificationMessage,
                banner_color: 'green',
                user_id: alertResult.rows[0].user_id,
                user_full_name: transactionBy,
                alert_date: alertResult.rows[0].alert_date,
                isDateToday: true,
                alert_date_formatted: 'Just now',
                target_roles: ['Sales Associate', 'Branch Manager'], 
                creator_id: headerInformationAndTotal.userID 
            }, { category: 'sales' });
        }

        return newSaleRecord;

    } catch (error) {

        await SQLquery('ROLLBACK');
        throw error;
    }

};


// DEDUCT STOCK AND TRACK WHICH BATCHES WERE USED
// THIS ALLOWS US TO RESTORE STOCK TO EXACT SAME BATCHES IF ORDER IS CANCELED
export const deductStockAndTrackUsage = async (salesInformationId, productId, quantityToDeduct, branchId, userID = null) => {
    if (!branchId) {
        throw new Error('branchId is required for stock deduction');
    }
    
    let remainingToDeduct = quantityToDeduct;

    // CHECK IF THERE ARE EXISTING RESTORED RECORDS FOR THIS SALE
    const { rows } = await SQLquery(
        `SELECT COUNT(*) as count, 
                BOOL_OR(is_restored) as has_restored
         FROM Sales_Stock_Usage  
         WHERE sales_information_id = $1`,
        [salesInformationId]
    );

    const hasExistingRecords = Number(rows[0].count) > 0;
    const hasRestoredRecords = rows[0].has_restored;

    
    // IF THIS IS A RE-DEDUCTION (STOCK WAS PREVIOUSLY RESTORED), WE NEED TO:
    // 1. DELETE THE OLD RESTORED RECORDS
    // 2. PROCEED WITH FRESH STOCK DEDUCTION
    if (hasExistingRecords && hasRestoredRecords) {
        await SQLquery(`
            DELETE FROM Sales_Stock_Usage 
            WHERE sales_information_id = $1 AND is_restored = true`,
            [salesInformationId]
        );
        console.log(`Deleted restored records for sale ${salesInformationId} - will proceed with fresh stock deduction`);
    }

    // PROCEED WITH STOCK DEDUCTION (EITHER FIRST TIME OR RE-DEDUCTION AFTER RESTORE)
    // USE SKIP LOCKED TO PREVENT DEADLOCKS IN HIGH-CONCURRENCY SCENARIOS
    const batches = await SQLquery(
        `SELECT add_id, quantity_left 
         FROM Add_Stocks 
         WHERE product_id = $1 AND branch_id = $2 AND quantity_left > 0 AND product_validity > CURRENT_DATE
         ORDER BY date_added ASC, product_validity ASC
         FOR UPDATE SKIP LOCKED`,
        [productId, branchId]
    );

    // IF NO UNLOCKED BATCHES AVAILABLE, WAIT AND RETRY
    if (batches.rowCount === 0) {
    // FALLBACK: TRY REGULAR FOR UPDATE (WILL WAIT FOR LOCKS)
        const lockedBatches = await SQLquery(
            `SELECT add_id, quantity_left 
             FROM Add_Stocks 
             WHERE product_id = $1 AND branch_id = $2 AND quantity_left > 0 AND product_validity > CURRENT_DATE
             ORDER BY date_added ASC, product_validity ASC
             FOR UPDATE`,
            [productId, branchId]
        );
        
        if (lockedBatches.rowCount === 0) {
            throw new Error(`No available stock for product ID ${productId}`);
        }
        
    // USE LOCKED BATCHES IF SKIP LOCKED RETURNED NOTHING
        batches.rows = lockedBatches.rows;
    }

    // PROCESS EACH BATCH USING FIFO
    for (const batch of batches.rows) {
        if (remainingToDeduct <= 0) break;

        const batchQuantity = Number(batch.quantity_left);
        const deductFromThisBatch = Math.min(remainingToDeduct, batchQuantity);
        const newQuantityLeft = batchQuantity - deductFromThisBatch;

    // ATOMIC UPDATE WITH VERSION CHECK
        const updateResult = await SQLquery(
            'UPDATE Add_Stocks SET quantity_left = $1 WHERE add_id = $2 AND quantity_left = $3',
            [newQuantityLeft, batch.add_id, batchQuantity]
        );

    // IF UPDATE FAILED (QUANTITY CHANGED BY ANOTHER TRANSACTION)
        if (updateResult.rowCount === 0) {
            throw new Error(`Concurrent modification detected for batch ${batch.add_id}. Please retry the transaction.`);
        }

    // ALWAYS CREATE NEW USAGE TRACKING RECORD FOR EACH BATCH USED
        await SQLquery(
            `INSERT INTO Sales_Stock_Usage (sales_information_id, product_id, add_stock_id, quantity_used, branch_id) 
            VALUES ($1, $2, $3, $4, $5)`,
            [salesInformationId, productId, batch.add_id, deductFromThisBatch, branchId]
        );

        remainingToDeduct -= deductFromThisBatch;
        
        console.log(`Deducted ${deductFromThisBatch} units from batch ${batch.add_id} for sale ${salesInformationId}`);
    }

    // CHECK IF ALL QUANTITY WAS DEDUCTED
    if (remainingToDeduct > 0) {
        throw new Error(`Unable to deduct full quantity for product ID ${productId}. Remaining: ${remainingToDeduct}`);
    }

    // BROADCAST VALIDITY UPDATE FOR PRODUCT VALIDITY PAGE REFRESH
    broadcastValidityUpdate(branchId, {
        action: 'stock_deducted',
        product_id: productId,
        sale_id: salesInformationId,
        quantity_deducted: quantityToDeduct,
        user_id: userID || null
    });

    await checkAndHandleLowStock(productId, branchId, {
        triggeredByUserId: userID
    });
};


// RESTORE STOCK TO ORIGINAL BATCHES WHEN ORDER IS CANCELED/UNDELIVERED
export const restoreStockFromSale = async (salesInformationId, reason = 'Order canceled', branchId, userID = null) => {
    try {
        await SQLquery('BEGIN');
        
    // GET ALL STOCK USAGE RECORDS FOR THIS SALE THAT HAVEN'T BEEN RESTORED YET
        const { rows: stockUsage } = await SQLquery(`
            SELECT usage_id, product_id, add_stock_id, quantity_used 
            FROM Sales_Stock_Usage 
            WHERE sales_information_id = $1 AND is_restored = false`,
            [salesInformationId]
        );
        
        if (stockUsage.length === 0) {
            console.log(`No stock usage found to restore for sale ${salesInformationId}`);
            await SQLquery('COMMIT');
            return { success: true, message: 'No stock to restore' };
        }
        
    // RESTORE STOCK TO EACH ORIGINAL BATCH
        for (const usage of stockUsage) {
            // ADD THE QUANTITY BACK TO THE ORIGINAL BATCH
            const updateResult = await SQLquery(
                'UPDATE Add_Stocks SET quantity_left = quantity_left + $1 WHERE add_id = $2',
                [usage.quantity_used, usage.add_stock_id]
            );
            
            if (updateResult.rowCount === 0) {
                throw new Error(`Failed to restore stock to batch ${usage.add_stock_id}`);
            }
            
            // MARK THIS USAGE AS RESTORED
            await SQLquery(
                `UPDATE Sales_Stock_Usage 
                 SET is_restored = true, restored_date = CURRENT_TIMESTAMP 
                 WHERE usage_id = $1`,
                [usage.usage_id]
            );
            
            console.log(`Restored ${usage.quantity_used} units to batch ${usage.add_stock_id} from sale ${salesInformationId} (${reason})`);
        }
        
        await SQLquery('COMMIT');

        const restoredProductIds = [...new Set(stockUsage.map((usage) => usage.product_id))];

        for (const productId of restoredProductIds) {
            await checkAndHandleLowStock(productId, branchId, {
                triggeredByUserId: userID,
            });
        }

        // BROADCAST VALIDITY UPDATE FOR PRODUCT VALIDITY PAGE REFRESH
        if (stockUsage.length > 0) {
            broadcastValidityUpdate(branchId, {
                action: 'stock_restored',
                sale_id: salesInformationId,
                restored_products: stockUsage.map(usage => ({
                    product_id: usage.product_id,
                    quantity_restored: usage.quantity_used
                })),
                reason: reason,
                user_id: userID || null
            });
        }

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
        return { success: true, message: `Sale ${salesInformationId} canceled and stock restored` };
        
    } catch (error) {
        await SQLquery('ROLLBACK');
        throw error;
    }
};