import { SQLquery } from '../../db.js';




export const numberOfDelivery = async (dateFormat, branch_id) => {


    let filterFormat;

    if (dateFormat === 'monthly') {

        filterFormat = "TO_CHAR(delivered_date, 'Mon YYYY') AS date";

    } else if (dateFormat === 'yearly') {

        filterFormat = "TO_CHAR(delivered_date, 'YYYY') AS date";

    } else {

        filterFormat = "TO_CHAR(delivered_date, 'DD Mon YYYY') AS date";
    }

    const {rows: deliveryData} = await SQLquery(

        `SELECT ${filterFormat}, COUNT(delivered_date) AS number_of_deliveries 
         FROM Delivery
         WHERE branch_id = $1 AND (is_delivered = true AND is_pending = false)
         GROUP BY date;`,
         [branch_id]

    );

    return deliveryData;
};