import * as saleServices from '../Services/sale/saleServices.js';



//SALES CONTROLLERS
export const getAllSaleInformation = async (req, res) =>{
    try {
        const branchId = req.query.branch_id;
        const items = await saleServices.viewSale(branchId);
        res.status(200).json(items);
    } catch (error) {
        console.error('Error fetching sale information: ', error);
        res.status(500).json({message: 'Internal Server Error'})
    }
};



export const getAllSaleItems = async (req, res) =>{
    try {
        const saleId = req.query.sale_id;
        const items = await saleServices.viewSelectedItem(saleId);
        res.status(200).json(items);
    } catch (error) {
        console.error('Error fetching items: ', error);
        res.status(500).json({message: 'Internal Server Error'})
    }
};



export const addSaleInformation = async (req, res) =>{
    try {
        const sales = req.body;
        const items = await saleServices.addSale(sales);
        res.status(200).json(items);
    } catch (error) {
        console.error('Error fetching sale items: ', error);
        res.status(500).json({message: 'Internal Server Error'})
    }
};