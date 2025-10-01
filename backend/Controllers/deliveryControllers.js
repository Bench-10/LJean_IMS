import * as deliveryServices from '../Services/delivery/deliveryServices.js';
import { testDeliveryNotificationSystem, verifyDeliveryNotifications } from '../Services/delivery/deliveryNotificationVerification.js';


export const getDeliveries = async (req, res) =>{
    try {
        const branchId = req.query.branch_id;
        const data = await deliveryServices.getDeliveryData(branchId);
        
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

// TEST ENDPOINT TO VERIFY DELIVERY NOTIFICATIONS ARE SAVED TO DATABASE
export const testDeliveryNotifications = async (req, res) => {
    try {
        const branchId = req.query.branch_id || 1;
        console.log(`🔍 Testing delivery notifications for branch ${branchId}...`);
        
        const testResult = await testDeliveryNotificationSystem(branchId);
        const recentNotifications = await verifyDeliveryNotifications(branchId, 10);
        
        res.status(200).json({
            success: testResult,
            message: testResult ? 'Delivery notification system working correctly' : 'Issues detected with delivery notification system',
            recent_notifications: recentNotifications,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error testing delivery notifications: ', error);
        res.status(500).json({
            success: false,
            message: 'Error testing delivery notification system',
            error: error.message
        });
    }
}