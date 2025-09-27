import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

//THIS PREVENTS MAXLISTENERS WARNING WHICH MAY CAUSE MEMORY LEAKS
let dbInstance;
function getDb() {
    if (!dbInstance) {
        dbInstance = new pg.Pool({
            user: process.env.PG_USER,
            host: process.env.PG_HOST,
            database: process.env.PG_DATABASE,
            password: process.env.PG_PASSWORD,
            port: process.env.PG_PORT,
            max: 20,
            connectionTimeoutMillis: 5000,
            idleTimeoutMillis: 30000,
            query_timeout: 10000
        });
        
        dbInstance.on('error', (err) => {
            console.error('Unexpected Error', err);
            process.exit(-1);
        });
    }
    return dbInstance;
}

export const SQLquery = (text, params) => getDb().query(text, params);