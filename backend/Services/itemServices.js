import { SQLquery } from "../db.js";


//INVENTORY SERVICES
const getUpdatedInventoryList =  async (productId) => {
   const { rows } = await SQLquery(
        `SELECT product_id, Category.category_id, Category.category_name, product_name, unit, unit_price, unit_cost, quantity, threshold 
         FROM inventory_product
         LEFT JOIN Category USING(category_id)
         WHERE product_id = $1`,
        [productId]
    );

    return rows[0];
};



export const getProductItems = async() => {
    const {rows} = await SQLquery(`
        SELECT product_id, Category.category_id, Category.category_name, product_name, unit, unit_price, unit_cost, quantity, threshold FROM inventory_product
        LEFT JOIN Category USING(category_id)
        ORDER BY inventory_product ASC
    `);

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

    const newProductRow = await getUpdatedInventoryList(addedProductId);

    return newProductRow;
};



export const updateProductItem = async (productData, itemId) => {
    const { product_name, category_id, unit, unit_price, unit_cost, quantity_added, threshold, date_added, product_validity } = productData;

    await SQLquery('BEGIN');

    const returnPreviousQuantity = await SQLquery('SELECT quantity FROM Inventory_Product WHERE product_id = $1', [itemId]
    );


    const previousQuantity = returnPreviousQuantity.rows[0].quantity;

    const returnCurrentQuantity = await SQLquery(
        `UPDATE Inventory_Product SET 
        category_id = $1, product_name = $2, unit = $3, unit_price = $4, unit_cost = $5, quantity = $6, threshold = $7 
        WHERE product_id = $8
        RETURNING *`,
        [category_id, product_name, unit, unit_price, unit_cost, quantity_added, threshold, itemId]
    );


    const currentQuantity = returnCurrentQuantity.rows[0].quantity;

    if (currentQuantity !== previousQuantity){
        
       const quantityDifference = currentQuantity - previousQuantity;

       await SQLquery(
        `INSERT INTO Add_Stocks 
        (product_id, quantity_added, date_added, product_validity)
        VALUES ($1, $2, $3, $4)
        RETURNING *`,
        [itemId, quantityDifference, date_added, product_validity]
    );
    }

    await SQLquery('COMMIT');

    const updatedProductRow = await getUpdatedInventoryList(itemId);

    return  updatedProductRow;
};



export const searchProductItem = async (searchItem) =>{
    const {rows} = await SQLquery('SELECT * FROM Inventory_Product WHERE product_name ILIKE $1', [`%${searchItem}%`]);

    return rows;
};





//CATEGORIES SERVICES
export const getAllCategories = async () => {
    const { rows } = await SQLquery('SELECT * FROM Category ORDER BY category_id');
    return rows;
}



export const addListCategory = async (categoryData) => {
   const { category_name } = categoryData;

   const { rows } = await SQLquery('INSERT INTO Category (category_name) VALUES($1) RETURNING *', [category_name]);

   return rows[0];
}


export const updateListCategory = async (categoryData, categoryId) =>{
    const { category_name } = categoryData;

    const { rows } = await SQLquery('UPDATE Category SET category_name = $1 WHERE category_id = $2 RETURNING*', [category_name, categoryId])

    return rows[0]
}




