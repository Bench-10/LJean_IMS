import * as userDetails from '../Services/users/userDetails.js';
import * as userAuthentication from '../Services/users/userAuthentication.js';



export const getUsers = async (req, res) =>{
    try {
        const items = await userDetails.getAllUsers();
        res.status(200).json(items);
    } catch (error) {
        console.error('Error fetching users: ', error);
        res.status(500).json({message: 'Internal Server Error'})
    }
}



export const userCredentials = async (req, res) =>{
    try {
        const loginCredentials = req.body;
        const user = await userAuthentication.userAuth(loginCredentials);
        res.status(200).json(user);
    } catch (error) {
        console.error('Error fetching users: ', error);
        res.status(500).json({message: 'Internal Server Error'})
    }
}