import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();


const secretKey = Buffer.from(process.env.SECRET_KEY, 'hex');
const algorithm = 'aes-256-cbc';
const iv = crypto.randomBytes(16);


//ENCRYPT PASSWORD
export const encryptPassword = async (plainPassword) => {

    const cipher = crypto.createCipheriv(algorithm, Buffer.from(secretKey), iv);
    let encrypted = cipher.update(plainPassword);
    encrypted = Buffer.concat([encrypted, cipher.final()]);


    return iv.toString('hex') + ':' + encrypted.toString('hex');
    
}; 



//DECRYP PASSWORD
export const decryptPassword = async (encryptedPassword) => {

    const parts = encryptedPassword.split(':');
    const iv = Buffer.from(parts.shift(), 'hex');
    const encryptedText = Buffer.from(parts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv(algorithm, Buffer.from(secretKey), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);


    return decrypted.toString();

}