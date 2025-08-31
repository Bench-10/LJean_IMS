import { SQLquery } from "../../db.js";
import * as passwordEncryption from "../Services_Utils/passwordEncryption.js";
import {decodeHashedPassword} from '../Services_Utils/passwordHashing.js';


export const userAuth = async(loginInformation) =>{

    const {username, password} = loginInformation;


    //CHECK FIRST IF USER EXISTS IN THE USERS TABLE
    const existingUser = await SQLquery(
        `SELECT user_id, password FROM Login_Credentials WHERE username = $1`,
        [username]
    );

    if (existingUser.rowCount) {

        //CHECK IF THE ENTERED PASSWORD IS EQUIVALENT TO ITS HASHED VALUE
        const encryptedPassword = existingUser.rows[0].password;
        const decryptedPassword = await passwordEncryption.decryptPassword(encryptedPassword);

        if (password != decryptedPassword) {
            return { error: "Invalid password" };

        };


        // FETCH THE USER DETAILS INCLUDING BRANCH NAME
        const userData = await SQLquery(
            `SELECT u.user_id, u.branch_id, b.branch_name, b.address, u.role, u.first_name || ' ' || u.last_name AS full_name, u.cell_number, u.hire_date
            FROM Users u
            JOIN Branch b ON u.branch_id = b.branch_id
            WHERE u.user_id = $1`,
            [existingUser.rows[0].user_id]
        );

        return userData.rows;
    
    };

    //THIS WILL RUN IF THE USERNAME DOES NOT BELONG TO USERS TABLE
    const isAdmin = await SQLquery(
        `SELECT password FROM Administrator WHERE username = $1`,
        [username]

    );

    if (!isAdmin.rowCount){
        return { error: "Username not exist" };

    };

    const isValidAdmin = await decodeHashedPassword(password, isAdmin.rows[0].password);

    if (!isValidAdmin){
        return { error: "Admin access denied" };
    };

    const adminData = await SQLquery(
        `SELECT first_name, last_name, first_name || ' ' || last_name AS full_name, role FROM Administrator WHERE username = $1`,
        [username]

    );

    return adminData.rows;

};
