import { SQLquery } from "../../db.js";



//VIEW SALE
export const viewSale = async () => {
    const { rows } = await SQLquery('SELECT * FROM Category ORDER BY category_id');
    return rows;
};



//ADD SALE
export const addSale = async () => {
    const { rows } = await SQLquery('SELECT * FROM Category ORDER BY category_id');
    return rows;
};