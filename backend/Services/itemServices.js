import { SQLquery } from "../db.js";

export const getProductItems = async() => {
    const {rows} = await SQLquery('SELECT * FROM inventory_product');
    return rows;
}