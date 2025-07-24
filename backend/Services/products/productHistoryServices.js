import { SQLquery } from "../../db.js";
import { correctDateFormat } from "../Services_Utils/convertRedableDate.js";



//PRODUCT HISTORY
export const getProductHistory = async(dates) => {
    const { startDate, endDate } = dates;


    if (startDate === '' && endDate === '') {
        const {rows} = await SQLquery(`
            SELECT ${correctDateFormat('date_added')}, Inventory_product.product_name, Category.category_name, h_unit_cost, quantity_added, (h_unit_cost * quantity_added) AS value
            FROM Add_Stocks
            LEFT JOIN Inventory_product USING(product_id)
            LEFT JOIN Category USING(category_id)
            ORDER BY date_added DESC, add_id DESC
        `);
        return rows;
  
    }


    if (startDate !== '' && endDate !== '') {
        const {rows} = await SQLquery(`
            SELECT ${correctDateFormat('date_added')}, Inventory_product.product_name, Category.category_name, h_unit_cost, quantity_added, (h_unit_cost * quantity_added) AS value
            FROM Add_Stocks
            LEFT JOIN Inventory_product USING(product_id)
            LEFT JOIN Category USING(category_id)
            WHERE date_added BETWEEN $1 AND $2
            ORDER BY date_added DESC, add_id DESC
        `, [startDate, endDate]);

        return rows;
        
    }


    if (endDate === ''){
        const {rows} = await SQLquery(`
            SELECT ${correctDateFormat('date_added')}, Inventory_product.product_name, Category.category_name, h_unit_cost, quantity_added, (h_unit_cost * quantity_added) AS value
            FROM Add_Stocks
            LEFT JOIN Inventory_product USING(product_id)
            LEFT JOIN Category USING(category_id)
            WHERE date_added >= $1
            ORDER BY date_added DESC, add_id DESC
        `, [startDate]);

        return rows;
    }
    

    if (startDate === '') {
        const {rows} = await SQLquery(`
            SELECT ${correctDateFormat('date_added')}, Inventory_product.product_name, Category.category_name, h_unit_cost, quantity_added, (h_unit_cost * quantity_added) AS value
            FROM Add_Stocks
            LEFT JOIN Inventory_product USING(product_id)
            LEFT JOIN Category USING(category_id)
            WHERE date_added <= $1
            ORDER BY date_added DESC, add_id DESC
        `, [endDate]);

        return rows;
    }
    
};