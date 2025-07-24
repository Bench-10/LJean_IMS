import { SQLquery } from "../../db.js";



export const getAllUsers = async () =>{
    const { rows } = await SQLquery('SELECT * FROM Users');

    return rows;
};