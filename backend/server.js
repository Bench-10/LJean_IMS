import express from 'express';
import dotenv from 'dotenv';


dotenv.config();

const PORT = process.env.PORT;

const  app  = express();


app.listen(PORT, ()=>{
    console.log('hello from port '+ PORT )
});


app.get("/", (req, res) =>{
    res.send("hello from the backend");
})