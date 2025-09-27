import { SQLquery } from "../../db.js";
import { broadcastNotification } from "../../server.js";


//FUNCTION THAT AUTOMATICALLY GENERATE NOTIFICATION FOR PRODUCT SHELF LIFE
export const notifyProductShelfLife = async() =>{
    const { rows } =  await SQLquery(`
            SELECT 
                ip.product_name, 
                c.category_name, 
                (a.product_validity - CURRENT_DATE) <= 3 AS near_expy, 
                a.product_validity <= CURRENT_DATE AS expy, 
                a.product_id, 
                ip.branch_id, 
                a.product_validity,
                SUM(a.quantity_left) AS total_quantity
            FROM Add_Stocks a
            LEFT JOIN Inventory_product ip USING(product_id)
            LEFT JOIN Category c USING(category_id)
            WHERE a.product_validity >= CURRENT_DATE - 2
            GROUP BY a.product_id, ip.branch_id, a.product_validity, ip.product_name, c.category_name
            ORDER BY a.product_validity DESC
    `);

    //LOOP THROUGH THE ROWS 
    for (const row of rows){
        //IF THE ROW IS EXPIRED
        if (row.expy){
            //NUMBER OF QUANTITY EXPIRED (already calculated in the query)
            const totalQuantity = row.total_quantity || 0;

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
                const alertResult = await SQLquery(
                    `INSERT INTO Inventory_Alerts 
                    (product_id, branch_id, alert_type, message, banner_color, user_id, user_full_name)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                    RETURNING *`,
                    [row.product_id, row.branch_id,'Expired',`${notificationMessage}`, 'red', 0 , 'System']
                );

                // SENDS DATA TO ALL USERS IN THE BRANCH
                if (alertResult.rows[0]) {
                    broadcastNotification(row.branch_id, {
                        alert_id: alertResult.rows[0].alert_id,
                        alert_type: 'Expired',
                        message: notificationMessage,
                        banner_color: 'red',
                        user_id: alertResult.rows[0].user_id,
                        user_full_name: 'System',
                        alert_date: alertResult.rows[0].alert_date,
                        isDateToday: true,
                        alert_date_formatted: 'Just now'
                    });
                }
            };
        };

        
        //IF THE ROW IS NEAR THE END OF ITS SHELF LIFE
        if (row.near_expy && !row.expy){
            //NUMBER OF QUANTITY NEAR EXPIRY (already calculated in the query)
            const totalQuantity = row.total_quantity || 0;

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
                const alertResult = await SQLquery(
                    `INSERT INTO Inventory_Alerts 
                    (product_id, branch_id, alert_type, message, banner_color, user_id, user_full_name)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                    RETURNING *`,
                    [row.product_id, row.branch_id, 'Near Expired',`${notificationMessage}`, 'yellow', 0, 'System']
                );

                // SENDS DATA TO ALL USERS IN THE BRANCH
                if (alertResult.rows[0]) {
                    broadcastNotification(row.branch_id, {
                        alert_id: alertResult.rows[0].alert_id,
                        alert_type: 'Near Expired',
                        message: notificationMessage,
                        banner_color: 'yellow',
                        user_id: alertResult.rows[0].user_id,
                        user_full_name: 'System',
                        alert_date: alertResult.rows[0].alert_date,
                        isDateToday: true,
                        alert_date_formatted: 'Just now'
                    });
                }
            };
        };
    };
};










