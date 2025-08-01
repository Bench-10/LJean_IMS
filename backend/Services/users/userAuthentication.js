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
        return { error: "Invalid username or password" };
    }


    //CHECK IF THE ENTERED PASSWORD IS EQUIVALENT TO ITS HASHED VALUE
    const encryptedPassword = existingUser.rows[0].password;
    const decryptedPassword = await passwordEncryption.decryptPassword(encryptedPassword);

    if (password != decryptedPassword) {
        return { error: "Invalid username or password" };
    }


    // FETCH THE USER DETAILS
    const userData = await SQLquery(
        `SELECT user_id, branch_id, role, first_name || ' ' || last_name AS full_name, cell_number 
        FROM Users
        WHERE user_id = $1`,
        [existingUser.rows[0].user_id]
    );

    return userData.rows;
}