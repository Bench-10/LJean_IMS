import { SQLquery } from "../../db.js";
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime.js';
import isToday from 'dayjs/plugin/isToday.js';
import isYesterday from 'dayjs/plugin/isYesterday.js';
import { sendAlertPushNotification } from '../pushNotificationService.js';


const normalizeRoles = (roles) => {
  if (!roles) return [];
  if (Array.isArray(roles)) {
    return roles
      .map(role => (role === undefined || role === null ? null : String(role).trim()))
      .filter(Boolean);
  }

  if (typeof roles === 'string') {
    const trimmed = roles.trim();
    return trimmed ? [trimmed] : [];
  }

  return [];
};


//CONVERTS THE TIME TO EX: 2 hours ago, 1 minute ago, July, 3, 2025
dayjs.extend(relativeTime);
dayjs.extend(isToday);
dayjs.extend(isYesterday);

function formatTime(timestamp) {
  const now = dayjs();
  const then = dayjs(timestamp);
  const diffInMinutes = now.diff(then, 'minute');



  if (diffInMinutes < 1)
    return 'Just now';


  if (then.isToday())
    return then.fromNow();

        
  if (then.isYesterday())
    return 'Yesterday'

  
  return then.format('MMMM DD, YYYY'); 

}



export const returnNotification = async ({ branchId, userId, hireDate, userType = 'user', adminId = null, roles = [] }) => {
  if (userType === 'admin') {
    const { rows } = await SQLquery(`
      SELECT 
        ia.alert_id,
        ia.alert_type,
        ia.message,
        ia.alert_date,
        ia.banner_color,
        ia.user_full_name,
        ia.user_id,
        ia.product_id,
        ia.branch_id,
        iahl.add_id AS add_stock_id,
        iahl.history_timestamp,
        iahl.alert_timestamp,
        iasl.sales_information_id AS linked_sales_information_id,
        iasl.delivery_id AS linked_delivery_id,
        COALESCE(an.is_read, false) AS is_read
      FROM Inventory_Alerts ia
      LEFT JOIN inventory_alert_history_links iahl ON ia.alert_id = iahl.alert_id
      LEFT JOIN inventory_alert_sale_links iasl ON ia.alert_id = iasl.alert_id
      LEFT JOIN admin_notification an
        ON ia.alert_id = an.alert_id AND an.admin_id = $1
      WHERE ia.alert_type IN ('User Approval Needed', 'Inventory Admin Approval Needed')
      ORDER BY ia.alert_date DESC
      LIMIT 100
    `, [adminId]);

    return rows.map((row) => {
      const { linked_sales_information_id: saleId, linked_delivery_id: deliveryId, ...rest } = row;

      const highlightContext = saleId || deliveryId ? {
        context: 'admin-notification-link',
        sale_id: saleId,
        delivery_id: deliveryId
      } : null;

      return {
        ...rest,
        sales_information_id: saleId,
        delivery_id: deliveryId,
        highlight_context: highlightContext,
        alert_date_formatted: formatTime(row.alert_date),
        isDateToday: dayjs(row.alert_date).isToday()
      };
    });
  }

  const normalizedRoles = normalizeRoles(roles);
  const roleSet = new Set(normalizedRoles);
  const hasSalesAssociate = roleSet.has('Sales Associate');
  const hasNonSalesAssociateRole = Array.from(roleSet).some(role => role !== 'Sales Associate');
  const isSalesAssociateOnly = hasSalesAssociate && !hasNonSalesAssociateRole;

  const disallowedTypes = new Set();

  if (!roleSet.has('Owner')) {
    disallowedTypes.add('User Approval Needed');
    disallowedTypes.add('Inventory Admin Approval Needed');
  }

  if (!roleSet.has('Branch Manager')) {
    disallowedTypes.add('Inventory Approval Needed');
  }

  // Filter sales and delivery notifications by role
  if (isSalesAssociateOnly) {
    // Sales associates with no extra roles should only see sales-related notifications
    disallowedTypes.add('New Product');
    disallowedTypes.add('Product Update');
    disallowedTypes.add('Inventory Approval Needed');
    disallowedTypes.add('Inventory Admin Approval Needed');
    disallowedTypes.add('Product Update Approved');
    disallowedTypes.add('Inventory Request Approved');
    disallowedTypes.add('Inventory Request Rejected');
    disallowedTypes.add('Inventory Update');
    disallowedTypes.add('Near Expired');
    disallowedTypes.add('Expired');
    disallowedTypes.add('Low Stock Alert');
    

  }

  if (roleSet.has('Branch Manager') || roleSet.has('Inventory Staff')) {
    // Branch managers and inventory staff should not see sales and delivery notifications
    disallowedTypes.add('New Sale');
    disallowedTypes.add('Delivery Status Update');
    disallowedTypes.add('New Delivery');
    disallowedTypes.add('Inventory Update'); // This covers delivery stock notifications
  }

  const { rows } = await SQLquery(`
    SELECT 
      ia.alert_id, 
      ia.alert_type,
      ia.message, 
      ia.alert_date, 
      ia.banner_color, 
      COALESCE(un.is_read, false) AS is_read, 
      ia.user_full_name, 
      ia.user_id,
      ia.product_id,
      ia.branch_id,
      iahl.add_id AS add_stock_id,
      iahl.history_timestamp,
      iahl.alert_timestamp,
      iasl.sales_information_id AS linked_sales_information_id,
      iasl.delivery_id AS linked_delivery_id
    FROM Inventory_Alerts ia
    LEFT JOIN inventory_alert_history_links iahl ON ia.alert_id = iahl.alert_id
    LEFT JOIN inventory_alert_sale_links iasl ON ia.alert_id = iasl.alert_id
    LEFT JOIN LATERAL (
      SELECT un_inner.is_read
      FROM user_notification un_inner
      WHERE un_inner.alert_id = ia.alert_id
        AND un_inner.user_id = $1
      ORDER BY un_inner.is_read DESC
      LIMIT 1
    ) un ON TRUE
    WHERE ia.branch_id = $2
      AND ia.alert_date >= $3
      AND (
        ia.user_id = 0 OR ia.user_id IS NULL
        OR (ia.user_id = $4 AND ia.alert_type NOT IN ('New Sale', 'Delivery Status Update', 'New Delivery', 'Inventory Update'))
        OR (ia.user_id != $4 AND ia.alert_type IN ('New Sale', 'Delivery Status Update', 'New Delivery', 'Inventory Update'))
        OR (ia.alert_type IN ('Low Stock Alert', 'Near Expired', 'Expired') AND $6 = TRUE)
      )
      ${disallowedTypes.size > 0 ? 'AND NOT (ia.alert_type = ANY($5::text[]))' : ''}
    ORDER BY ia.alert_date DESC;
    `, disallowedTypes.size > 0
      ? [userId, branchId, hireDate, userId, Array.from(disallowedTypes), (roleSet.has('Branch Manager') || roleSet.has('Inventory Staff'))]
      : [userId, branchId, hireDate, userId, (roleSet.has('Branch Manager') || roleSet.has('Inventory Staff'))]
  );

  return rows.map((row) => {
    const { linked_sales_information_id: saleId, linked_delivery_id: deliveryId, ...rest } = row;
    const highlightContext = saleId || deliveryId ? {
      context: 'notification-link',
      sale_id: saleId,
      delivery_id: deliveryId
    } : null;

    return {
      ...rest,
      sales_information_id: saleId,
      delivery_id: deliveryId,
      highlight_context: highlightContext,
      alert_date_formatted: formatTime(row.alert_date),
      isDateToday: dayjs(row.alert_date).isToday()
    };
  });
};



//MARKS THE NOTIFICATION AS READ IN THE DATABASE
export const markAsRead = async (userAndAlertID) =>{
  const { alert_id, user_id = null, user_type = 'user', admin_id = null } = userAndAlertID;

  if (user_type === 'admin' && admin_id) {
    await SQLquery(
      `INSERT INTO admin_notification(admin_id, alert_id, is_read)
       VALUES ($1, $2, TRUE)
       ON CONFLICT (admin_id, alert_id) DO UPDATE SET is_read = TRUE`,
      [admin_id, alert_id]
    );
    return;
  }

  await SQLquery(
    `INSERT INTO user_notification(user_id, alert_id, is_read)
     VALUES ($1, $2, TRUE)
     ON CONFLICT (user_id, alert_id) DO UPDATE SET is_read = TRUE`,
    [user_id, alert_id]
  );
};

//MARKS ALL NOTIFICATIONS AS READ FOR A USER
export const markAllAsRead = async ({ userId, branchId, hireDate, userType = 'user', adminId = null, roles = [] }) => {
  if (userType === 'admin' && adminId) {
    const { rows: adminAlerts } = await SQLquery(`
      SELECT alert_id
      FROM Inventory_Alerts
      WHERE alert_type IN ('User Approval Needed', 'Inventory Admin Approval Needed')
    `);

    if (adminAlerts.length === 0) {
      return 0;
    }

    await SQLquery(
      `INSERT INTO admin_notification(admin_id, alert_id, is_read)
       SELECT $1, ia.alert_id, TRUE
       FROM Inventory_Alerts ia
       WHERE ia.alert_type IN ('User Approval Needed', 'Inventory Admin Approval Needed')
       ON CONFLICT (admin_id, alert_id) DO UPDATE SET is_read = TRUE`,
      [adminId]
    );

    return adminAlerts.length;
  }

  const normalizedRoles = normalizeRoles(roles);
  const roleSet = new Set(normalizedRoles);

  const { rows: unreadAlerts } = await SQLquery(`
      SELECT ia.alert_id
      FROM Inventory_Alerts ia
      LEFT JOIN LATERAL (
        SELECT un_inner.is_read
        FROM user_notification un_inner
        WHERE un_inner.alert_id = ia.alert_id
          AND un_inner.user_id = $1
        ORDER BY un_inner.is_read DESC
        LIMIT 1
      ) un ON TRUE
      WHERE ia.branch_id = $2
        AND ia.alert_date >= $3
        AND (
          ia.user_id = 0 OR ia.user_id IS NULL
          OR (ia.user_id = $1 AND ia.alert_type NOT IN ('New Sale', 'Delivery Status Update', 'New Delivery', 'Inventory Update'))
          OR (ia.user_id != $1 AND ia.alert_type IN ('New Sale', 'Delivery Status Update', 'New Delivery', 'Inventory Update'))
          OR (ia.alert_type IN ('Low Stock Alert', 'Near Expired', 'Expired') AND $4 = TRUE)
        )
        AND COALESCE(un.is_read, false) = FALSE
  `, [userId, branchId, hireDate, (roleSet.has('Branch Manager') || roleSet.has('Inventory Staff'))]);

  if (unreadAlerts.length === 0) {
    return 0;
  }

  const alertIds = unreadAlerts
    .map(alert => {
      const parsed = parseInt(alert.alert_id, 10);
      return Number.isNaN(parsed) ? null : parsed;
    })
    .filter((value) => value !== null);

  if (alertIds.length === 0) {
    return 0;
  }

  await SQLquery(
    `INSERT INTO user_notification(user_id, alert_id, is_read)
     SELECT $1, unnest($2::int[]), TRUE
     ON CONFLICT (user_id, alert_id) DO UPDATE SET is_read = TRUE`,
    [userId, alertIds]
  );

  return alertIds.length;
};

/**
 * Send push notification for a new alert
 * This should be called after creating an alert in Inventory_Alerts table
 * @param {Object} alert - Alert object from Inventory_Alerts table
 */
export const sendPushForAlert = async (alert) => {
  try {
    // Call the push notification service
    await sendAlertPushNotification(alert);
  } catch (error) {
    // Log error but don't throw - push notifications are optional/nice-to-have
    console.error('Failed to send push notification for alert:', error);
  }
};
