import { SQLquery } from '../../db.js';




export const numberOfDelivery = async (dateFormat, branch_id, start_date, end_date, status = 'delivered') => {


    let filterFormat;
    let dateFilter = '';
    let params = [branch_id];

    const statusFilter = (String(status).toLowerCase() === 'undelivered')
        ? '(is_delivered = false AND is_pending = true)'
        : '(is_delivered = true AND is_pending = false)';

    if (dateFormat === 'monthly') {

        filterFormat = "TO_CHAR(delivered_date, 'Mon YYYY') AS date";

    } else if (dateFormat === 'yearly') {

        filterFormat = "TO_CHAR(delivered_date, 'YYYY') AS date";

    } else {

        filterFormat = "TO_CHAR(delivered_date, 'DD Mon YYYY') AS date";
    }

    // Add date range filter if provided
    if (start_date && end_date) {
        dateFilter = ' AND delivered_date BETWEEN $2 AND $3';
        params = [branch_id, start_date, end_date];
    }

    const {rows: deliveryData} = await SQLquery(

        `SELECT ${filterFormat}, COUNT(delivered_date) AS number_of_deliveries 
         FROM Delivery
         WHERE branch_id = $1 AND ${statusFilter}${dateFilter}
         GROUP BY date
         ORDER BY MIN(delivered_date);`,
         params

    );

    return deliveryData;
};