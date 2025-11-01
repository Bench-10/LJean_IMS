import crypto from 'crypto';


const algorithm = 'aes-256-cbc';


const getEncryptionKey = () => {
  const secretHex = process.env.SECRET_KEY;
  if (!secretHex) {
    throw new Error('SECRET_KEY environment variable is missing. Check your .env/.env.production files.');
  }
  return Buffer.from(secretHex, 'hex');
};


//ENCRYPT PASSWORD
export const encryptPassword = async (plainPassword) => {
    const key = getEncryptionKey();
  const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv(algorithm, Buffer.from(key), iv);
    let encrypted = cipher.update(plainPassword);
    encrypted = Buffer.concat([encrypted, cipher.final()]);


    return iv.toString('hex') + ':' + encrypted.toString('hex');
    
}; 



//DECRYP PASSWORD
export const decryptPassword = async (encryptedPassword) => {
    const key = getEncryptionKey();

    const parts = encryptedPassword.split(':');
    const iv = Buffer.from(parts.shift(), 'hex');
    const encryptedText = Buffer.from(parts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv(algorithm, Buffer.from(key), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);


    return decrypted.toString();

}