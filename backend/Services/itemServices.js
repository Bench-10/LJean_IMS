import { SQLquery } from "../db.js";

export const getProductItems = async() => {
    const {rows} = await SQLquery('SELECT * FROM inventory_product');
    return rows;
};


export const addProductItem = async (productData) => {
    const { product_name, category_id, branch_id, unit, unit_price, unit_cost, quantity_added, threshold, date_added, product_validity } = productData;

    await SQLquery('BEGIN');

    const insertToInventoryProducts = await SQLquery(
        `INSERT INTO Inventory_Product 
        (category_id, branch_id, product_name, unit, unit_price, unit_cost, quantity, threshold)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [category_id, branch_id, product_name, unit, unit_price, unit_cost, quantity_added, threshold]
    );

    const addedProductId = insertToInventoryProducts.rows[0].product_id;

    await SQLquery(
        `INSERT INTO Add_Stocks 
        (product_id, quantity_added, date_added, product_validity)
        VALUES ($1, $2, $3, $4)
        RETURNING *`,
        [addedProductId, quantity_added, date_added, product_validity]
    );

    await SQLquery('COMMIT');
    return { success: true, productId: addedProductId };
};