import { SQLquery } from "../../db.js";

/**
 * VERIFICATION SERVICE FOR DELIVERY NOTIFICATIONS
 * Use this to check if delivery notifications are properly saved in database
 */

export const verifyDeliveryNotifications = async (branchId, limit = 10) => {
    try {
        const {rows} = await SQLquery(`
            SELECT 
                alert_id,
                alert_type,
                message,
                banner_color,
                user_id,
                user_full_name,
                alert_date,
                branch_id
            FROM Inventory_Alerts
            WHERE branch_id = $1 
            AND alert_type IN ('New Delivery', 'Delivery Status Update', 'Delivery Update', 'Inventory Update')
            ORDER BY alert_date DESC
            LIMIT $2
        `, [branchId, limit]);

        console.log(`📊 Found ${rows.length} delivery-related notifications in database for branch ${branchId}:`);
        
        rows.forEach((notification, index) => {
            console.log(`${index + 1}. [${notification.alert_id}] ${notification.alert_type}: ${notification.message.substring(0, 80)}...`);
        });

        return rows;
    } catch (error) {
        console.error(`❌ Error verifying delivery notifications:`, error);
        throw error;
    }
};

export const getDeliveryNotificationStats = async (branchId) => {
    try {
        const {rows} = await SQLquery(`
            SELECT 
                alert_type,
                COUNT(*) as count,
                MAX(alert_date) as latest_notification
            FROM Inventory_Alerts
            WHERE branch_id = $1 
            AND alert_type IN ('New Delivery', 'Delivery Status Update', 'Delivery Update', 'Inventory Update')
            GROUP BY alert_type
            ORDER BY count DESC
        `, [branchId]);

        console.log(`📈 Delivery notification statistics for branch ${branchId}:`);
        rows.forEach(stat => {
            console.log(`   - ${stat.alert_type}: ${stat.count} notifications (latest: ${stat.latest_notification})`);
        });

        return rows;
    } catch (error) {
        console.error(`❌ Error getting delivery notification stats:`, error);
        throw error;
    }
};

export const testDeliveryNotificationSystem = async (branchId = 1) => {
    console.log(`🧪 Testing delivery notification system for branch ${branchId}...`);
    
    try {
        // Check recent notifications
        await verifyDeliveryNotifications(branchId, 5);
        
        // Get statistics
        await getDeliveryNotificationStats(branchId);
        
        // Test database connection
        const {rows} = await SQLquery(`
            SELECT COUNT(*) as total_alerts
            FROM Inventory_Alerts
            WHERE branch_id = $1
        `, [branchId]);
        
        console.log(`✅ Total alerts in database for branch ${branchId}: ${rows[0].total_alerts}`);
        console.log(`✅ Delivery notification system test completed successfully`);
        
        return true;
    } catch (error) {
        console.error(`❌ Delivery notification system test failed:`, error);
        return false;
    }
};