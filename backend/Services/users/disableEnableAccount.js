import { SQLquery } from "../../db.js";
import { broadcastUserUpdate } from "../../server.js";
import { correctDateFormat } from "../Services_Utils/convertRedableDate.js";
import * as passwordEncryption from "../Services_Utils/passwordEncryption.js";




export const disableEnableAccount = async (user_id, status) =>{
    
    await SQLquery('UPDATE Users SET is_disabled = $1 WHERE user_id = $2', [status, user_id]);

    // GET UPDATED USER DATA FOR BROADCASTING
    const { rows } = await SQLquery(`
        SELECT Users.user_id, Branch.branch_name as branch, Branch.branch_id, first_name || ' ' || last_name AS full_name, first_name, last_name, role, cell_number, is_active, is_disabled, ${correctDateFormat('hire_date')}, last_login, permissions, Users.address, username, password
        FROM Users
        JOIN Branch ON Branch.branch_id = Users.branch_id
        JOIN Login_Credentials ON Login_Credentials.user_id = Users.user_id
        WHERE Users.user_id = $1
        ORDER BY hire_date;
    `, [user_id]);

    if (rows[0]) {
        const userWithDecryptedPassword = {
            ...rows[0],
            password: await passwordEncryption.decryptPassword(rows[0].password)
        };

        // BROADCAST USER STATUS CHANGE TO ALL USERS IN THE BRANCH
        broadcastUserUpdate(rows[0].branch_id, {
            action: 'update',
            user: userWithDecryptedPassword
        });
    }

};



export const disableAccountOnAttempt = async (user_name, status) =>{

    const {rows: userID} = await SQLquery('SELECT user_id FROM Login_Credentials  WHERE username = $1', [user_name]);
    
    await SQLquery('UPDATE Users SET is_disabled = $1 WHERE user_id = $2', [status, userID[0].user_id]);

    // GET UPDATED USER DATA FOR BROADCASTING
    const { rows } = await SQLquery(`
        SELECT Users.user_id, Branch.branch_name as branch, Branch.branch_id, first_name || ' ' || last_name AS full_name, first_name, last_name, role, cell_number, is_active, is_disabled, ${correctDateFormat('hire_date')}, last_login, permissions, Users.address, username, password
        FROM Users
        JOIN Branch ON Branch.branch_id = Users.branch_id
        JOIN Login_Credentials ON Login_Credentials.user_id = Users.user_id
        WHERE Users.user_id = $1
        ORDER BY hire_date;
    `, [userID[0].user_id]);

    if (rows[0]) {
        const userWithDecryptedPassword = {
            ...rows[0],
            password: await passwordEncryption.decryptPassword(rows[0].password)
        };

        // BROADCAST USER STATUS CHANGE TO ALL USERS IN THE BRANCH
        broadcastUserUpdate(rows[0].branch_id, {
            action: 'update',
            user: userWithDecryptedPassword
        });
    }

};