import dayjs from "dayjs";



export default async function randomSaleID(){

    const year = dayjs().format("YYYY");

    const month = dayjs().format("MM");

    const day = dayjs().format("DD");


    let productId;

    let isUnique = false;
    

    while (!isUnique) {
        const random_id = Math.floor(10000 + Math.random() * 90000); 

        productId = Number(year+month+day+random_id)

        const check = await SQLquery('SELECT 1 FROM Users WHERE user_id = $1', [productId]);//modify later
        if (check.rowCount === 0) isUnique = true;
    }


    return productId;
       
}