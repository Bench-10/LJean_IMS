import { SQLquery } from "../../db.js";
import * as passwordEncryption from "../Services_Utils/passwordEncryption.js";
import { correctDateFormat } from "../Services_Utils/convertRedableDate.js";



export const createUserAccount = async (UserData) => {
    const { branch, role, first_name, last_name, cell_number, address, username, password } = UserData;

    //CREATES A UNIQUE USER ID
    let user_id;
    let isUnique = false;
    while (!isUnique) {
        user_id = Math.floor(100000 + Math.random() * 900000); 
        const check = await SQLquery('SELECT 1 FROM Users WHERE user_id = $1', [user_id]);
        if (check.rowCount === 0) isUnique = true;
    }


    let permissions;

    if (role === 'Branch Manager')
        permissions = 'View Dashboard/view Inventory/View Notification/View Product Validity/Confirm Inventory Changes';

    if (role === 'Inventory Staff')
        permissions = 'Manage Inventory/View Product Validity/View Notifications';

    if (role === 'Sales Associate')
        permissions = 'Manage Sales Transactions/Monitor Deliveries';



    const securePassword = await passwordEncryption.encryptPassword(password);

    await SQLquery('BEGIN');

    await SQLquery(
        `INSERT INTO Users(user_id, branch_id, role, first_name, last_name, cell_number, is_active, last_login, permissions, address) 
        VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [user_id, branch, role, first_name, last_name, cell_number, false, 'Not yet logged in.', permissions, address]
    );

    await SQLquery(
        `INSERT INTO Login_credentials(user_id, username, password) 
        VALUES($1, $2, $3)`,
        [user_id, username, securePassword]
    );

    await SQLquery('COMMIT');
};



export const updateUserAccount = async (UserID, UserData) =>{
    const { branch, role, first_name, last_name, cell_number, address, username, password } = UserData;

    const securePassword = await passwordEncryption.encryptPassword(password);

    let permissions;

    if (role === 'Branch Manager')
        permissions = 'View Dashboard/view Inventory/View Notification/View Product Validity/Confirm Inventory Changes';

    if (role === 'Inventory Staff')
        permissions = 'Manage Inventory/View Product Validity/View Notifications';

    if (role === 'Sales Associate')
        permissions = 'Manage Sales Transactions/Monitor Deliveries';


    await SQLquery('BEGIN');


    await SQLquery(`UPDATE Users SET branch_id = $1, role = $2, first_name = $3, last_name = $4, cell_number = $5, permissions = $6, address = $7 WHERE user_id = $8`,[branch, role, first_name, last_name, cell_number, permissions, address, UserID]);


    await SQLquery(`UPDATE Login_Credentials SET username = $1, password = $2 WHERE user_id = $3 `,[username, securePassword, UserID]);


    const { rows } = await SQLquery(`
            SELECT Users.user_id, Branch.branch_name as branch, Branch.branch_id, first_name || ' ' || last_name AS full_name, first_name, last_name, role, cell_number, is_active, ${correctDateFormat('hire_date')}, last_login, permissions, Users.address, username, password
            FROM Users
            JOIN Branch ON Branch.branch_id = Users.branch_id
            JOIN Login_Credentials ON Login_Credentials.user_id = Users.user_id
            WHERE Users.user_id = $1
            ORDER BY hire_date;
        `, [UserID]);
    
    const usersWithDecryptedPasswords = await Promise.all(
        rows.map(async (user) => ({
            ...user,
            password: await passwordEncryption.decryptPassword(user.password)
        }))
    );


    await SQLquery('COMMIT');

    
    return usersWithDecryptedPasswords[0];

};



export const deleteUser = async (userID) =>{

    await SQLquery('DELETE FROM Users WHERE user_id = $1', [userID]);

};


