import { SQLquery } from "../../db.js";
import { broadcastNotification } from "../../server.js";

/**
 * SERVICE FOR HANDLING DELIVERY-RELATED NOTIFICATIONS
 * Ensures all delivery notifications are properly saved to database and broadcast
 */

export const createDeliveryNotification = async (notificationData) => {
    const {
        branchId,
        alertType,
        message,
        bannerColor,
        userId = null,
        userFullName = 'System',
        targetRoles = ['Sales Associate', 'Delivery Personnel'],
        creatorId = null,
        saleId = null,
        deliveryId = null,
        category = 'delivery',
        highlightContext = null
    } = notificationData;

    const normalizedSaleId = saleId !== null && saleId !== undefined ? Number(saleId) : null;
    const normalizedDeliveryId = deliveryId !== null && deliveryId !== undefined ? Number(deliveryId) : null;

    try {
        // INSERT NOTIFICATION INTO DATABASE
        const alertResult = await SQLquery(
            `INSERT INTO Inventory_Alerts 
            (product_id, branch_id, alert_type, message, banner_color, user_id, user_full_name, alert_date)
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
            RETURNING *`,
            [null, branchId, alertType, message, bannerColor, userId, userFullName]
        );

        if (alertResult.rows[0]) {
            const alert = alertResult.rows[0];

            if (normalizedSaleId !== null || normalizedDeliveryId !== null) {
                try {
                    await SQLquery(
                        `INSERT INTO inventory_alert_sale_links (alert_id, sales_information_id, delivery_id, updated_at)
                         VALUES ($1, $2, $3, NOW())
                         ON CONFLICT (alert_id) DO UPDATE
                         SET sales_information_id = EXCLUDED.sales_information_id,
                             delivery_id = EXCLUDED.delivery_id,
                             updated_at = NOW()` ,
                        [alert.alert_id, normalizedSaleId, normalizedDeliveryId]
                    );
                } catch (linkError) {
                    console.error('❌ Failed to link delivery notification:', linkError.message);
                }
            }
            
            console.log(`✅ Delivery notification saved to database:`, {
                alert_id: alert.alert_id,
                alert_type: alertType,
                branch_id: branchId,
                message: message.substring(0, 50) + '...'
            });

            // BROADCAST VIA WEBSOCKET
            broadcastNotification(branchId, {
                alert_id: alert.alert_id,
                alert_type: alertType,
                message: message,
                banner_color: bannerColor,
                user_id: alert.user_id,
                user_full_name: userFullName,
                alert_date: alert.alert_date,
                isDateToday: true,
                alert_date_formatted: 'Just now',
                sales_information_id: normalizedSaleId,
                delivery_id: normalizedDeliveryId,
                category,
                highlight_context: highlightContext ?? {
                    context: 'delivery-update',
                    sale_id: normalizedSaleId,
                    delivery_id: normalizedDeliveryId
                },
                target_roles: targetRoles,
                creator_id: creatorId
            }, { category, excludeUserId: creatorId });

            console.log(`📡 Delivery notification broadcast via WebSocket to branch ${branchId}`);
            
            return alert;
        }
        
        throw new Error('Failed to create alert record');
        
    } catch (error) {
        console.error(`❌ Error creating delivery notification:`, error);
        throw error;
    }
};

export const createNewDeliveryNotification = async (saleId, deliveryId, courierName, address, branchId, userId, userFullName) => {
    return createDeliveryNotification({
        branchId,
        alertType: 'New Delivery',
        message: `New delivery assigned to ${courierName} for sale ${saleId} - Destination: ${address}`,
        bannerColor: 'purple',
        userId,
        userFullName: userFullName || courierName,
        creatorId: userId,
        saleId,
        deliveryId,
        category: 'delivery',
        highlightContext: {
            context: 'delivery-created',
            sale_id: saleId,
            delivery_id: deliveryId
        }
    });
};

export const createDeliveryStatusNotification = async (saleId, status, courierName, branchId, userId, userFullName, deliveryId = null) => {
    const statusText = status.is_delivered ? 'Delivered' : status.pending ? 'Out for Delivery' : 'Undelivered';
    
    return createDeliveryNotification({
        branchId,
        alertType: 'Delivery Status Update',
        message: `Delivery status changed for sale ${saleId} - ${statusText} ${courierName ? `by ${courierName}` : ''}`,
        bannerColor: status.is_delivered ? 'green' : status.pending ? 'orange' : 'red',
        userId,
        userFullName: userFullName || courierName || 'System',
        creatorId: userId,
        saleId,
        deliveryId,
        category: 'delivery',
        highlightContext: {
            context: 'delivery-status-update',
            sale_id: saleId,
            delivery_id: deliveryId,
            status: statusText
        }
    });
};

export const createDeliveryStockNotification = async (saleId, action, branchId, userId, userFullName, deliveryId = null) => {
    const messages = {
        'stock_restored': `Stock restored for sale ${saleId} due to delivery cancellation`,
        'stock_deducted': `Stock deducted for sale ${saleId} due to delivery activation`,
        'stock_rededucted': `Stock re-deducted for sale ${saleId} due to delivery confirmation`
    };

    return createDeliveryNotification({
        branchId,
        alertType: 'Inventory Update',
        message: messages[action] || `Stock updated for sale ${saleId}`,
        bannerColor: 'yellow',
        userId,
        userFullName: userFullName || 'System',
        targetRoles: ['Sales Associate', 'Delivery Personnel'],
        creatorId: userId,
        saleId,
        deliveryId,
        category: 'delivery',
        highlightContext: {
            context: 'delivery-stock-change',
            sale_id: saleId,
            delivery_id: deliveryId,
            action
        }
    });
};