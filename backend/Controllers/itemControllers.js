import { SQLquery } from '../db.js';
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



export const addItem = async (req, res) =>{
    try {
        const addedItemData = req.body;
        const newItem = await itemServices.addProductItem(addedItemData);
        res.status(200).json(newItem);
    } catch (error) {
        await SQLquery('ROLLBACK');
        console.error('Error fetching items: ', error);
        res.status(500).jason({message: 'Internal Server Error'});
        
    }
};



export const updateItem = async (req, res) =>{
    try {

        const itemId = req.params.id;
        const updatedItemData = req.body;
        const updatedItem = await itemServices.updateProductItem(updatedItemData, itemId);

        if (!updatedItem){
            send.res.status(404).json({message: 'Item no found'})
        }

        res.status(200).json(updatedItem);
    } catch (error) {
        await SQLquery('ROLLBACK');
        console.error('Error fetching items: ', error);
        res.status(500).jason({message: 'Internal Server Error'});
        
    }
};


