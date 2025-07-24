import { SQLquery } from '../db.js';
import * as categoryServices from '../Services/products/categoryServices.js';
import * as inventoryServices from '../Services/products/inventoryServices.js';
import * as productHistoryServices from '../Services/products/productHistoryServices.js';
import * as productValidityServices from '../Services/products/productValidityServices.js';
import * as notificationServices from '../Services/products/notificationServices.js';



//INVENTORY CONTROLLERS
export const getAllItems = async (req, res) =>{
    try {
        const items = await inventoryServices.getProductItems();
        res.status(200).json(items);
    } catch (error) {
        console.error('Error fetching items: ', error);
        res.status(500).jason({message: 'Internal Server Error'})
    }
};



export const addItem = async (req, res) =>{
    try {
        const addedItemData = req.body;
        const newItem = await inventoryServices.addProductItem(addedItemData);
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
        const updatedItem = await inventoryServices.updateProductItem(updatedItemData, itemId);

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



export const searchItem = async (req, res) =>{
    try {
        const searchItem = req.query.q;
        const item = await inventoryServices.searchProductItem(searchItem);
        res.status(200).json(item);
    } catch (error) {
        console.error('Error fetching items: ', error);
        res.status(500).json({message: 'Internal Server Error'});
        
    }
}





//CATEGORY CONTROLLERS
export const getAllCategories = async (req, res) =>{
     try {
        const categories = await categoryServices.getAllCategories();
        res.status(200).json(categories);
    } catch (error) {
        console.error('Error fetching list of categories: ', error);
        res.status(500).jason({message: 'Internal Server Error'})
    }
}


export const addCAtegory = async (req, res) => {
    try {
        const addCategoryData = req.body;
        const categories = await categoryServices.addListCategory(addCategoryData);
        res.status(200).json(categories);
    } catch (error) {
        console.error('Error fetching items: ', error);
        res.status(500).jason({message: 'Internal Server Error'});
    }
}


export const updateCategory = async (req, res) => {
    try {
        const categoryId = req.params.id;
        const updatedCategoryData = req.body;
        const categories = await categoryServices.updateListCategory(updatedCategoryData, categoryId);
        res.status(200).json(categories);
    } catch (error) {
        console.error('Error fetching items: ', error);
        res.status(500).jason({message: 'Internal Server Error'});
    }
}





//PRODUCT HISTORY
export const getAllProductHistory = async (req, res) =>{
    try {
        const dates = req.body;
        const itemsHistory = await productHistoryServices.getProductHistory(dates);
        res.status(200).json(itemsHistory);
    } catch (error) {
        console.error('Error fetching items: ', error);
        res.status(500).jason({message: 'Internal Server Error'})
    }
};





//PRODUCT VALIDITY
export const getAllProductValidity = async (req, res) =>{
    try {
        const itemsValidity = await productValidityServices.getProductValidity();
        res.status(200).json(itemsValidity);
    } catch (error) {
        console.error('Error fetching items: ', error);
        res.status(500).jason({message: 'Internal Server Error'})
    }
};





export const getNotification = async (req, res) =>{
    try {
        const itemsValidity = await notificationServices.returnNotification();
        res.status(200).json(itemsValidity);
    } catch (error) {
        console.error('Error fetching items: ', error);
        res.status(500).jason({message: 'Internal Server Error'})
    }
};