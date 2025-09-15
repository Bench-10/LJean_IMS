import { SQLquery } from "../../db.js";
import { broadcastNotification } from "../../server.js";



//INVENTORY SERVICES
const getUpdatedInventoryList =  async (productId, branchId) => {
   const { rows } = await SQLquery(
        `SELECT product_id, branch_id, Category.category_id, Category.category_name, product_name, unit, unit_price, unit_cost, quantity, threshold 
         FROM inventory_product
         LEFT JOIN Category USING(category_id)
         WHERE product_id = $1 AND branch_id = $2`,
        [productId, branchId],
    );

    return rows[0];
};



export const getProductItems = async(branchId) => {

    if (!branchId){
        const {rows} = await SQLquery(`
            SELECT product_id, branch_id, Category.category_id, Category.category_name, product_name, unit, unit_price, unit_cost, quantity, threshold 
            FROM inventory_product
            LEFT JOIN Category USING(category_id)
            ORDER BY inventory_product.product_id ASC
        `);

        return rows;

    }; 


    const {rows} = await SQLquery(`
        SELECT product_id, branch_id, Category.category_id, Category.category_name, product_name, unit, unit_price, unit_cost, quantity, threshold 
        FROM inventory_product
        LEFT JOIN Category USING(category_id)
        WHERE branch_id = $1
        ORDER BY inventory_product.product_id ASC
    `,[branchId]);

    return rows;

};



export const addProductItem = async (productData) => {
    const { product_name, category_id, branch_id, unit, unit_price, unit_cost, quantity_added, threshold, date_added, product_validity, userID, fullName } = productData;

    const productAddedNotifheader = "New Product";
    const notifMessage = `${product_name} has been added to the inventory with ${quantity_added} ${unit}.`;
    const color = 'green';

    //CREATES A UNIQUE PRODUCT ID
    let product_id;
    let isUnique = false;
    while (!isUnique) {
        product_id = Math.floor(100000 + Math.random() * 900000); 
        const check = await SQLquery('SELECT 1 FROM Inventory_Product WHERE product_id = $1', [product_id]);
        if (check.rowCount === 0) isUnique = true;
    }

    await SQLquery('BEGIN');

    await SQLquery(
        `INSERT INTO Inventory_Product 
        (product_id, category_id, branch_id, product_name, unit, unit_price, unit_cost, quantity, threshold)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [product_id, category_id, branch_id, product_name, unit, unit_price, unit_cost, quantity_added, threshold]
    );   

    await SQLquery(
        `INSERT INTO Add_Stocks 
        (product_id, h_unit_price, h_unit_cost, quantity_added, date_added, product_validity)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *`,
        [product_id, unit_price, unit_cost, quantity_added, date_added, product_validity]
    );

    const alertResult = await SQLquery(
        `INSERT INTO Inventory_Alerts 
        (product_id, branch_id, alert_type, message, banner_color, user_id, user_full_name)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *`,
        [product_id, branch_id, productAddedNotifheader, notifMessage, color, userID, fullName]
    );

    // SENDS DATA TO ALL USERS IN THE BRANCH
    if (alertResult.rows[0]) {
        broadcastNotification(branch_id, {
            alert_id: alertResult.rows[0].alert_id,
            alert_type: productAddedNotifheader,
            message: notifMessage,
            banner_color: color,
            user_id: alertResult.rows[0].user_id,
            user_full_name: fullName,
            alert_date: alertResult.rows[0].alert_date,
            isDateToday: true,
            alert_date_formatted: 'Just now'
            
        });
    }

    await SQLquery('COMMIT');

    const newProductRow = await getUpdatedInventoryList(product_id, branch_id);

    return newProductRow;
};



export const updateProductItem = async (productData, itemId) => {
    const { product_name, branch_id, category_id, unit, unit_price, unit_cost, quantity_added, threshold, date_added, product_validity, userID, fullName } = productData;

    const addStocksQuery = async () =>{

        return await SQLquery(
            `INSERT INTO Add_Stocks 
            (product_id, h_unit_price, h_unit_cost, quantity_added, date_added, product_validity)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *`,
            [itemId, unit_price, unit_cost, quantity_added, date_added, product_validity]
        );

    }


    const previousData = await SQLquery('SELECT branch_id, quantity, unit_price, unit_cost FROM Inventory_Product WHERE product_id =   $1', [itemId]
    );


    const returnPreviousPrice = Number(previousData.rows[0].unit_price);
    const returnPreviousCost = Number(previousData.rows[0].unit_cost);
    const returnBranchId = Number(previousData.rows[0].branch_id);



    // PRODUCT UPDATE BANNER TITLE
    const productAddedNotifheader = "Product Update";

    // UPDATE MESSAGES
    const addqQunatityNotifMessage = `Additional ${quantity_added} ${unit} has been added to ${product_name} at a cost of ₱ ${unit_cost}.`;
    const changePriceNotifMessage = `The price of ${product_name} has been changed from ₱ ${returnPreviousPrice} to ₱ ${unit_price}.`

    // BANNER COLOR
    const color = 'blue';


    await SQLquery('BEGIN');


    await SQLquery(
        `UPDATE Inventory_Product SET 
        category_id = $1, product_name = $2, unit = $3, unit_price = $4, unit_cost = $5, quantity = quantity + $6, threshold = $7 
        WHERE product_id = $8
        RETURNING *`,
        [category_id, product_name, unit, unit_price, unit_cost, quantity_added, threshold, itemId]

    );


    if (quantity_added !== 0){

        await addStocksQuery();

        const alertResult = await SQLquery(
            `INSERT INTO Inventory_Alerts 
            (product_id, branch_id, alert_type, message, banner_color, user_id, user_full_name)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *`,
            [itemId, returnBranchId, productAddedNotifheader, addqQunatityNotifMessage, color, userID, fullName]
        );

        // SENDS DATA TO ALL USERS IN THE BRANCH
        if (alertResult.rows[0]) {
            broadcastNotification(returnBranchId, {
                alert_id: alertResult.rows[0].alert_id,
                alert_type: productAddedNotifheader,
                message: addqQunatityNotifMessage,
                banner_color: color,
                user_id: alertResult.rows[0].user_id,
                user_full_name: fullName,
                alert_date: alertResult.rows[0].alert_date,
                isDateToday: true,
                alert_date_formatted: 'Just now'
            });
        }

    }

    if (returnPreviousPrice !== unit_price){

        await addStocksQuery();

        const alertResult = await SQLquery(
            `INSERT INTO Inventory_Alerts 
            (product_id, branch_id, alert_type, message, banner_color, user_id, user_full_name)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *`,
            [itemId, returnBranchId, productAddedNotifheader, changePriceNotifMessage, color, userID, fullName]
        );

        // Broadcast the notification to all users in the branch
        if (alertResult.rows[0]) {
            broadcastNotification(returnBranchId, {
                alert_id: alertResult.rows[0].alert_id,
                alert_type: productAddedNotifheader,
                message: changePriceNotifMessage,
                banner_color: color,
                user_id: alertResult.rows[0].user_id,
                user_full_name: fullName,
                alert_date: alertResult.rows[0].alert_date,
                isDateToday: true,
                alert_date_formatted: 'Just now'
            });
        }

    }

   
   
    await SQLquery('COMMIT');

    const updatedProductRow = await getUpdatedInventoryList(itemId, branch_id);

    return  updatedProductRow;
};



export const searchProductItem = async (searchItem) =>{
    const {rows} = await SQLquery('SELECT * FROM Inventory_Product WHERE product_name ILIKE $1', [`%${searchItem}%`]);

    return rows;
};