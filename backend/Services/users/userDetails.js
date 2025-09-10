import { SQLquery } from "../../db.js";
import { correctDateFormat } from "../Services_Utils/convertRedableDate.js";
import * as passwordEncryption from '../Services_Utils/passwordEncryption.js';



export const getAllUsers = async () =>{
    const { rows } = await SQLquery(`
            SELECT 
                Users.user_id, 
                Branch.branch_name as branch, 
                Branch.branch_id,
                first_name || ' ' || last_name AS full_name, 
                first_name, 
                last_name, 
                role, 
                cell_number, 
                is_active, 
                is_disabled,
                ${correctDateFormat('hire_date')}, 
                last_login, 
                permissions, 
                Users.address, 
                username, 
                password

            FROM Users
            JOIN Branch ON Branch.branch_id = Users.branch_id
            JOIN Login_Credentials ON Login_Credentials.user_id = Users.user_id
            WHERE NOT ('Owner' = ANY(role))
            ORDER BY hire_date;
        `);

    const usersWithDecryptedPasswords = await Promise.all(
        rows.map(async (user) => ({
            ...user,
            password: await passwordEncryption.decryptPassword(user.password)
        }))
    );

    return usersWithDecryptedPasswords;
};



export const getAllBranches = async () =>{
    const { rows } = await SQLquery(`
            SELECT branch_id, branch_name
            FROM Branch
            ORDER BY branch_id
        `);

    return rows;
};