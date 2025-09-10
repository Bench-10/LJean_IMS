import { SQLquery } from "../../db.js";




export const disableEnableAccount = async (user_id, status) =>{
    
    await SQLquery('UPDATE Users SET is_disabled = $1 WHERE user_id = $2', [status, user_id]);

};



export const disableAccountOnAttempt = async (user_name, status) =>{

    const {rows: userID} = await SQLquery('SELECT user_id FROM Login_Credentials  WHERE username = $1', [user_name]);
    
    await SQLquery('UPDATE Users SET is_disabled = $1 WHERE user_id = $2', [status, userID[0].user_id]);

};