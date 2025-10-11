import { SQLquery } from "../../db.js";
import * as passwordEncryption from "../Services_Utils/passwordEncryption.js";
import {decodeHashedPassword} from '../Services_Utils/passwordHashing.js';
import { broadcastUserStatusUpdate } from "../../server.js";
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

        //CHECK IF USER ACCOUNT IS CURRENTLY DISABLED
        const accountStatusResult = await SQLquery(
            `SELECT u.is_disabled, u.status
                FROM users u
                JOIN login_credentials lc ON u.user_id = lc.user_id
                WHERE lc.username = $1`,
            [username]
        );

        if (accountStatusResult.rowCount && accountStatusResult.rows[0].is_disabled){

            return { error: "Account Disabled" };

        };

        //CHECK IF THE ENTERED PASSWORD IS EQUIVALENT TO ITS HASHED VALUE
        const encryptedPassword = existingUser.rows[0].password;
        const decryptedPassword = await passwordEncryption.decryptPassword(encryptedPassword);

        if (password != decryptedPassword) {
            return { error: "Invalid password" };

        };

        const accountStatus = accountStatusResult.rows[0]?.status || 'active';
        if (accountStatus !== 'active') {
            const errorMessage = accountStatus === 'pending'
                ? 'Account pending owner approval'
                : 'Account not active';
            return { error: errorMessage };
        }


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

        // BROADCAST USER LOGIN STATUS TO ALL USERS IN THE BRANCH
        if (userData.rows[0]) {
            broadcastUserStatusUpdate(userData.rows[0].branch_id, {
                action: 'login',
                user_id: existingUser.rows[0].user_id,
                full_name: userData.rows[0].full_name,
                last_login: formatted,
                is_active: true
            });
        }

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
        return { error: "Invalid password" };
    };

    const adminData = await SQLquery(
        `SELECT admin_id, first_name, last_name, first_name || ' ' || last_name AS full_name, role FROM Administrator WHERE username = $1`,
        [username]

    );

    return adminData.rows;

};



export const userLastLogout = async(userId, active) =>{

    const {activity} = active;

    // ENSURE userId IS AN INTEGER
    const userIdInt = parseInt(userId, 10);
    
    console.log(`Processing logout for user ${userIdInt}, activity: ${activity}`);

    // CHECK IF IT'S A REGULAR USER OR ADMINISTRATOR
    const userCheck = await SQLquery("SELECT user_id, branch_id, first_name || ' ' || last_name AS full_name FROM Users WHERE user_id = $1", [userIdInt]);

    if (userCheck.rows.length > 0) {
        // REGULAR USER - UPDATE STATUS AND BROADCAST
        await SQLquery("UPDATE Users SET is_active = $1 WHERE user_id = $2", [activity, userIdInt]);

        console.log(`Broadcasting logout status for user ${userIdInt} in branch ${userCheck.rows[0].branch_id}`);

        // BROADCAST USER LOGOUT STATUS TO ALL USERS IN THE BRANCH
        broadcastUserStatusUpdate(userCheck.rows[0].branch_id, {
            action: 'logout',
            user_id: userIdInt,
            full_name: userCheck.rows[0].full_name,
            is_active: activity
        });
    } else {
        // ADMINISTRATOR USER - NO BROADCAST NEEDED (NOT IN BRANCH USERS LIST)
        console.log(`Administrator user ${userIdInt} logged out - no status broadcast needed`);
    }

};
