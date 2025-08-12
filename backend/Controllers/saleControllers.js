import * as saleServices from '../Services/sale/saleServices.js';



//SALES CONTROLLERS
export const getAllSaleInformation = async (req, res) =>{
    try {
        const branchId = req.query.branch_id;
        const items = await saleServices.viewSale(branchId);
        res.status(200).json(items);
    } catch (error) {
        console.error('Error fetching items: ', error);
        res.status(500).jason({message: 'Internal Server Error'})
    }
};



export const addSaleInformation = async (req, res) =>{
    try {
        const branchId = req.query.branch_id;
        const items = await saleServices.addSale(branchId);
        res.status(200).json(items);
    } catch (error) {
        console.error('Error fetching items: ', error);
        res.status(500).jason({message: 'Internal Server Error'})
    }
};