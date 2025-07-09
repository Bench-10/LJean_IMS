import { SQLquery } from "../../db";

export const validityExpiration = async() =>{
    const { rows } =  await SQLquery(`
            SELECT Inventory_product.product_name, quantity_added, (product_validity - CURRENT_DATE) <= 3 AS near_expy, product_validity <= CURRENT_DATE AS expy, Add_stocks.product_id, branch_id, product_validity
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
                AND DATE(alert_date) = $2`,
                [row.product_id, row.product_validity]
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


        if (row.near_expy){
            
        }
    };

    

    return rows;

};