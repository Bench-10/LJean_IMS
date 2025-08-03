import { SQLquery } from "../../db.js";
import { saltHashPassword } from "../Services_Utils/passwordHashing.js";
import * as passwordEncryption from "../Services_Utils/passwordEncryption.js";


export const createUserAccount = async (UserData) => {
    const { branch, role, first_name, last_name, cell_number, is_active, address, username, password } = UserData;

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



export const deleteUser = async (userID) =>{

    await SQLquery('DELETE FROM Users WHERE user_id = $1', [userID]);

};


