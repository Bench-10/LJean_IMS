//WILL BE USED IF THERE IS A USECASE FOR THIS
import bcrypt from 'bcrypt'; 

const saltRounds = 12;


//THIS HASHES THE PASSWORD FOR BETTER SECURITY (CANNOT BE DECRYPTED)
export const saltHashPassword = async (plainPassword) =>{
    const hashedPassword = await bcrypt.hash(plainPassword, saltRounds);

    return hashedPassword;

}