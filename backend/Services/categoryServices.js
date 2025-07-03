import { SQLquery } from "../db.js";



//CATEGORIES SERVICES
export const getAllCategories = async () => {
    const { rows } = await SQLquery('SELECT * FROM Category ORDER BY category_id');
    return rows;
};



export const addListCategory = async (categoryData) => {
   const { category_name } = categoryData;

   const { rows } = await SQLquery('INSERT INTO Category (category_name) VALUES($1) RETURNING *', [category_name]);

   return rows[0];
};



export const updateListCategory = async (categoryData, categoryId) =>{
    const { category_name } = categoryData;

    const { rows } = await SQLquery('UPDATE Category SET category_name = $1 WHERE category_id = $2 RETURNING*', [category_name, categoryId])

    return rows[0]
};