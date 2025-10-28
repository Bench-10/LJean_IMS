import { SQLquery } from "../../db.js";
import { correctDateFormat } from "../Services_Utils/convertRedableDate.js";
import { restoreStockFromSale, deductStockAndTrackUsage } from "../sale/saleServices.js";
import { broadcastInventoryUpdate, broadcastSaleUpdate, broadcastNotification, broadcastValidityUpdate } from "../../server.js";
import { createNewDeliveryNotification, createDeliveryStatusNotification, createDeliveryStockNotification } from "./deliveryNotificationService.js";



// GET DELIVERY DATA
export const getDeliveryData = async(branchId) =>{
    const {rows: delivery} = await SQLquery(`
        SELECT delivery_id, sales_information_id, branch_id, destination_address, ${correctDateFormat("delivered_date")}, courier_name, TO_CHAR(delivered_date, 'YYYY-MM-DD') AS delivered_date, is_delivered, is_pending
        FROM Delivery 
        WHERE branch_id = $1
        ORDER BY delivered_date DESC`,   
        [branchId]
    );

    return delivery;
};



// ADD DELIVERY DATA
export const addDeliveryData = async(data) =>{

    const {courierName, salesId, address, deliveredDate, currentBranch, status, userID, userFullName } = data;


    // CREATES A UNIQUE USER ID
    let delivery_id;
    let isUnique = false;
    while (!isUnique) {
        delivery_id = Math.floor(10000 + Math.random() * 90000); 
        const check = await SQLquery('SELECT 1 FROM Delivery WHERE delivery_id = $1', [delivery_id]);
        if (check.rowCount === 0) isUnique = true;
    }

    try {
        await SQLquery('BEGIN');

        const {rows: newData} = await SQLquery(
            `INSERT INTO Delivery(
                delivery_id, 
                sales_information_id, 
                branch_id, 
                destination_address, 
                delivered_date,
                courier_name,
                is_delivered,
                is_pending)
                VALUES($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *
            `, [delivery_id, salesId, currentBranch, address, deliveredDate, courierName, status.is_delivered, status.pending]
        );

    // STOCK WAS ALREADY DEDUCTED WHEN THE SALE WAS PLACED, SO NO ADDITIONAL DEDUCTION NEEDED
    // JUST LOG THE DELIVERY CREATION
        console.log(`Delivery record created for sale ID: ${salesId} with status: ${status.is_delivered ? 'delivered' : 'pending'}`);

        await SQLquery('COMMIT');

        // BROADCAST NEW DELIVERY UPDATE TO ALL USERS IN THE BRANCH
        const createdDelivery = newData[0];

        if (createdDelivery) {
            // GET UPDATED SALE DATA WITH DELIVERY INFO
            const {rows: saleWithDelivery} = await SQLquery(`
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
                    COALESCE(is_pending, false) AS is_pending
                FROM Sales_Information 
                LEFT JOIN Delivery 
                USING(sales_information_id)
                WHERE Sales_Information.sales_information_id = $1`,
                [salesId]
            );

            // BROADCAST SALE UPDATE (since delivery affects sales display)
            if (saleWithDelivery[0]) {
                broadcastSaleUpdate(currentBranch, {
                    action: 'delivery_added',
                    sale: saleWithDelivery[0],
                    delivery: createdDelivery,
                    user_id: userID || null
                });
            }

            // GET PROPERLY FORMATTED DELIVERY DATA FOR BROADCAST
            const {rows: formattedDeliveryData} = await SQLquery(`
                SELECT delivery_id, sales_information_id, branch_id, destination_address, 
                       ${correctDateFormat("delivered_date")}, 
                       courier_name, TO_CHAR(delivered_date, 'YYYY-MM-DD') AS delivered_date, 
                       is_delivered, is_pending
                FROM Delivery 
                WHERE delivery_id = $1`,   
                [createdDelivery.delivery_id]
            );

            // BROADCAST DELIVERY ADDITION WITH PROPERLY FORMATTED DATE
            if (formattedDeliveryData[0]) {
                broadcastSaleUpdate(currentBranch, {
                    action: 'add_delivery', 
                    delivery: formattedDeliveryData[0],
                    user_id: userID || null
                });
            }

            // CREATE NEW DELIVERY NOTIFICATION
            try {
                await createNewDeliveryNotification(salesId, createdDelivery.delivery_id, courierName, address, currentBranch, userID, userFullName);
            } catch (alertError) {
                console.error(`❌ Failed to create new delivery notification:`, alertError);
                // Continue with operation even if notification fails
            }
        }

        return newData;
        
    } catch (error) {
        console.error(`Error in addDeliveryData for sale ID ${salesId}:`, error.message);
        await SQLquery('ROLLBACK');
        throw error;
    }

    

};


 
// SET DELIVERIES TO DELIVERED/UNDELIVERED
export const setToDelivered = async(saleID, update) => {

    const {courierName, deliveredDate, status, userID, userFullName } = update;

    try {
        await SQLquery('BEGIN');

    // GET CURRENT DELIVERY STATUS BEFORE UPDATE TO KNOW WHAT CHANGED
        const {rows: currentStatus} = await SQLquery(
            `SELECT is_delivered, is_pending FROM Delivery WHERE sales_information_id = $1`,
            [saleID]
        );

        if (currentStatus.length === 0) {
            throw new Error(`No delivery record found for sale ID ${saleID}`);
        }

        const wasDelivered = currentStatus[0].is_delivered;
        const wasPending = currentStatus[0].is_pending;

    // UPDATE DELIVERY STATUS
        const {rows: updateDelivery} = await SQLquery(`
            UPDATE Delivery 
            SET courier_name = $1, delivered_date = $2, is_delivered = $3, is_pending = $4
            WHERE sales_information_id = $5 RETURNING *`,
            [courierName, deliveredDate, status.is_delivered, status.pending, saleID]
        );

    // HANDLE STOCK RESTORATION/DEDUCTION BASED ON STATUS CHANGES
        if (wasDelivered && !status.is_delivered && !status.pending) {

            // DELIVERED → UNDELIVERED (TRULY CANCELED) - RESTORE STOCK
            const {rows: branchInfo} = await SQLquery('SELECT branch_id FROM Sales_Information WHERE sales_information_id = $1', [saleID]);
            const branchId = branchInfo[0]?.branch_id;
            await restoreStockFromSale(saleID, 'Delivery marked as undelivered', branchId, userID);
            console.log(`Stock restored for sale ID: ${saleID} due to undelivered status`);
            
            // CREATE STOCK RESTORATION NOTIFICATION
            try {
                await createDeliveryStockNotification(saleID, 'stock_restored', branchId, userID, userFullName, updateDelivery[0]?.delivery_id ?? null);
            } catch (error) {
                console.error(`Failed to create stock restoration notification:`, error);
            }

        }
        else if (wasDelivered && !status.is_delivered && status.pending) {

            // DELIVERED > OUT FOR DELIVERY - DO NOT RESTORE STOCK (STILL ACTIVE DELIVERY)
            console.log(`Sale ID: ${saleID} changed from delivered to out for delivery (no stock changes - still active)`);

        }
        else if (!wasDelivered && !wasPending && status.pending) {

            // UNDELIVERED → OUT FOR DELIVERY - RE-DEDUCT STOCK (REACTIVATING CANCELED ORDER)
                const {rows: itemsToRededuct} = await SQLquery(`
                    SELECT 
                        product_id,
                        quantity_display AS quantity,
                        unit
                    FROM Sales_Items
                    WHERE sales_information_id = $1`,
                [saleID]
            );

            const {rows: branchInfo} = await SQLquery('SELECT branch_id FROM Sales_Information WHERE sales_information_id = $1', [saleID]);
            const branchId = branchInfo[0]?.branch_id;

            for (const product of itemsToRededuct) {
                    await deductStockAndTrackUsage(saleID, product.product_id, Number(product.quantity), branchId, userID, product.unit);
            }
            console.log(`Stock re-deducted for sale ID: ${saleID} due to reactivating delivery from undelivered to out for delivery`);

        }
        else if (!wasDelivered && !wasPending && !status.is_delivered && !status.pending) {

            // WAS UNDELIVERED, STILL UNDELIVERED - IF THIS IS FIRST TIME SETTING AS UNDELIVERED, RESTORE STOCK
            const {rows: stockUsage} = await SQLquery(`
                SELECT is_restored 
                FROM Sales_Stock_Usage 
                WHERE sales_information_id = $1 
                LIMIT 1`,
                [saleID]
            );

            // IF STOCK HASN'T BEEN RESTORED YET, RESTORE IT (FIRST TIME MARKING AS UNDELIVERED)
            if (stockUsage.length > 0 && stockUsage[0].is_restored === false) {
                const {rows: branchInfo} = await SQLquery('SELECT branch_id FROM Sales_Information WHERE sales_information_id = $1', [saleID]);
                const branchId = branchInfo[0]?.branch_id;
                await restoreStockFromSale(saleID, 'Delivery set as undelivered', branchId, userID);
                console.log(`Stock restored for sale ID: ${saleID} - first time marked as undelivered`);
            } else {
                console.log(`Sale ID: ${saleID} remains undelivered (stock already restored)`);
            }

        }
        else if (!wasDelivered && status.is_delivered) {

            // NOT DELIVERED > DELIVERED - CHECK IF STOCK NEEDS RE-DEDUCTION
            const {rows: stockUsage} = await SQLquery(`
                SELECT is_restored 
                FROM Sales_Stock_Usage 
                WHERE sales_information_id = $1 
                LIMIT 1`,
                [saleID]

            );

            // ONLY RE-DEDUCT IF STOCK WAS RESTORED DUE TO PREVIOUS UNDELIVERED STATUS
            if (stockUsage.length > 0 && stockUsage[0].is_restored === true) {
                const {rows: itemsToDeduct} = await SQLquery(`
                    SELECT 
                        product_id,
                        quantity_display AS quantity,
                        unit
                    FROM Sales_Items
                    WHERE sales_information_id = $1`,
                    [saleID]
                );

                const {rows: branchInfo} = await SQLquery('SELECT branch_id FROM Sales_Information WHERE sales_information_id = $1', [saleID]);
                const branchId = branchInfo[0]?.branch_id;

                for (const product of itemsToDeduct) {
                    await deductStockAndTrackUsage(saleID, product.product_id, Number(product.quantity), branchId, userID, product.unit);
                }
                console.log(`Stock re-deducted for sale ID: ${saleID} (was previously restored)`);
            } else {
                console.log(`Delivery confirmed for sale ID: ${saleID} (stock remained deducted - no double deduction)`);
            }

        }

        else if (wasPending && !status.is_delivered && !status.pending) {

            // OUT FOR DELIVERY > UNDELIVERED - RESTORE STOCK
            const {rows: branchInfo} = await SQLquery('SELECT branch_id FROM Sales_Information WHERE sales_information_id = $1', [saleID]);
            const branchId = branchInfo[0]?.branch_id;
            await restoreStockFromSale(saleID, 'Delivery canceled from pending status', branchId, userID);
            console.log(`Stock restored for sale ID: ${saleID} due to canceling pending delivery`);

        }
        else {

            console.log(`Delivery status updated for sale ID: ${saleID} (no stock changes needed)`);

        }

        // BROADCAST DELIVERY STATUS UPDATE
        const {rows: saleData} = await SQLquery(`
            SELECT 
                Sales_Information.sales_information_id, 
                Sales_Information.branch_id,  
                charge_to, 
                tin, 
                address, 
                date, 
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
            WHERE Sales_Information.sales_information_id = $1`,
            [saleID]
        );

            if (saleData[0]) {
            // BROADCAST SALE/DELIVERY UPDATE
            broadcastSaleUpdate(saleData[0].branch_id, {
                action: 'delivery_status_change',
                sale: saleData[0],
                previous_status: {
                    was_delivered: wasDelivered,
                    was_pending: wasPending
                },
                new_status: {
                    is_delivered: status.is_delivered,
                    is_pending: status.pending
                },
                user_id: userID || null
            });

            const deliveryIdentifier = updateDelivery[0]?.delivery_id ?? null;

            try {
                await createDeliveryStatusNotification(
                    saleID,
                    status,
                    courierName,
                    saleData[0].branch_id,
                    userID,
                    userFullName,
                    deliveryIdentifier
                );
            } catch (error) {
                console.error(`Failed to create delivery status notification:`, error);
            }

            // BROADCAST INVENTORY UPDATES IF STOCK WAS AFFECTED
            if ((wasDelivered && !status.is_delivered && !status.pending) || 
                (!wasDelivered && !wasPending && status.pending) ||
                (!wasDelivered && status.is_delivered) ||
                (wasPending && !status.is_delivered && !status.pending)) {
                
                // GET AFFECTED PRODUCTS AND BROADCAST INVENTORY UPDATES
                const {rows: affectedProducts} = await SQLquery(`
                    SELECT 
                        si.product_id,
                        si.quantity_display AS sold_quantity,
                        ip.branch_id,
                        ip.category_id,
                        c.category_name,
                        ip.product_name,
                        ip.unit,
                        ip.unit_price,
                        ip.unit_cost,
                        ip.min_threshold,
                        ip.max_threshold,
                        COALESCE(SUM(CASE WHEN ast.product_validity < NOW() THEN 0 ELSE ast.quantity_left_display END), 0) AS quantity
                    FROM Sales_Items si
                    JOIN Sales_Information s_info ON si.sales_information_id = s_info.sales_information_id
                    JOIN inventory_product ip ON si.product_id = ip.product_id AND s_info.branch_id = ip.branch_id
                    LEFT JOIN Category c USING(category_id)
                    LEFT JOIN Add_Stocks ast ON si.product_id = ast.product_id AND s_info.branch_id = ast.branch_id
                    WHERE si.sales_information_id = $1
                    GROUP BY 
                        si.product_id, si.quantity_display, ip.branch_id, ip.category_id, 
                        c.category_name, ip.product_name, ip.unit, ip.unit_price, 
                        ip.unit_cost, ip.min_threshold, ip.max_threshold`,
                    [saleID]
                );

                for (const product of affectedProducts) {
                    broadcastInventoryUpdate(saleData[0].branch_id, {
                        action: 'delivery_stock_change',
                        product: {
                            product_id: product.product_id,
                            branch_id: product.branch_id,
                            category_id: product.category_id,
                            category_name: product.category_name,
                            product_name: product.product_name,
                            unit: product.unit,
                            unit_price: product.unit_price,
                            unit_cost: product.unit_cost,
                            quantity: product.quantity,
                            min_threshold: product.min_threshold,
                            max_threshold: product.max_threshold
                        },
                        sale_id: saleID,
                        delivery_change: {
                            from: { delivered: wasDelivered, pending: wasPending },
                            to: { delivered: status.is_delivered, pending: status.pending }
                        },
                        user_id: userID || null
                    });
                }

                // BROADCAST VALIDITY UPDATE FOR PRODUCT VALIDITY PAGE REFRESH
                broadcastValidityUpdate(saleData[0].branch_id, {
                    action: 'inventory_changed_by_delivery',
                    sale_id: saleID,
                    delivery_status: {
                        from: { delivered: wasDelivered, pending: wasPending },
                        to: { delivered: status.is_delivered, pending: status.pending }
                    },
                    affected_products: affectedProducts.map(p => p.product_id),
                    user_id: userID || null
                });

            }
        }

        await SQLquery('COMMIT');
        return updateDelivery[0];

    } catch (error) {
        await SQLquery('ROLLBACK');
        console.error(`Error updating delivery status for sale ID ${saleID}:`, error.message);
        throw error;
    }

};