import { SQLquery } from "../../db.js";
import {correctDateFormat} from "../Services_Utils/convertRedableDate.js"



//VIEW SALE
export const viewSale = async (branchId) => {
   const { rows } = await SQLquery(`
    SELECT sales_information_id, branch_id, charge_to, tin, address, ${correctDateFormat('date')}, vat, amount_net_vat, total_amount_due, discount, transaction_by, delivery_fee, is_for_delivery
    FROM Sales_Information 
    WHERE branch_id = $1;`, [branchId]);
   
   return rows;
};



//VIEW A SPECIFIC SALE
export const viewSelectedItem = async (saleId) => {
   const { rows } = await SQLquery(`

        SELECT product_id, Inventory_Product.product_name,  Sales_Items.quantity, Sales_Items.unit, Sales_Items.unit_price, amount 
        FROM Sales_Items
        LEFT JOIN Inventory_Product USING(product_id)
        WHERE sales_information_id = $1;`
    
    , [saleId]);
   
   return rows;
};



//ADD SALE
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

        //CHECK DATABASE AGAIN FOR IF AVAILABLE QUANTITY IS ENOUGH (inside transaction)
        if (productRow && productRow.length > 0) {
            for (const product of productRow) {
                // Check available quantity without FOR UPDATE on aggregate
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
            // Only deduct stock if NOT for delivery (immediate sale)
            if (!isForDelivery) {
                for (const product of productRow) {
                    let remainingToDeduct = Number(product.quantity);
                    
                    // Use SKIP LOCKED to prevent deadlocks in high-concurrency scenarios
                    const batches = await SQLquery(
                        `SELECT add_id, quantity_left 
                         FROM Add_Stocks 
                         WHERE product_id = $1 AND quantity_left > 0 AND product_validity > CURRENT_DATE
                         ORDER BY date_added ASC, product_validity ASC
                         FOR UPDATE SKIP LOCKED`,
                        [product.product_id]
                    );

                    // If no unlocked batches available, wait and retry
                    if (batches.rowCount === 0) {
                        // Fallback: try regular FOR UPDATE (will wait for locks)
                        const lockedBatches = await SQLquery(
                            `SELECT add_id, quantity_left 
                             FROM Add_Stocks 
                             WHERE product_id = $1 AND quantity_left > 0 AND product_validity > CURRENT_DATE
                             ORDER BY date_added ASC, product_validity ASC
                             FOR UPDATE`,
                            [product.product_id]
                        );
                        
                        if (lockedBatches.rowCount === 0) {
                            throw new Error(`No available stock for product ID ${product.product_id}`);
                        }
                        
                        // Use locked batches if skip locked returned nothing
                        batches.rows = lockedBatches.rows;
                    }

                    for (const batch of batches.rows) {
                        if (remainingToDeduct <= 0) break;

                        const batchQuantity = Number(batch.quantity_left);
                        const deductFromThisBatch = Math.min(remainingToDeduct, batchQuantity);
                        const newQuantityLeft = batchQuantity - deductFromThisBatch;

                        //ATOMIC UPDATE WITH VERSION CHECK
                        const updateResult = await SQLquery(
                            'UPDATE Add_Stocks SET quantity_left = $1 WHERE add_id = $2 AND quantity_left = $3',
                            [newQuantityLeft, batch.add_id, batchQuantity]
                        );

                        // If update failed (quantity changed by another transaction)
                        if (updateResult.rowCount === 0) {
                            throw new Error(`Concurrent modification detected for batch ${batch.add_id}. Please retry the transaction.`);
                        }

                        remainingToDeduct -= deductFromThisBatch;
                    }

                    // CHECK IF ALL QUANTITY OF PRODUCTS IS 0
                    if (remainingToDeduct > 0) {
                        throw new Error(`Unable to deduct full quantity for product ID ${product.product_id}. Remaining: ${remainingToDeduct}`);
                    }
                }
            } else {
                // For delivery sales, we just verify stock availability but don't deduct yet
                console.log('Sale is for delivery - stock will be deducted when delivery is confirmed');
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


// DEDUCT STOCK WHEN DELIVERY IS CONFIRMED
export const confirmDeliveryAndDeductStock = async (salesInformationId) => {
    try {
        await SQLquery('BEGIN');
        
        // Get the sale items for this sale
        const { rows: saleItems } = await SQLquery(`
            SELECT product_id, quantity 
            FROM Sales_Items 
            WHERE sales_information_id = $1`,
            [salesInformationId]
        );
        
        if (saleItems.length === 0) {
            throw new Error(`No sale items found for sale ID ${salesInformationId}`);
        }
        
        // FIFO STOCK DEDUCTION FOR EACH PRODUCT
        for (const product of saleItems) {
            let remainingToDeduct = Number(product.quantity);
            
            // Use SKIP LOCKED to prevent deadlocks
            const batches = await SQLquery(
                `SELECT add_id, quantity_left 
                 FROM Add_Stocks 
                 WHERE product_id = $1 AND quantity_left > 0 AND product_validity > CURRENT_DATE
                 ORDER BY date_added ASC, product_validity ASC
                 FOR UPDATE SKIP LOCKED`,
                [product.product_id]
            );

            // If no unlocked batches available, try regular FOR UPDATE
            if (batches.rowCount === 0) {
                const lockedBatches = await SQLquery(
                    `SELECT add_id, quantity_left 
                     FROM Add_Stocks 
                     WHERE product_id = $1 AND quantity_left > 0 AND product_validity > CURRENT_DATE
                     ORDER BY date_added ASC, product_validity ASC
                     FOR UPDATE`,
                    [product.product_id]
                );
                
                if (lockedBatches.rowCount === 0) {
                    throw new Error(`No available stock for product ID ${product.product_id}`);
                }
                
                batches.rows = lockedBatches.rows;
            }

            // Deduct from each batch using FIFO
            for (const batch of batches.rows) {
                if (remainingToDeduct <= 0) break;

                const batchQuantity = Number(batch.quantity_left);
                const deductFromThisBatch = Math.min(remainingToDeduct, batchQuantity);
                const newQuantityLeft = batchQuantity - deductFromThisBatch;

                // Atomic update with version check
                const updateResult = await SQLquery(
                    'UPDATE Add_Stocks SET quantity_left = $1 WHERE add_id = $2 AND quantity_left = $3',
                    [newQuantityLeft, batch.add_id, batchQuantity]
                );

                if (updateResult.rowCount === 0) {
                    throw new Error(`Concurrent modification detected for batch ${batch.add_id}. Please retry.`);
                }

                remainingToDeduct -= deductFromThisBatch;
            }

            // Check if all quantity was deducted
            if (remainingToDeduct > 0) {
                throw new Error(`Unable to deduct full quantity for product ID ${product.product_id}. Remaining: ${remainingToDeduct}`);
            }
        }
        
        await SQLquery('COMMIT');
        return { success: true, message: 'Stock deducted successfully' };
        
    } catch (error) {
        await SQLquery('ROLLBACK');
        throw error;
    }
};