import { SQLquery } from "../../db.js";
import { correctDateFormat } from "../Services_Utils/convertRedableDate.js";



export const getAllUsers = async () =>{
    const { rows } = await SQLquery(`
            SELECT user_id, Branch.branch_name as branch, first_name || ' ' || last_name AS full_name, first_name, last_name, role, cell_number, is_active, ${correctDateFormat('hire_date')}, last_login, permissions, Users.address
            FROM Users
            JOIN Branch USING(branch_id)
            WHERE role != 'Owner'
            ORDER BY hire_date;
        `);

    return rows;
};



export const getAllBranches = async () =>{
    const { rows } = await SQLquery(`
            SELECT branch_id, branch_name
            FROM Branch
            ORDER BY branch_id
        `);

    return rows;
};