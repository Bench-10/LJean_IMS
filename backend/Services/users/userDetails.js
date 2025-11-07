import { SQLquery } from "../../db.js";
import { correctDateFormat } from "../Services_Utils/convertRedableDate.js";
import * as passwordEncryption from '../Services_Utils/passwordEncryption.js';



export const getAllUsers = async (branchId, userId) =>{

    const where = [" NOT ('Owner' = ANY(role))", ];
    const conditions = [];

    if (branchId){
        where.push('Branch.branch_id = $1'); 
        conditions.push(branchId)
    };

    if (userId){
        where.push('Users.user_id != $2'); 
        conditions.push(userId)
    };


    if (userId && branchId){
        where.push(" NOT ('Branch Manager' = ANY(role))");
    };



    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';


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
                password,
                status,
                ucr.creator_user_id AS created_by_id,
                ucr.resolution_status AS creator_request_status,
                ucr.resolved_at AS creator_request_resolved_at,
                Users.created_by,
                Users.approved_by,
                Users.approved_at

            FROM Users
            JOIN Branch ON Branch.branch_id = Users.branch_id
            JOIN Login_Credentials ON Login_Credentials.user_id = Users.user_id
            LEFT JOIN User_Creation_Requests ucr ON ucr.pending_user_id = Users.user_id
            ${whereClause}
            ORDER BY hire_date;
        `, conditions);

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