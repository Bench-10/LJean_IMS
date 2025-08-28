import * as deliveryServices from '../Services/delivery/deliveryServices.js';


export const getDeliveries = async (req, res) =>{
    try {

        const data = await deliveryServices.getDeliveryData();
        
        res.status(200).json(data);

    } catch (error) {
        console.error('Error fetching delivery data: ', error);
        res.status(500).json({message: 'Internal Server Error'});

    }
    
}


export const addDeliveries = async (req, res) => {
    try {
        const newDeliveryData = req.body;
        const data = await deliveryServices.addDeliveryData(newDeliveryData);
        res.status(200).json(data);

    } catch (error) {
        console.error('Error adding new delivery data: ', error);
        res.status(500).json({message: 'Internal Server Error'});

    }
    
}


export const updateDeliveries = async (req, res) => {
    try {
        const saleID = req.params.id;
        const update = req.body;
        const data = await deliveryServices.setToDelivered(saleID, update);
        res.status(200).json(data);

    } catch (error) {
        console.error('Error setting to delivered data: ', error);
        res.status(500).json({message: 'Internal Server Error'});

    }
    
}