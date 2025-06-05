import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import itemRoutes from './Routes/itemRoutes.js';

const app  = express();


dotenv.config();

app.use(cors());

app.use(express.json());

const PORT = process.env.PORT;

app.use('/api', itemRoutes);

app.listen(PORT, ()=>{
    console.log('Port '+ PORT + ' is currently running....' )
});


app.get("/", (req, res) =>{
    res.send("hello from the backend");
})