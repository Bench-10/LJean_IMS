import { SQLquery } from "../../db.js";
import * as passwordEncryption from "../Services_Utils/passwordEncryption.js";
import {decodeHashedPassword} from '../Services_Utils/passwordHashing.js';
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";


dayjs.extend(utc);
dayjs.extend(timezone);



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

        // RECORDS CURRENT TIME AND DAY using dayjs
        const formatted = dayjs().tz('Asia/Manila').format('dddd, MMMM D, YYYY, hh:mm A');

        await SQLquery(
            `UPDATE Users 
            SET is_active = $1, last_login = $2
            WHERE user_id = $3`,
            [true, formatted, existingUser.rows[0].user_id]
        );


        // FETCH THE USER DETAILS INCLUDING BRANCH NAME
        const userData = await SQLquery(
            `SELECT u.user_id, u.branch_id, b.branch_name, b.address, u.role, u.first_name || ' ' || u.last_name AS full_name, u.cell_number, u.hire_date, b.telephone_num, cellphone_num, branch_email
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
        return { error: "Invalid username" };

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



export const userLastLogout = async(userId, active) =>{

    const {activity} = active;

    await SQLquery("UPDATE Users SET is_active = $1 WHERE user_id = $2", [activity, userId]);

};
