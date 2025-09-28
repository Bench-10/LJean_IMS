import { SQLquery } from "../../db.js";
import { correctDateFormat } from "../Services_Utils/convertRedableDate.js";
import { confirmDeliveryAndDeductStock } from "../sale/saleServices.js";



//GET DELIVARY DATA
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



//GET DELIVARY DATA
export const addDeliveryData = async(data) =>{

    const {courierName, salesId, address, deliveredDate, currentBranch, status } = data;


    //CREATES A UNIQUE USER ID
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

        // If delivery is marked as delivered when first created, deduct stock immediately
        if (status.is_delivered) {
            console.log(`Delivery marked as delivered immediately for sale ID: ${salesId}, deducting stock`);
            await confirmDeliveryAndDeductStock(salesId);
            console.log(`Stock deducted for sale ID: ${salesId} upon delivery confirmation`);
        }

        await SQLquery('COMMIT');
        return newData;
        
    } catch (error) {
        console.error(`Error in addDeliveryData for sale ID ${salesId}:`, error.message);
        await SQLquery('ROLLBACK');
        throw error; // Important: re-throw the error so it's not silent
    }

    

};


 
//SET DELIVERIES TO DELIVERED
export const setToDelivered  = async(saleID, update) =>{

    const {courierName, deliveredDate, status } = update;

    try {
        await SQLquery('BEGIN');

        // Update delivery status
        const {rows: updateDelivery} = await SQLquery(`
            UPDATE Delivery 
            SET courier_name = $1, delivered_date = $2, is_delivered = $3, is_pending = $4
            WHERE sales_information_id = $5 RETURNING *`,
            [courierName, deliveredDate, status.is_delivered, status.pending, saleID]
        );

        // If delivery is confirmed (is_delivered = true), deduct stock from inventory
        if (status.is_delivered) {
            await confirmDeliveryAndDeductStock(saleID);
            console.log(`Stock deducted for sale ID: ${saleID} upon delivery confirmation`);
        }

        await SQLquery('COMMIT');
        return updateDelivery[0];

    } catch (error) {
        await SQLquery('ROLLBACK');
        throw error;
    }

};