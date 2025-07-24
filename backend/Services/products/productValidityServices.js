import { SQLquery } from "../../db.js";
import { correctDateFormat } from "../Services_Utils/convertRedableDate.js";



//GET PRODUCT VALIDITY LIST
export const getProductValidity = async() =>{
    const { rows } =  await SQLquery(`
            SELECT ${correctDateFormat('date_added')}, ${correctDateFormat('product_validity')}, Inventory_product.product_name, Category.category_name, quantity_added, (product_validity - CURRENT_DATE) <= 3 AS near_expy, product_validity <= CURRENT_DATE AS expy
            FROM Add_Stocks
            LEFT JOIN Inventory_product USING(product_id)
            LEFT JOIN Category USING(category_id)
            WHERE product_validity >= CURRENT_DATE - 2
            ORDER BY date_added DESC, add_id DESC
    `);

    return rows;

};