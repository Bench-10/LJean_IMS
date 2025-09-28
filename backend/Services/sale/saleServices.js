import { SQLquery } from "../../db.js";
import {correctDateFormat} from "../Services_Utils/convertRedableDate.js"



// VIEW SALE
export const viewSale = async (branchId) => {
   const { rows } = await SQLquery(`
    SELECT sales_information_id, branch_id, charge_to, tin, address, ${correctDateFormat('date')}, vat, amount_net_vat, total_amount_due, discount, transaction_by, delivery_fee, is_for_delivery
    FROM Sales_Information 
    WHERE branch_id = $1;`, [branchId]);
   
   return rows;
};



// VIEW A SPECIFIC SALE
export const viewSelectedItem = async (saleId) => {
   const { rows } = await SQLquery(`

        SELECT product_id, Inventory_Product.product_name,  Sales_Items.quantity, Sales_Items.unit, Sales_Items.unit_price, amount 
        FROM Sales_Items
        LEFT JOIN Inventory_Product USING(product_id)
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
                    'SELECT SUM(quantity_left) as available_quantity FROM Add_Stocks WHERE product_id = $1 AND quantity_left > 0',
                    [product.product_id]
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
            const baseIndex = i * 6;
            placeholders.push(`($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}, $${baseIndex + 6})`);
            values.push(sale_id, p.product_id, p.quantity, p.unit, p.unitPrice, p.amount );
            });

            const query = `INSERT INTO Sales_Items(sales_information_id, product_id, quantity, unit, unit_price, amount) VALUES ${placeholders.join(', ')}`;
            await SQLquery(query, values);

        // FIFO STOCK DEDUCTION WITH DEADLOCK PREVENTION
        // ALWAYS DEDUCT STOCK IMMEDIATELY WHEN SALE IS PLACED (REGARDLESS OF DELIVERY STATUS)
        // THIS PREVENTS PHANTOM INVENTORY WHERE PENDING ORDERS DON'T REFLECT IN AVAILABLE STOCK
            for (const product of productRow) {
                await deductStockAndTrackUsage(sale_id, product.product_id, Number(product.quantity));
            }
        };


        await SQLquery('COMMIT');


        const {rows} = await SQLquery(`
            SELECT sales_information_id, branch_id, charge_to, tin, address, ${correctDateFormat('date')}, vat, amount_net_vat, total_amount_due, discount, transaction_by, delivery_fee, is_for_delivery
            FROM Sales_Information 
            WHERE branch_id = $1 AND sales_information_id = $2;`
        , [branch_id, sale_id]);

        return rows[0];

    } catch (error) {

        await SQLquery('ROLLBACK');
        throw error;
    }

};


// DEDUCT STOCK AND TRACK WHICH BATCHES WERE USED
// THIS ALLOWS US TO RESTORE STOCK TO EXACT SAME BATCHES IF ORDER IS CANCELED
export const deductStockAndTrackUsage = async (salesInformationId, productId, quantityToDeduct) => {
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
         WHERE product_id = $1 AND quantity_left > 0 AND product_validity > CURRENT_DATE
         ORDER BY date_added ASC, product_validity ASC
         FOR UPDATE SKIP LOCKED`,
        [productId]
    );

    // IF NO UNLOCKED BATCHES AVAILABLE, WAIT AND RETRY
    if (batches.rowCount === 0) {
    // FALLBACK: TRY REGULAR FOR UPDATE (WILL WAIT FOR LOCKS)
        const lockedBatches = await SQLquery(
            `SELECT add_id, quantity_left 
             FROM Add_Stocks 
             WHERE product_id = $1 AND quantity_left > 0 AND product_validity > CURRENT_DATE
             ORDER BY date_added ASC, product_validity ASC
             FOR UPDATE`,
            [productId]
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
            `INSERT INTO Sales_Stock_Usage (sales_information_id, product_id, add_stock_id, quantity_used) 
            VALUES ($1, $2, $3, $4)`,
            [salesInformationId, productId, batch.add_id, deductFromThisBatch]
        );

        remainingToDeduct -= deductFromThisBatch;
        
        console.log(`Deducted ${deductFromThisBatch} units from batch ${batch.add_id} for sale ${salesInformationId}`);
    }

    // CHECK IF ALL QUANTITY WAS DEDUCTED
    if (remainingToDeduct > 0) {
        throw new Error(`Unable to deduct full quantity for product ID ${productId}. Remaining: ${remainingToDeduct}`);
    }
};


// RESTORE STOCK TO ORIGINAL BATCHES WHEN ORDER IS CANCELED/UNDELIVERED
export const restoreStockFromSale = async (salesInformationId, reason = 'Order canceled') => {
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
        
    // CHECK IF SALE EXISTS AND GET ITS CURRENT STATUS
        const {rows: saleInfo} = await SQLquery(
            'SELECT sales_information_id, is_for_delivery FROM Sales_Information WHERE sales_information_id = $1',
            [salesInformationId]
        );
        
        if (saleInfo.length === 0) {
            throw new Error(`Sale with ID ${salesInformationId} not found`);
        }
        
    // RESTORE STOCK TO ORIGINAL BATCHES
        await restoreStockFromSale(salesInformationId, reason);
        
    // OPTIONAL: MARK SALE AS CANCELED (YOU MIGHT WANT TO ADD A STATUS COLUMN)
        // await SQLquery('UPDATE Sales_Information SET status = $1 WHERE sales_information_id = $2', ['canceled', salesInformationId]);
        
        await SQLquery('COMMIT');
        return { success: true, message: `Sale ${salesInformationId} canceled and stock restored` };
        
    } catch (error) {
        await SQLquery('ROLLBACK');
        throw error;
    }
};