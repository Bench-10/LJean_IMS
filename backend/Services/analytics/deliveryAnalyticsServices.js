import { SQLquery } from '../../db.js';

export const numberOfDelivery = async (dateFormat, branch_id, start_date, end_date, status = 'delivered', category_id = null) => {
    const statusValue = String(status).toLowerCase();
    const isUndelivered = statusValue === 'undelivered';

    const referenceDateExpr = 's.date';

    let bucketExpression;
    let labelFormat;
    let stepUnit;

    switch (dateFormat) {
        case 'yearly':
            bucketExpression = `DATE_TRUNC('year', ${referenceDateExpr})::date`;
            labelFormat = 'YYYY';
            stepUnit = 'year';
            break;
        case 'monthly':
            bucketExpression = `DATE_TRUNC('month', ${referenceDateExpr})::date`;
            labelFormat = 'YYYY-MM';
            stepUnit = 'month';
            break;
        default:
            bucketExpression = `DATE_TRUNC('day', ${referenceDateExpr})::date`;
            labelFormat = 'YYYY-MM-DD';
            stepUnit = 'day';
            break;
    }

    const baseConditions = [];
    const baseParams = [];
    let paramIndex = 1;

    if (branch_id) {
        baseConditions.push(`d.branch_id = $${paramIndex++}`);
        baseParams.push(branch_id);
    }

    baseConditions.push(
        isUndelivered
            ? '(d.is_delivered = false)'
            : '(d.is_delivered = true)'
    );

    baseConditions.push(`${referenceDateExpr} IS NOT NULL`);

    if (category_id) {
        baseConditions.push(`ip.category_id = $${paramIndex++}::int`);
        baseParams.push(category_id);
    }

    const filters = [...baseConditions];
    const params = [...baseParams];

    if (start_date && end_date) {
        filters.push(`${referenceDateExpr} BETWEEN $${paramIndex} AND $${paramIndex + 1}`);
        params.push(start_date, end_date);
        paramIndex += 2;
    }

    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    const joinClause = category_id ? `
        INNER JOIN sales_items si ON si.sales_information_id = s.sales_information_id
        INNER JOIN Inventory_Product ip ON ip.product_id = si.product_id AND ip.branch_id = si.branch_id
    ` : '';

    const query = `
        WITH buckets AS (
            SELECT ${bucketExpression} AS bucket, d.sales_information_id
            FROM Delivery d
            INNER JOIN Sales_Information s ON s.sales_information_id = d.sales_information_id
            ${joinClause}
            ${whereClause}
        )
        SELECT
            TO_CHAR(bucket, '${labelFormat}') AS date,
            COUNT(DISTINCT sales_information_id)::int AS number_of_deliveries
        FROM buckets
        GROUP BY bucket
        ORDER BY bucket;
    `;

    const { rows } = await SQLquery(query, params);

    const metaJoinClause = category_id ? `
        INNER JOIN sales_items si ON si.sales_information_id = s.sales_information_id
        INNER JOIN Inventory_Product ip ON ip.product_id = si.product_id AND ip.branch_id = si.branch_id
    ` : '';

    const metaQuery = `
        SELECT
            COALESCE(TO_CHAR(MIN(${bucketExpression}), '${labelFormat}'), NULL) AS min_bucket,
            COALESCE(TO_CHAR(MAX(${bucketExpression}), '${labelFormat}'), NULL) AS max_bucket,
            COALESCE(TO_CHAR(MIN(${referenceDateExpr})::date, 'YYYY-MM-DD'), NULL) AS min_reference,
            COALESCE(TO_CHAR(MAX(${referenceDateExpr})::date, 'YYYY-MM-DD'), NULL) AS max_reference
        FROM Delivery d
        INNER JOIN Sales_Information s ON s.sales_information_id = d.sales_information_id
        ${metaJoinClause}
        ${baseConditions.length ? `WHERE ${baseConditions.join(' AND ')}` : ''};
    `;

    const metaResult = await SQLquery(metaQuery, baseParams);
    const metaRow = metaResult.rows?.[0] ?? { min_bucket: null, max_bucket: null, min_reference: null, max_reference: null };

    return {
        data: rows,
        meta: {
            min_bucket: metaRow.min_bucket,
            max_bucket: metaRow.max_bucket,
            min_reference: metaRow.min_reference,
            max_reference: metaRow.max_reference,
            step: stepUnit
        }
    };
};