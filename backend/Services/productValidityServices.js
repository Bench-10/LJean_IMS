import { SQLquery } from "../db.js";
import { correctDateFormat } from "./Services_Utils/convertRedableDate.js"



//GET PRODUCT VALIDITY LIST
export const getProductValidity = async() =>{
    const { rows } =  await SQLquery(`
            SELECT ${correctDateFormat('date_added')}, ${correctDateFormat('product_validity')}, Inventory_product.product_name, Category.category_name, quantity_added, (product_validity - CURRENT_DATE) <= 3 AS near_expy, product_validity <= CURRENT_DATE AS expy, Add_stocks.product_id, branch_id, product_validity
            FROM Add_Stocks
            LEFT JOIN Inventory_product USING(product_id)
            LEFT JOIN Category USING(category_id)
            WHERE product_validity >= CURRENT_DATE - 2
            ORDER BY date_added DESC, add_id DESC
    `);

    //LOOP THROUGH THE ROWS 
    for (const row of rows){
        //IF THE ROW IS EXPIRED
        if (row.expy){
            // CHECK IF THE PRODUCT EXPIRED IS ALREADY NOTIFIED
            const existing = await SQLquery(
                `SELECT 1
                FROM Inventory_alerts 
                WHERE product_id = $1 
                AND alert_type = $2
                AND DATE(alert_date) BETWEEN ($3::date) AND ($3::date + INTERVAL '3 days')`,
                [row.product_id, 'Expired', row.product_validity]
            );

            //IF THERE IS NOTHING EXISTING IN THE NOTIFICATION THEN IT ADDS A NEW NOTIFICATION
            if (existing.rowCount === 0){
                await SQLquery(
                    `INSERT INTO Inventory_Alerts 
                    (product_id, branch_id, alert_type, message, banner_color)
                    VALUES ($1, $2, $3, $4, $5)
                    RETURNING *`,
                    [row.product_id, row.branch_id,'Expired',`${row.product_name}`, 'red']
                );
            };
        };

        
        //IF THE ROW IS NEAR THE END OF ITS SHELF LIFE
        if (row.near_expy && !row.expy){
            const existing = await SQLquery(
                `SELECT 1
                FROM Inventory_alerts 
                WHERE product_id = $1 
                AND alert_type = $2
                AND DATE(alert_date) BETWEEN ($3::date - INTERVAL '3 days') AND ($3::date) `,
                [row.product_id, 'Near Expired', row.product_validity]
            );


            if (existing.rowCount === 0){
                await SQLquery(
                    `INSERT INTO Inventory_Alerts 
                    (product_id, branch_id, alert_type, message, banner_color)
                    VALUES ($1, $2, $3, $4, $5)
                    RETURNING *`,
                    [row.product_id, row.branch_id, 'Near Expired',`${row.product_name}`, 'yellow']
                );
            };
        }
    };

    return rows;

};