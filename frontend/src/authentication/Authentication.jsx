import { SQLquery } from "../../db.js";
import bcrypt from 'bcrypt';
import * as passwordEncryption from "../Services_Utils/passwordEncryption.js";


export const userAuth = async(loginInformation) =>{

    const {username, password} = loginInformation;


    //CHECK FIRST IF USER EXISTS
    const existingUser = await SQLquery(
        `SELECT user_id, password FROM Login_Credentials WHERE username = $1`,
        [username]
    );

    if (!existingUser.rowCount) {
        return { error: "Invalid username" }; // just remove the 
    
    }


    //CHECK IF THE ENTERED PASSWORD IS EQUIVALENT TO ITS HASHED VALUE
    const encryptedPassword = existingUser.rows[0].password;
    const decryptedPassword = await passwordEncryption.decryptPassword(encryptedPassword);

    if (password != decryptedPassword) {
        return { error: "Invalid password" };
    }


    // FETCH THE USER DETAILS INCLUDING BRANCH NAME
    const userData = await SQLquery(
        `SELECT u.user_id, u.branch_id, b.branch_name, u.role, u.first_name || ' ' || u.last_name AS full_name, u.cell_number 
        FROM Users u
        JOIN Branch b ON u.branch_id = b.branch_id
        WHERE u.user_id = $1`,
        [existingUser.rows[0].user_id]
    );

    return userData.rows;
}
