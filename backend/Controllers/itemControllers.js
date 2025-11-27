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

        if (error?.name === 'InventoryValidationError') {
            return res.status(400).json({ message: error.message });
        }

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
        if (error?.name === 'InventoryValidationError') {
            return res.status(400).json({ message: error.message });
        }
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
        const reviewLevel = req.query.review_level ?? 'manager';

        if (reviewLevel === 'admin') {
            const pendingForAdmin = await inventoryServices.getAdminPendingInventoryRequests();
            const branchFilter = req.query.branch_id;

            if (branchFilter) {
                const filtered = pendingForAdmin.filter(request => String(request.branch_id) === String(branchFilter));
                return res.status(200).json(filtered);
            }

            return res.status(200).json(pendingForAdmin);
        }

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


export const getInventoryRequestStatusFeed = async (req, res) => {
    try {
        const rawRoles = req.user?.role;
        const roles = Array.isArray(rawRoles) ? rawRoles : rawRoles ? [rawRoles] : [];
        const isOwner = roles.includes('Owner');
        const isBranchManager = roles.includes('Branch Manager');
        const isInventoryStaff = roles.includes('Inventory Staff');

        if (!isOwner && !isBranchManager && !isInventoryStaff) {
            return res.status(403).json({ message: 'Access denied' });
        }

        const defaultScope = isOwner ? 'admin' : isBranchManager ? 'branch' : 'user';
        const requestedScope = String(req.query.scope || '').toLowerCase();
        const scope = ['user', 'branch', 'admin'].includes(requestedScope) ? requestedScope : defaultScope;

        if (scope === 'admin' && !isOwner) {
            return res.status(403).json({ message: 'Owner access required for admin scope' });
        }

        const parsedBranchId = req.query.branch_id !== undefined && req.query.branch_id !== null && req.query.branch_id !== ''
            ? Number(req.query.branch_id)
            : null;

        if (parsedBranchId !== null && Number.isNaN(parsedBranchId)) {
            return res.status(400).json({ message: 'branch_id must be numeric' });
        }

        let effectiveBranchId = parsedBranchId;

        if (scope === 'branch') {
            const fallbackBranchId = req.user?.branch_id !== undefined ? Number(req.user.branch_id) : null;
            effectiveBranchId = parsedBranchId ?? fallbackBranchId;

            if (!effectiveBranchId) {
                return res.status(400).json({ message: 'branch_id is required for branch scope' });
            }

            if (!isOwner && String(effectiveBranchId) !== String(req.user.branch_id)) {
                return res.status(403).json({ message: 'Cannot view other branches' });
            }
        }

        const statuses = Array.isArray(req.query.status)
            ? req.query.status
            : typeof req.query.status === 'string' && req.query.status.trim().length > 0
                ? req.query.status.split(',').map(status => status.trim()).filter(Boolean)
                : null;

        const includePayload = String(req.query.include_payload || '').toLowerCase() === 'true';

        const limitParam = parseInt(req.query.limit, 10);
        const offsetParam = parseInt(req.query.offset, 10);
        const limit = Math.max(1, Math.min(Number.isNaN(limitParam) ? 20 : limitParam, 50));
        const offset = Math.max(0, Number.isNaN(offsetParam) ? 0 : offsetParam);
        const requesterId = req.user?.user_id ? Number(req.user.user_id) : null;

        if (scope === 'user' && !requesterId) {
            return res.status(400).json({ message: 'Unable to resolve requesting user' });
        }

        const rows = await inventoryServices.getInventoryRequestStatusFeed({
            scope,
            branchId: effectiveBranchId,
            requesterId,
            statuses,
            limit: limit + 1,
            offset,
            includePayload
        });

        const hasMore = rows.length > limit;
        const requests = hasMore ? rows.slice(0, limit) : rows;
        const lastEntry = requests[requests.length - 1];

        res.status(200).json({
            scope,
            filters: {
                branch_id: effectiveBranchId,
                statuses
            },
            meta: {
                limit,
                offset,
                count: requests.length,
                has_more: hasMore,
                next_cursor: hasMore && lastEntry ? `${lastEntry.pending_id}:${lastEntry.created_at || ''}` : null
            },
            requests
        });
    } catch (error) {
        console.error('Error fetching inventory request status feed:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};


export const approvePendingInventoryRequest = async (req, res) => {
    try {
        const pendingId = req.params.id;
        const { approver_id, admin_id, actor_type = 'manager' } = req.body;

        if (actor_type === 'admin') {
            if (!admin_id) {
                return res.status(400).json({ message: 'admin_id is required for owner approval' });
            }

            const result = await inventoryServices.approvePendingInventoryRequest(Number(pendingId), Number(admin_id), { actorType: 'admin' });
            return res.status(200).json(result);
        }

        if (!approver_id) {
            return res.status(400).json({ message: 'approver_id is required' });
        }

        const result = await inventoryServices.approvePendingInventoryRequest(Number(pendingId), Number(approver_id), { actorType: 'manager' });
        res.status(200).json(result);
    } catch (error) {
        console.error('Error approving inventory request: ', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};


export const rejectPendingInventoryRequest = async (req, res) => {
    try {
        const pendingId = req.params.id;
        const { approver_id, admin_id, reason, actor_type = 'manager' } = req.body;

        if (actor_type === 'admin') {
            if (!admin_id) {
                return res.status(400).json({ message: 'admin_id is required for owner rejection' });
            }

            const result = await inventoryServices.rejectPendingInventoryRequest(Number(pendingId), Number(admin_id), reason, { actorType: 'admin' });
            return res.status(200).json(result);
        }

        if (!approver_id) {
            return res.status(400).json({ message: 'approver_id is required' });
        }

        const result = await inventoryServices.rejectPendingInventoryRequest(Number(pendingId), Number(approver_id), reason, { actorType: 'manager' });
        res.status(200).json(result);
    } catch (error) {
        console.error('Error rejecting inventory request: ', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};


export const cancelPendingInventoryRequest = async (req, res) => {
    try {
        const pendingId = req.params.id;

        if (!pendingId) {
            return res.status(400).json({ message: 'pending_id is required' });
        }

        const requesterContext = req.user;

        if (!requesterContext || requesterContext.user_type !== 'user' || !requesterContext.user_id) {
            return res.status(403).json({ message: 'Only inventory users can cancel their requests' });
        }

        const result = await inventoryServices.cancelPendingInventoryRequest(
            Number(pendingId),
            Number(requesterContext.user_id),
            req.body?.reason ?? null
        );

        res.status(200).json(result);
    } catch (error) {
        const statusCode = error?.statusCode ?? (error?.message === 'Pending inventory request not found' ? 404 : 500);
        console.error('Error cancelling inventory request: ', error);
        res.status(statusCode).json({ message: error.message || 'Internal Server Error' });
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
        const rolesParam = req.query.role ?? req.query.roles ?? [];
        const roles = Array.isArray(rolesParam)
            ? rolesParam
            : (rolesParam ? [rolesParam] : []);

        const notification = await notificationServices.returnNotification({
            branchId,
            userId,
            hireDate,
            userType,
            adminId,
            roles
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
            userType: 'user',
            roles: req.user.role
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

export const requestPendingInventoryChanges = async (req, res) => {
    try {
        const pendingId = Number(req.params.id);
        const { approver_id, admin_id, change_type, comment, actor_type = 'manager' } = req.body;

        if (actor_type === 'admin') {
            if (!admin_id) {
                return res.status(400).json({ message: 'admin_id is required for owner change requests' });
            }

            const result = await inventoryServices.requestChangesPendingInventoryRequest(pendingId, Number(admin_id), change_type, comment, { actorType: 'admin' });
            return res.status(200).json(result);
        }

        if (!approver_id) {
            return res.status(400).json({ message: 'approver_id is required' });
        }

        const result = await inventoryServices.requestChangesPendingInventoryRequest(pendingId, Number(approver_id), change_type, comment, { actorType: 'manager' });
        res.status(200).json(result);
    } catch (error) {
        console.error('Error requesting modifications for inventory request:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

export const getPendingInventoryRequest = async (req, res) => {
    try {
        const pendingId = Number(req.params.id);
        if (!Number.isFinite(pendingId)) {
            return res.status(400).json({ message: 'Invalid pending id' });
        }
        const request = await inventoryServices.getPendingInventoryRequestById(pendingId);
        if (!request) return res.status(404).json({ message: 'Pending inventory request not found' });
        res.status(200).json(request);
    } catch (error) {
        console.error('Error fetching pending inventory request:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

export const resubmitPendingInventoryRequest = async (req, res) => {
    try {
        const pendingId = Number(req.params.id);
        const requesterContext = req.user;
        const productData = req.body;

        if (!requesterContext || (requesterContext.user_type !== 'user' && !requesterContext.user_id && !requesterContext.admin_id)) {
            return res.status(403).json({ message: 'Only inventory users may resubmit pending requests' });
        }

        const requesterId = requesterContext.user_id ?? requesterContext.admin_id ?? null;
        const result = await inventoryServices.resubmitPendingInventoryRequest(pendingId, requesterId, productData, { actingUser: requesterContext });
        res.status(200).json(result);
    } catch (error) {
        console.error('Error resubmitting pending inventory request:', error);
        const status = error?.statusCode ?? 500;
        res.status(status).json({ message: error?.message || 'Internal Server Error' });
    }
};