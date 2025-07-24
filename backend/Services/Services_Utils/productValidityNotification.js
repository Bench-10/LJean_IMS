import { SQLquery } from "../../db.js";


//FUNCTION THAT AUTOMATICALLY GENERATE NOTIFICATION FOR PRODUCT SHELF LIFE
export const notifyProductShelfLife = async() =>{
    const { rows } =  await SQLquery(`
            SELECT Inventory_product.product_name, Category.category_name, (product_validity - CURRENT_DATE) <= 3 AS near_expy, product_validity <= CURRENT_DATE AS expy, Add_stocks.product_id, branch_id, product_validity
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

            //THIS CHECKS THE QUANTITY IF THERE ARE SAME PRODUCT ID WITH THE SAME DATE OF EXPIRY
            const quantityResult = await SQLquery(
                `SELECT SUM(quantity_added) AS total_quantity 
                FROM Add_stocks 
                WHERE product_validity = $1 AND product_id = $2`,
                [row.product_validity, row.product_id]
            );


            //NUMBER OF QUANTITY EXPIRED
            const totalQuantity = quantityResult.rows[0].total_quantity || 0;


            //EXPIRED NOTIFICATTION MESSAGE
            const notificationMessage = `${totalQuantity} of ${row.product_name} has reached the end of shelf life`;


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
                    [row.product_id, row.branch_id,'Expired',`${notificationMessage}`, 'red']
                );
            };
        };

        
        //IF THE ROW IS NEAR THE END OF ITS SHELF LIFE
        if (row.near_expy && !row.expy){


            //THIS CHECKS THE QUANTITY IF THERE ARE SAME PRODUCT ID WITH THE SAME DATE OF EXPIRY
            const quantityResult = await SQLquery(
                `SELECT SUM(quantity_added) AS total_quantity 
                FROM Add_stocks 
                WHERE product_validity = $1 AND product_id = $2`,
                [row.product_validity, row.product_id]
            );


            //NUMBER OF QUANTITY NEAR EXPIRY
            const totalQuantity = quantityResult.rows[0].total_quantity || 0;


            //EXPIRED NOTIFICATTION MESSAGE
            const notificationMessage = `${totalQuantity} of ${row.product_name} is reaching the end of shelf life`;


            const existing = await SQLquery(
                `SELECT 1
                FROM Inventory_alerts 
                WHERE product_id = $1 
                AND alert_type = $2
                AND DATE(alert_date) = ($3::date - INTERVAL '3 days')`,
                [row.product_id, 'Near Expired', row.product_validity]
            );


            if (existing.rowCount === 0){
                await SQLquery(
                    `INSERT INTO Inventory_Alerts 
                    (product_id, branch_id, alert_type, message, banner_color)
                    VALUES ($1, $2, $3, $4, $5)
                    RETURNING *`,
                    [row.product_id, row.branch_id, 'Near Expired',`${notificationMessage}`, 'yellow']
                );
            };
        };
    };
};










