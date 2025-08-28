import { SQLquery } from "../../db.js";
import { correctDateFormat } from "../Services_Utils/convertRedableDate.js";



//GET DELIVARY DATA
export const getDeliveryData = async() =>{
    const {rows: delivery} = await SQLquery(`SELECT delivery_id, sales_information_id, branch_id, destination_address, ${correctDateFormat("delivered_date")}, courier_name, is_delivered FROM Delivery ORDER BY delivered_date`);

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
            is_delivered)

            VALUES($1, $2, $3, $4, $5, $6, $7) RETURNING *
        `, [delivery_id, salesId, currentBranch, address, deliveredDate, courierName, status]
    );


    

    return newData;

};


 
//SET DELIVERIES TO DELIVERED
export const setToDelivered  = async(saleID, update) =>{

    const {is_delivered} = update;

    await SQLquery('UPDATE Delivery SET is_delivered = $1 WHERE sales_information_id = $2 RETURNING*', [is_delivered, saleID]);

};