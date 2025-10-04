import { SQLquery } from "../../db.js";
import { correctDateFormat } from "../Services_Utils/convertRedableDate.js";



//GET PRODUCT VALIDITY LIST
export const getProductValidity = async(branchId) =>{
    const { rows } =  await SQLquery(`
            SELECT ${correctDateFormat('date_added')}, ${correctDateFormat('product_validity')}, Inventory_product.product_name, branch_id, Category.category_name, quantity_added, quantity_left,(product_validity - CURRENT_DATE) <= 3 AS near_expy, product_validity <= CURRENT_DATE AS expy
            FROM Add_Stocks
            LEFT JOIN Inventory_product USING(product_id, branch_id)
            LEFT JOIN Category USING(category_id)
            WHERE product_validity >= CURRENT_DATE - 2 AND branch_id = $1
            ORDER BY date_added DESC, add_id DESC
    `,[branchId]);

    return rows;

};