import { SQLquery } from "../../db.js";
import { broadcastNotification, broadcastInventoryUpdate, broadcastValidityUpdate, broadcastHistoryUpdate } from "../../server.js";
import { checkAndHandleLowStock } from "../Services_Utils/lowStockNotification.js";

//HELPER FUNCTION TO GET CATEGORY NAME
const getCategoryName = async (categoryId) => {
    const { rows } = await SQLquery('SELECT category_name FROM Category WHERE category_id = $1', [categoryId]);
    return rows[0]?.category_name || '';
};



//INVENTORY SERVICES
const getUpdatedInventoryList =  async (productId, branchId) => {
   const { rows } = await SQLquery(
        `SELECT 
            inventory_product.product_id, 
            branch_id, 
            Category.category_id, 
            Category.category_name, 
            product_name, 
            unit, 
            unit_price, 
            unit_cost, 
            COALESCE(SUM(CASE WHEN ast.product_validity < NOW() THEN 0 ELSE ast.quantity_left END), 0) AS quantity,
            threshold 
        FROM inventory_product
        LEFT JOIN Category USING(category_id)
        LEFT JOIN Add_Stocks ast USING(product_id, branch_id)
        WHERE product_id = $1 AND branch_id = $2
        GROUP BY 
            inventory_product.product_id, 
            branch_id, 
            Category.category_id, 
            Category.category_name, 
            product_name, 
            unit, 
            unit_price, 
            unit_cost, 
            threshold`,
        [productId, branchId],
    );

    return rows[0];
};



export const getProductItems = async(branchId) => {

    if (!branchId){
        const {rows} = await SQLquery(`
            SELECT 
                ip.product_id, 
                ip.branch_id, 
                c.category_id, 
                c.category_name, 
                ip.product_name, 
                ip.unit, 
                ip.unit_price, 
                ip.unit_cost, 
                COALESCE(SUM(CASE WHEN ast.product_validity < NOW() THEN 0 ELSE ast.quantity_left END), 0) AS quantity,
                ip.threshold
            FROM inventory_product ip
            LEFT JOIN category c USING(category_id)
            LEFT JOIN add_stocks ast USING(product_id, branch_id)
            GROUP BY 
                ip.product_id, 
                ip.branch_id, 
                c.category_id, 
                c.category_name, 
                ip.product_name, 
                ip.unit, 
                ip.unit_price, 
                ip.unit_cost, 
                ip.threshold
            ORDER BY ip.product_id ASC;
        `);

        return rows;

    }; 


    const {rows} = await SQLquery(`
        SELECT 
            inventory_product.product_id, 
            branch_id, 
            Category.category_id, 
            Category.category_name, 
            product_name, 
            unit, 
            unit_price, 
            unit_cost, 
            COALESCE(SUM(CASE WHEN ast.product_validity < NOW() THEN 0 ELSE ast.quantity_left END), 0) AS quantity,
            threshold 
        FROM inventory_product  
        LEFT JOIN Category USING(category_id)
        LEFT JOIN Add_Stocks ast USING(product_id, branch_id)
        WHERE branch_id = $1
        GROUP BY 
            inventory_product.product_id, 
            branch_id, 
            Category.category_id, 
            Category.category_name, 
            product_name, 
            unit, 
            unit_price, 
            unit_cost, 
            threshold
        ORDER BY inventory_product.product_id ASC
    `,[branchId]);

    return rows;

};



export const addProductItem = async (productData) => {
    const { product_name, category_id, branch_id, unit, unit_price, unit_cost, quantity_added, threshold, date_added, product_validity, userID, fullName } = productData;

    const productAddedNotifheader = "New Product";
    const notifMessage = `${product_name} has been added to the inventory with ${quantity_added} ${unit}.`;
    const color = 'green';

    //CREATES A UNIQUE PRODUCT ID WITH RETRY LOGIC
    let product_id;
    let isUnique = false;
    let retryCount = 0;
    const maxRetries = 10;
    
    while (!isUnique && retryCount < maxRetries) {
        product_id = Math.floor(100000 + Math.random() * 900000); 
        
        try {
            const check = await SQLquery('SELECT 1 FROM Inventory_Product WHERE product_id = $1 FOR UPDATE', [product_id]);
            if (check.rowCount === 0) {
                isUnique = true;
            } else {
                retryCount++;
                // Add small delay to reduce contention
                
                await new Promise(resolve => setTimeout(resolve, Math.random() * 50));
            }
        } catch (error) {
            retryCount++;
            if (retryCount >= maxRetries) {
                throw new Error('Unable to generate unique product ID after multiple attempts');
            }
        }
    }

    if (!isUnique) {
        throw new Error('Unable to generate unique product ID');
    }

    await SQLquery('BEGIN');

    await SQLquery(
        `INSERT INTO Inventory_Product 
        (product_id, category_id, branch_id, product_name, unit, unit_price, unit_cost, threshold)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [product_id, category_id, branch_id, product_name, unit, unit_price, unit_cost, threshold]
    );   

    await SQLquery(
        `INSERT INTO Add_Stocks 
        (product_id, h_unit_price, h_unit_cost, quantity_added, date_added, product_validity, quantity_left, branch_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *`,
        [product_id, unit_price, unit_cost, quantity_added, date_added, product_validity, quantity_added, branch_id]
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

    await checkAndHandleLowStock(product_id, branch_id, {
        triggeredByUserId: userID,
        triggerUserName: fullName
    });

    // BROADCAST INVENTORY UPDATE TO ALL USERS IN THE BRANCH
    broadcastInventoryUpdate(branch_id, {
        action: 'add',
        product: newProductRow,
        user_id: userID
    });

    // GET CATEGORY NAME ONCE FOR BOTH VALIDITY AND HISTORY UPDATES
    const categoryName = await getCategoryName(category_id);
    const addedDateObj = new Date(date_added);

    // BROADCAST VALIDITY UPDATE IF PRODUCT HAS EXPIRY DATE
    if (product_validity) {
        const validityDateObj = new Date(product_validity);
        const currentDate = new Date();
        
        // Calculate if near expiry or expired
        const daysUntilExpiry = Math.ceil((validityDateObj - currentDate) / (1000 * 60 * 60 * 24));
        const near_expy = daysUntilExpiry <= 3 && daysUntilExpiry >= 0;
        const expy = validityDateObj <= currentDate;

        broadcastValidityUpdate(branch_id, {
            action: 'add',
            product: {
                product_id: product_id,
                product_name: product_name,
                category_name: categoryName,
                quantity_added: quantity_added,
                quantity_left: quantity_added,
                formated_date_added: addedDateObj.toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                }),
                formated_product_validity: validityDateObj.toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                }),
                date_added: date_added,
                product_validity: product_validity,
                near_expy: near_expy,
                expy: expy
            },
            user_id: userID
        });
    }

    // BROADCAST HISTORY UPDATE FOR NEW PRODUCT (always has quantity when adding)
    broadcastHistoryUpdate(branch_id, {
        action: 'add',
        historyEntry: {
            product_name: product_name,
            category_name: categoryName,
            h_unit_cost: unit_cost,
            quantity_added: quantity_added,
            value: unit_cost * quantity_added,
            formated_date_added: addedDateObj.toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            }),
            date_added: date_added
        },
        user_id: userID
    });

    return newProductRow;
};



export const updateProductItem = async (productData, itemId) => {
    const { product_name, branch_id, category_id, unit, unit_price, unit_cost, quantity_added, threshold, date_added, product_validity, userID, fullName } = productData;

    const addStocksQuery = async () =>{

        return await SQLquery(
            `INSERT INTO Add_Stocks 
            (product_id, h_unit_price, h_unit_cost, quantity_added, date_added, product_validity, quantity_left, branch_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *`,
            [itemId, unit_price, unit_cost, quantity_added, date_added, product_validity, quantity_added, branch_id]
        );

    }

    // LOCK THE PRODUCT ROW TO PREVENT CONCURRENT MODIFICATIONS
    const previousData = await SQLquery(
        'SELECT branch_id, unit_price, unit_cost, product_name, unit, threshold, category_id FROM Inventory_Product WHERE product_id = $1 AND branch_id = $2 FOR UPDATE', 
        [itemId, branch_id]
    );

    if (previousData.rowCount === 0) {
        throw new Error(`Product with ID ${itemId} not found`);
    }

    const prev = previousData.rows[0];
    const returnPreviousPrice = Number(prev.unit_price);
    const returnBranchId = Number(prev.branch_id);
    
    // Check if any product information changed (excluding quantity additions)
    const productInfoChanged = 
        prev.product_name !== product_name ||
        prev.unit !== unit ||
        Number(prev.threshold) !== Number(threshold) ||
        Number(prev.category_id) !== Number(category_id) ||
        Number(prev.unit_cost) !== Number(unit_cost);



    // PRODUCT UPDATE BANNER TITLE
    const productAddedNotifheader = "Product Update";

    // UPDATE MESSAGES
    const addqQunatityNotifMessage = `Additional ${quantity_added} ${unit} has been added to ${product_name} at a cost of ₱ ${unit_cost}.`;
    const changePriceNotifMessage = `The price of ${product_name} has been changed from ₱ ${returnPreviousPrice} to ₱ ${unit_price}.`

    // BANNER COLOR
    const color = 'blue';

    await SQLquery('BEGIN');


    // Handle quantity addition and/or price change
    let alertResult = null;
    let finalMessage = '';

    // Handle quantity addition (add new stock entry)
    if (quantity_added !== 0){
        await addStocksQuery();
    }

    // Handle price change (update product table)
    if (returnPreviousPrice !== unit_price){
        // UPDATE THE INVENTORY_PRODUCT TABLE WITH NEW PRICE
        await SQLquery(
            `UPDATE Inventory_Product 
            SET unit_price = $1 
            WHERE product_id = $2 AND branch_id = $3`,
            [unit_price, itemId, branch_id]
        );
    }

    // Determine the message based on what changed and create single notification
    if (quantity_added !== 0 && returnPreviousPrice !== unit_price) {
        // Both quantity and price changed - create combined message
        finalMessage = `${addqQunatityNotifMessage} and ${changePriceNotifMessage}`;

    } else if (quantity_added !== 0 && returnPreviousPrice === unit_price) {
        // Only quantity changed
        finalMessage = addqQunatityNotifMessage;

    } else if (quantity_added === 0 && returnPreviousPrice !== unit_price) {
        // Only price changed
        finalMessage = changePriceNotifMessage;

    }

    // Create single notification entry if there were changes
    if (finalMessage) {
        alertResult = await SQLquery(
            `INSERT INTO Inventory_Alerts 
            (product_id, branch_id, alert_type, message, banner_color, user_id, user_full_name)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *`,
            [itemId, returnBranchId, productAddedNotifheader, finalMessage, color, userID, fullName]
        );

        // Broadcast the single notification
        if (alertResult?.rows[0]) {
            broadcastNotification(returnBranchId, {
                alert_id: alertResult.rows[0].alert_id,
                alert_type: productAddedNotifheader,
                message: finalMessage,
                banner_color: color,
                user_id: alertResult.rows[0].user_id,
                user_full_name: fullName,
                alert_date: alertResult.rows[0].alert_date,
                isDateToday: true,
                alert_date_formatted: 'Just now'
            });
        }
    }

    // Handle other product information updates (name, unit, threshold, category, cost)
    if (productInfoChanged) {
        
        await SQLquery(
            `UPDATE Inventory_Product 
            SET product_name = $1, unit = $2, threshold = $3, category_id = $4, unit_cost = $5
            WHERE product_id = $6 AND branch_id = $7`,
            [product_name, unit, threshold, category_id, unit_cost, itemId, branch_id]
        );

        // Create notification for product info update
        const updateMessage = `Product information for ${product_name} has been updated.`;
        const alertResult = await SQLquery(
            `INSERT INTO Inventory_Alerts 
            (product_id, branch_id, alert_type, message, banner_color, user_id, user_full_name)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *`,
            [itemId, returnBranchId, productAddedNotifheader, updateMessage, color, userID, fullName]
        );

        if (alertResult.rows[0]) {
            broadcastNotification(returnBranchId, {
                alert_id: alertResult.rows[0].alert_id,
                alert_type: productAddedNotifheader,
                message: updateMessage,
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

    await checkAndHandleLowStock(itemId, branch_id, {
        triggeredByUserId: userID,
        triggerUserName: fullName
    });

    // BROADCAST INVENTORY UPDATE TO ALL USERS IN THE BRANCH
    broadcastInventoryUpdate(branch_id, {
        action: 'update',
        product: updatedProductRow,
        user_id: userID
    });

    // BROADCAST UPDATES ONLY IF QUANTITY WAS ADDED (new stock entry created)
    if (quantity_added > 0) {
        const categoryName = await getCategoryName(category_id);
        const addedDateObj = new Date(date_added);

        // BROADCAST VALIDITY UPDATE IF EXPIRY DATE PROVIDED
        if (product_validity) {
            const validityDateObj = new Date(product_validity);
            const currentDate = new Date();
            
            // Calculate if near expiry or expired
            const daysUntilExpiry = Math.ceil((validityDateObj - currentDate) / (1000 * 60 * 60 * 24));
            const near_expy = daysUntilExpiry <= 3 && daysUntilExpiry >= 0;
            const expy = validityDateObj <= currentDate;

            broadcastValidityUpdate(branch_id, {
                action: 'update',
                product: {
                    product_id: itemId,
                    product_name: product_name,
                    category_name: categoryName,
                    quantity_added: quantity_added,
                    quantity_left: quantity_added,
                    formated_date_added: addedDateObj.toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                    }),
                    formated_product_validity: validityDateObj.toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                    }),
                    date_added: date_added,
                    product_validity: product_validity,
                    near_expy: near_expy,
                    expy: expy
                },
                user_id: userID
            });
        }

        // BROADCAST HISTORY UPDATE (always for quantity additions)
        broadcastHistoryUpdate(branch_id, {
            action: 'update',
            historyEntry: {
                product_name: product_name,
                category_name: categoryName,
                h_unit_cost: unit_cost,
                quantity_added: quantity_added,
                value: unit_cost * quantity_added,
                formated_date_added: addedDateObj.toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                }),
                date_added: date_added
            },
            user_id: userID
        });
    }

    return  updatedProductRow;
};



export const searchProductItem = async (searchItem) =>{
    const {rows} = await SQLquery('SELECT * FROM Inventory_Product WHERE product_name ILIKE $1', [`%${searchItem}%`]);

    return rows;
};