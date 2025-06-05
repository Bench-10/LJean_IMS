import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';

const  app  = express();


dotenv.config();

app.use(cors());

app.use(express.json());

const PORT = process.env.PORT;





app.listen(PORT, ()=>{
    console.log('hello from port '+ PORT )
});


app.get("/", (req, res) =>{
    res.send("hello from the backend");
})