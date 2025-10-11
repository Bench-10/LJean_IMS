import { SQLquery } from '../db.js';
import * as categoryServices from '../Services/products/categoryServices.js';
import * as inventoryServices from '../Services/products/inventoryServices.js';
import * as productHistoryServices from '../Services/products/productHistoryServices.js';
import * as productValidityServices from '../Services/products/productValidityServices.js';
import * as notificationServices from '../Services/products/notificationServices.js';



//INVENTORY CONTROLLERS
export const getAllItems = async (req, res) =>{
    try {
        const branchId = req.query.branch_id;
        const items = await inventoryServices.getProductItems(branchId);
        res.status(200).json(items);
    } catch (error) {
        console.error('Error fetching items: ', error);
        res.status(500).json({message: 'Internal Server Error'})
    }
};



export const addItem = async (req, res) =>{
    try {
        const addedItemData = req.body;
        const result = await inventoryServices.addProductItem(addedItemData);

        if (result.status === 'pending') {
            return res.status(202).json(result);
        }

        res.status(200).json(result.product);
    } catch (error) {
        await SQLquery('ROLLBACK');

        if (error.message && error.message.includes('Product already exists')) {
            return res.status(409).json({
                message: 'Product already exists in this branch',
                error: error.message
            });
        }
        
        res.status(500).json({message: 'Internal Server Error'});
    }
};



export const updateItem = async (req, res) =>{
    try {
        const itemId = req.params.id;
        const updatedItemData = req.body;
        const result = await inventoryServices.updateProductItem(updatedItemData, itemId);

        if (result.status === 'pending') {
            return res.status(202).json(result);
        }

        if (!result?.product){
            send.res.status(404).json({message: 'Item no found'})
        }

        res.status(200).json(result.product);
    } catch (error) {
        await SQLquery('ROLLBACK');
        console.error('Error fetching items: ', error);
        res.status(500).json({message: 'Internal Server Error'});
        
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

export const getAllUniqueProducts = async (req, res) => {
    try {
        const uniqueProducts = await inventoryServices.getAllUniqueProducts();
        res.status(200).json(uniqueProducts);
    } catch (error) {
        console.error('Error fetching unique products: ', error);
        res.status(500).json({message: 'Internal Server Error'});
    }
};


export const getPendingInventoryRequests = async (req, res) => {
    try {
        const branchId = req.query.branch_id;

        if (!branchId) {
            return res.status(400).json({ message: 'branch_id is required' });
        }

        const pending = await inventoryServices.getPendingInventoryRequests(branchId);
        res.status(200).json(pending);
    } catch (error) {
        console.error('Error fetching pending inventory requests: ', error);
        res.status(500).json({message: 'Internal Server Error'});
    }
};


export const approvePendingInventoryRequest = async (req, res) => {
    try {
        const pendingId = req.params.id;
        const { approver_id } = req.body;

        if (!approver_id) {
            return res.status(400).json({ message: 'approver_id is required' });
        }

        const result = await inventoryServices.approvePendingInventoryRequest(Number(pendingId), Number(approver_id));
        res.status(200).json(result);
    } catch (error) {
        console.error('Error approving inventory request: ', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};


export const rejectPendingInventoryRequest = async (req, res) => {
    try {
        const pendingId = req.params.id;
        const { approver_id, reason } = req.body;

        if (!approver_id) {
            return res.status(400).json({ message: 'approver_id is required' });
        }

        const result = await inventoryServices.rejectPendingInventoryRequest(Number(pendingId), Number(approver_id), reason);
        res.status(200).json(result);
    } catch (error) {
        console.error('Error rejecting inventory request: ', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};





//CATEGORY CONTROLLERS
export const getAllCategories = async (req, res) =>{
     try {
        const categories = await categoryServices.getAllCategories();
        res.status(200).json(categories);
    } catch (error) {
        console.error('Error fetching list of categories: ', error);
        res.status(500).json({message: 'Internal Server Error'})
    }
}


export const addCAtegory = async (req, res) => {
    try {
        const addCategoryData = req.body;
        const categories = await categoryServices.addListCategory(addCategoryData);
        res.status(200).json(categories);
    } catch (error) {
        console.error('Error fetching items: ', error);
        res.status(500).json({message: 'Internal Server Error'});
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
        res.status(500).json({message: 'Internal Server Error'});
    }
}





//PRODUCT HISTORY
export const getAllProductHistory = async (req, res) =>{
    try {
        const branchId = req.query.branch_id;
        const dates = req.body;
        const itemsHistory = await productHistoryServices.getProductHistory(dates, branchId);
        res.status(200).json(itemsHistory);
    } catch (error) {
        console.error('Error fetching items: ', error);
        res.status(500).json({message: 'Internal Server Error'})
    }
};





//PRODUCT VALIDITY
export const getAllProductValidity = async (req, res) =>{
    try {
        const branchId = req.query.branch_id;
        const itemsValidity = await productValidityServices.getProductValidity(branchId);
        res.status(200).json(itemsValidity);
    } catch (error) {
        console.error('Error fetching items: ', error);
        res.status(500).json({message: 'Internal Server Error'})
    }
};





export const getNotification = async (req, res) =>{
    try { 
        const hireDate = req.query.hire_date;
        const userId = req.query.user_id;
        const branchId = req.query.branch_id;
        const userType = req.query.user_type ?? 'user';
        const adminId = req.query.admin_id ?? null;

        const notification = await notificationServices.returnNotification({
            branchId,
            userId,
            hireDate,
            userType,
            adminId
        });
        res.status(200).json(notification);
    } catch (error) {
        console.error('Error fetching notifications: ', error);
        res.status(500).json({message: 'Internal Server Error'})
    }
};





export const markRead = async (req, res) =>{
    try {
        const userAndAlertID = req.body;
        const mark = await notificationServices.markAsRead(userAndAlertID);
        res.status(200).json(mark);
    } catch (error) {
        console.error('Error: ', error);
        res.status(500).json({message: 'Internal Server Error'})
    }
};




export const markAllRead = async (req, res) => {
    try {
        const { user_id, branch_id, hire_date, user_type = 'user', admin_id = null } = req.body;

        if (user_type === 'admin') {
            if (!admin_id) {
                return res.status(400).json({ message: 'admin_id is required for admin notifications' });
            }

            const markedCount = await notificationServices.markAllAsRead({
                userId: null,
                branchId: null,
                hireDate: null,
                userType: 'admin',
                adminId: admin_id
            });

            return res.status(200).json({ 
                message: `${markedCount} notifications marked as read`,
                markedCount: markedCount 
            });
        }

        if (!user_id || !branch_id || !hire_date) {
            return res.status(400).json({ message: 'user_id, branch_id, and hire_date are required' });
        }

        const markedCount = await notificationServices.markAllAsRead({
            userId: user_id,
            branchId: branch_id,
            hireDate: hire_date,
            userType: 'user'
        });

        res.status(200).json({ 
            message: `${markedCount} notifications marked as read`,
            markedCount: markedCount 
        });

    } catch (error) {

        console.error('Error marking all notifications as read: ', error);
        res.status(500).json({ message: 'Internal Server Error' });

    }

};