import { SQLquery } from "../../db.js";



export const getAllUsers = async () =>{
    const { rows } = await SQLquery(`
            SELECT Branch.branch_name as branch, first_name || ' ' || last_name AS full_name, role, cell_number 
            FROM Users
            JOIN Branch USING(branch_id)
            WHERE role != 'Owner';
        `);

    return rows;
};