import { SQLquery } from "../../db.js";
import { correctDateFormat } from "../Services_Utils/convertRedableDate.js";



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


    

    return newData;

};


 
//SET DELIVERIES TO DELIVERED
export const setToDelivered  = async(saleID, update) =>{

    const {courierName, deliveredDate, status } = update;

    const {rows: updateDelivery} = await SQLquery(`
        UPDATE Delivery 
        SET courier_name = $1, delivered_date = $2, is_delivered = $3, is_pending = $4
        WHERE sales_information_id = $5 RETURNING *`,
        [courierName, deliveredDate, status.is_delivered, status.pending, saleID]
    );


    return updateDelivery[0]; 

};