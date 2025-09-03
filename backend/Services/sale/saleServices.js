import { SQLquery } from "../../db.js";
import {correctDateFormat} from "../Services_Utils/convertRedableDate.js"



//VIEW SALE
export const viewSale = async (branchId) => {
   const { rows } = await SQLquery(`SELECT sales_information_id, branch_id, charge_to, tin, address, ${correctDateFormat('date')}, vat, amount_net_vat, total_amount_due, dicount_pwd_senior_number, senior_pwd_discount FROM Sales_Information WHERE branch_id = $1;`, [branchId]);
   
   return rows;
};



//VIEW A SPECIFIC SALE
export const viewSelectedItem = async (saleId) => {
   const { rows } = await SQLquery(`

        SELECT product_id, Inventory_Product.product_name,  Sales_Items.quantity, Sales_Items.unit, Sales_Items.unit_price, amount 
        FROM Sales_Items
        LEFT JOIN Inventory_Product USING(product_id)
        WHERE sales_information_id = $1;`
    
    , [saleId]);
   
   return rows;
};



//ADD SALE
export const addSale = async (headerAndProducts) => {

    const {headerInformationAndTotal = {}, productRow = []} = headerAndProducts;

    const {chargeTo, tin, address, date, branch_id, seniorPw,  vat, amountNetVat, seniorPwdDisc, totalAmountDue, } = headerInformationAndTotal;

    let discount_number;
    if (seniorPw.trim().length === 0){
        discount_number  = 'none';
    } else {
        discount_number = seniorPw;
    }

    let sale_id;
    let isUnique = false;
    while (!isUnique) {
        sale_id = Math.floor(1000000 + Math.random() * 9000000); 
        const check = await SQLquery('SELECT 1 FROM Sales_Information WHERE sales_information_id = $1', [sale_id]);
        if (check.rowCount === 0) isUnique = true;
    }

    try {
        //CHECK DATABASE AGAIN FOR IF AVAILABLE QUANITY IS ENOUGH
        if (productRow && productRow.length > 0) {
            for (const product of productRow) {
                const inventoryCheck = await SQLquery(
                    'SELECT quantity FROM Inventory_Product WHERE product_id = $1',
                    [product.product_id]
                );
                
                if (inventoryCheck.rowCount === 0) {
                    throw new Error(`Product with ID ${product.product_id} not found in inventory`);
                }
                
                const availableQuantity = inventoryCheck.rows[0].quantity;
                if (Number(product.quantity) > availableQuantity) {
                    throw new Error(`Insufficient inventory for product ID ${product.product_id}. Available: ${availableQuantity}, Requested: ${product.quantity}`);
                }
            }
        }

        await SQLquery('BEGIN');

    
        await SQLquery(`
            INSERT INTO Sales_Information ( sales_information_id, branch_id, charge_to, tin, address, date, vat, amount_net_vat, total_amount_due, dicount_pwd_senior_number, senior_pwd_discount ) VALUES ( $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11);

        `, [sale_id, branch_id, chargeTo, tin, address, date, vat, amountNetVat, totalAmountDue, discount_number, seniorPwdDisc]);



    
   
        if (productRow && productRow.length > 0) {


            const values = [];
            const placeholders = [];
            productRow.forEach((p, i) => {
            const baseIndex = i * 6;
            placeholders.push(`($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}, $${baseIndex + 6})`);
            values.push(sale_id, p.product_id, p.quantity, p.unit, p.unitPrice, p.amount );
            });

            const query = `INSERT INTO Sales_Items(sales_information_id, product_id, quantity, unit, unit_price, amount) VALUES ${placeholders.join(', ')}`;
            await SQLquery(query, values);


            for (const product of productRow) {
                await SQLquery(
                    'UPDATE Inventory_Product SET quantity = quantity - $1 WHERE product_id = $2',
                    [product.quantity, product.product_id]
                );
            };
        };


        await SQLquery('COMMIT');


        const {rows} = await SQLquery(`
            SELECT sales_information_id, branch_id, charge_to, tin, address, ${correctDateFormat('date')}, vat, amount_net_vat, total_amount_due, dicount_pwd_senior_number, senior_pwd_discount
            FROM Sales_Information 
            WHERE branch_id = $1 AND sales_information_id = $2;`
        , [branch_id, sale_id]);

        return rows[0];

    } catch (error) {

        await SQLquery('ROLLBACK');
        throw error;
    }

};