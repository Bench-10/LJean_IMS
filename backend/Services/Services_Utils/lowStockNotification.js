import { SQLquery } from "../../db.js";
import { broadcastNotification } from "../../server.js";
import { sendPushForAlert } from "../products/notificationServices.js";





export const checkAndHandleLowStock = async (productId, branchId, options = {}) => {
  if (!productId || !branchId) return;

  const { triggeredByUserId = null, triggerUserName = 'System' } = options;

  const { rows } = await SQLquery(
    `SELECT 
        ip.product_id,
        ip.product_name,
        ip.min_threshold,
        ip.max_threshold,
        ip.low_stock_notified,
        ip.branch_id,
        COALESCE(SUM(CASE WHEN ast.product_validity IS NOT NULL AND ast.product_validity <> '9999-12-31' AND ast.product_validity < NOW() THEN 0 ELSE ast.quantity_left_display END), 0) AS quantity
      FROM Inventory_Product ip
      LEFT JOIN Add_Stocks ast ON ast.product_id = ip.product_id AND ast.branch_id = ip.branch_id
      WHERE ip.product_id = $1 AND ip.branch_id = $2
      GROUP BY ip.product_id, ip.product_name, ip.min_threshold, max_threshold, ip.low_stock_notified, ip.branch_id`,
    [productId, branchId]
  );

  if (rows.length === 0) {
    return;
  }

  const {
    product_name: productName,
    min_threshold,
    low_stock_notified: lowStockNotified,
    branch_id: dbBranchId,
    quantity
  } = rows[0];
  
  // NORMALIZE NUMERIC VALUES
  const currentQuantity = Number(quantity ?? 0);
  const thresholdValue = Number(min_threshold ?? 0);
  const alreadyNotified = Boolean(lowStockNotified);

  if (Number.isNaN(thresholdValue)) {
    return; // NO THRESHOLD DEFINED; NOTHING TO DO
  }

  // WHEN QUANTITY DROPS TO/BELOW THRESHOLD, SEND NOTIFICATION ONCE
  if (currentQuantity <= thresholdValue) {
    if (!alreadyNotified) {
      await SQLquery('UPDATE Inventory_Product SET low_stock_notified = TRUE WHERE product_id = $1 AND branch_id = $2', [productId, branchId]);

      const message = `${productName} is low on stock (${currentQuantity} remaining).`;

      const alertResult = await SQLquery(
        `INSERT INTO Inventory_Alerts 
            (product_id, branch_id, alert_type, message, banner_color, user_id, user_full_name)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING *`,
        [productId, branchId, 'Low Stock Alert', message, 'red', triggeredByUserId, triggerUserName]
      );

      if (alertResult.rows[0]) {
        const alertData = {
          alert_id: alertResult.rows[0].alert_id,
          alert_type: 'Low Stock Alert',
          message,
          banner_color: 'red',
          user_id: alertResult.rows[0].user_id,
          user_full_name: triggerUserName,
          alert_date: alertResult.rows[0].alert_date,
          isDateToday: true,
          alert_date_formatted: 'Just now',
          target_roles: ['Branch Manager', 'Inventory Staff'],
          creator_id: triggeredByUserId,
          product_id: productId,
          branch_id: branchId
        };

        // Broadcast WebSocket notification
        broadcastNotification(branchId, alertData);

        // Send push notification
        sendPushForAlert(alertResult.rows[0]);
      }

    }


  } else if (alreadyNotified) {

    // QUANTITY RECOVERED ABOVE THRESHOLD; RESET FLAG SO FUTURE DROPS NOTIFY AGAIN
    await SQLquery('UPDATE Inventory_Product SET low_stock_notified = FALSE WHERE product_id = $1 AND branch_id = $2', [productId, branchId]);

  }

};
