import { SQLquery } from "../../db.js";


export const userAuth = async(loginInformation) =>{

    const {username, password} = loginInformation;


    const existingUser = await SQLquery(`
        SELECT 1 
        FROM Login_Credentials
        WHERE username = $1 AND password = $2`,
        [username, password]

    );

    if (!existingUser.rowCount){
        return { error: "Something went wrong"}

    }

    const userData = await SQLquery(
        `SELECT user_id, branch_id, role, first_name || ' ' || last_name AS full_name, cell_number 
        FROM Login_Credentials
        JOIN Users USING(user_id)
        WHERE username = $1 AND password = $2`,
        [username, password]
    )


    return userData.rows;


}