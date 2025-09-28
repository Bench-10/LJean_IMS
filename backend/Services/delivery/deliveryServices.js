import { SQLquery } from "../../db.js";
import { correctDateFormat } from "../Services_Utils/convertRedableDate.js";
import { restoreStockFromSale, deductStockAndTrackUsage } from "../sale/saleServices.js";



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

    const {courierName, salesId, address, deliveredDate, currentBranch, status } = data;


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
        return newData;
        
    } catch (error) {
        console.error(`Error in addDeliveryData for sale ID ${salesId}:`, error.message);
        await SQLquery('ROLLBACK');
        throw error;
    }

    

};


 
// SET DELIVERIES TO DELIVERED/UNDELIVERED
export const setToDelivered = async(saleID, update) => {

    const {courierName, deliveredDate, status } = update;

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
            await restoreStockFromSale(saleID, 'Delivery marked as undelivered');
            console.log(`Stock restored for sale ID: ${saleID} due to undelivered status`);

        }
        else if (wasDelivered && !status.is_delivered && status.pending) {

            // DELIVERED > OUT FOR DELIVERY - DO NOT RESTORE STOCK (STILL ACTIVE DELIVERY)
            console.log(`Sale ID: ${saleID} changed from delivered to out for delivery (no stock changes - still active)`);

        }
        else if (!wasDelivered && !wasPending && status.pending) {

            // UNDELIVERED → OUT FOR DELIVERY - RESTORE STOCK (REACTIVATING CANCELED ORDER)
            await restoreStockFromSale(saleID, 'Order reactivated for delivery');
            console.log(`Stock restored for sale ID: ${saleID} due to reactivating delivery`);

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
                await restoreStockFromSale(saleID, 'Delivery set as undelivered');
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
                        quantity
                    FROM Sales_Items
                    WHERE sales_information_id = $1`,
                    [saleID]
                );

                for (const product of itemsToDeduct) {
                    await deductStockAndTrackUsage(saleID, product.product_id, Number(product.quantity));
                }
                console.log(`Stock re-deducted for sale ID: ${saleID} (was previously restored)`);
            } else {
                console.log(`Delivery confirmed for sale ID: ${saleID} (stock remained deducted - no double deduction)`);
            }

        }

        else if (wasPending && !status.is_delivered && !status.pending) {

            // OUT FOR DELIVERY > UNDELIVERED - RESTORE STOCK
            await restoreStockFromSale(saleID, 'Delivery canceled from pending status');
            console.log(`Stock restored for sale ID: ${saleID} due to canceling pending delivery`);

        }
        else {

            console.log(`Delivery status updated for sale ID: ${saleID} (no stock changes needed)`);

        }

        await SQLquery('COMMIT');
        return updateDelivery[0];

    } catch (error) {
        await SQLquery('ROLLBACK');
        console.error(`Error updating delivery status for sale ID ${saleID}:`, error.message);
        throw error;
    }

};