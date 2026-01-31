import { SQLquery } from "../../db.js";
import { correctDateFormat } from "../Services_Utils/convertRedableDate.js";



//GET PRODUCT VALIDITY LIST
export const getProductValidity = async(branchId) =>{
    const { rows } =  await SQLquery(`
     SELECT MIN(Add_Stocks.add_id) AS primary_add_id,
         Add_Stocks.product_id,
         MIN(Add_Stocks.date_added) AS date_added,
         Add_Stocks.product_validity,
         TO_CHAR(MIN(Add_Stocks.date_added), 'Month DD, YYYY') AS formated_date_added,
         ${correctDateFormat('product_validity')},
         Inventory_product.product_name,
         branch_id,
         Category.category_name,
               SUM(quantity_added_display) as quantity_added,
               SUM(quantity_left_display) as quantity_left,
           (product_validity > CURRENT_DATE AND (product_validity - CURRENT_DATE) <= 3) AS near_expy,
           product_validity <= CURRENT_DATE AS expy,
           TO_CHAR(product_validity, 'MM') AS month, TO_CHAR(product_validity, 'YYYY') AS year
        FROM Add_Stocks
        LEFT JOIN Inventory_product USING(product_id, branch_id)
        LEFT JOIN Category USING(category_id)
                WHERE product_validity IS NOT NULL
                    AND product_validity <> '9999-12-31'
                    AND product_validity >= CURRENT_DATE - 2
                    AND branch_id = $1
     GROUP BY Add_Stocks.product_id,
           Add_Stocks.product_validity,
           Inventory_product.product_name,
           branch_id,
           Category.category_name,
           (product_validity > CURRENT_DATE AND (product_validity - CURRENT_DATE) <= 3),
           (product_validity <= CURRENT_DATE),
           TO_CHAR(product_validity, 'MM'),
           TO_CHAR(product_validity, 'YYYY')
     ORDER BY (product_validity <= CURRENT_DATE) DESC,
           ((product_validity > CURRENT_DATE AND (product_validity - CURRENT_DATE) <= 3)) DESC,
           date_added DESC,
           primary_add_id DESC
    `,[branchId]);

    return rows;

};