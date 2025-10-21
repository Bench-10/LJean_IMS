import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// THIS PREVENTS MAXLISTENERS WARNING WHICH MAY CAUSE MEMORY LEAKS
let dbInstance;
function getDb() {
    if (!dbInstance) {
        const isProduction = process.env.NODE_ENV === 'production';

        const connectionOptions = process.env.DATABASE_URL ? {
            connectionString: process.env.DATABASE_URL,
            // Many hosted Postgres providers require SSL. In production we enable
            // SSL but skip strict certificate verification by default. If you
            // have a valid CA bundle, adjust accordingly.
            ssl: isProduction ? { rejectUnauthorized: false } : false,
            max: 20,
            connectionTimeoutMillis: 10000,
            idleTimeoutMillis: 60000,
            query_timeout: 60000
        } : {
            user: process.env.PG_USER,
            host: process.env.PG_HOST,
            database: process.env.PG_DATABASE,
            password: process.env.PG_PASSWORD,
            port: process.env.PG_PORT,
            max: 20,
            connectionTimeoutMillis: 10000,
            idleTimeoutMillis: 60000,
            query_timeout: 60000
        };

        dbInstance = new pg.Pool(connectionOptions);

        dbInstance.on('error', (err) => {
            console.error('Unexpected Error', err);
            process.exit(-1);
        });
    }
    return dbInstance;
}

export const SQLquery = (text, params) => getDb().query(text, params);