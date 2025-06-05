import * as itemServices from '../Services/itemServices.js';

export const getAllItems = async (req, res) =>{
    try {
        const items = await itemServices.getProductItems();
        res.status(200).json(items);
    } catch (error) {
        console.error('Error fetching items: ', error);
        res.status(500).jason({message: 'Internal Server Error'})
        
    }
};