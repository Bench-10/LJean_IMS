import { SQLquery } from '../../db.js';

export const numberOfDelivery = async (dateFormat, branch_id, start_date, end_date, status = 'delivered') => {
    const statusValue = String(status).toLowerCase();
    const isUndelivered = statusValue === 'undelivered';

    const referenceDateExpr = isUndelivered
        ? "COALESCE(s.date, CURRENT_DATE)"
        : 'd.delivered_date';

        let bucketExpression;
        let labelProjection;

        switch (dateFormat) {
            case 'yearly':
                bucketExpression = `DATE_TRUNC('year', ${referenceDateExpr})`;
                labelProjection = `TO_CHAR(bucket, 'YYYY')`;
                break;
            case 'monthly':
                bucketExpression = `DATE_TRUNC('month', ${referenceDateExpr})`;
                labelProjection = `TO_CHAR(bucket, 'Mon YYYY')`;
                break;
            default:
                bucketExpression = `${referenceDateExpr}`;
                labelProjection = `TO_CHAR(bucket, 'DD Mon YYYY')`;
                break;
        }

    const filters = [];
    const params = [];
    let paramIndex = 1;

    if (branch_id) {
        filters.push(`d.branch_id = $${paramIndex++}`);
        params.push(branch_id);
    }

            filters.push(
                isUndelivered
                    ? '(d.is_delivered = false)'
                    : '(d.is_delivered = true)'
            );

            filters.push(`${referenceDateExpr} IS NOT NULL`);

    if (start_date && end_date) {
        filters.push(`${referenceDateExpr} BETWEEN $${paramIndex} AND $${paramIndex + 1}`);
        params.push(start_date, end_date);
        paramIndex += 2;
    }

    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

        const query = `
            SELECT ${labelProjection} AS date, COUNT(*)::int AS number_of_deliveries
            FROM (
                SELECT ${bucketExpression} AS bucket
                FROM Delivery d
                INNER JOIN Sales_Information s ON s.sales_information_id = d.sales_information_id
                ${whereClause}
            ) buckets
            GROUP BY bucket
            ORDER BY bucket;
        `;

    const { rows } = await SQLquery(query, params);
    return rows;
};