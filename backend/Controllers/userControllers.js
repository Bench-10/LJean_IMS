import * as userDetails from '../Services/users/userDetails.js';
import * as userAuthentication from '../Services/users/userAuthentication.js';
import * as userCreation from '../Services/users/userCreation.js';


export const getBranches = async (req, res) =>{
    try {
        const user = await userDetails.getAllBranches();
        res.status(200).json(user);
    } catch (error) {
        console.error('Error fetching branches: ', error);
        res.status(500).json({message: 'Internal Server Error'})
    }
}



export const getUsers = async (req, res) =>{
    try {
        const user = await userDetails.getAllUsers();
        res.status(200).json(user);
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




//CREAING AN ACCOUNT
export const userCreationAccount = async (req, res) =>{
    try {
        const userData = req.body;
        const user = await userCreation.createUserAccount(userData);
        res.status(200).json(user);
    } catch (error) {
        console.error('Error creating users: ', error);
        res.status(500).json({message: 'Internal Server Error'})
    }
}