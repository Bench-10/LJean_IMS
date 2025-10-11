import { SQLquery } from "../../db.js";
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime.js';
import isToday from 'dayjs/plugin/isToday.js';
import isYesterday from 'dayjs/plugin/isYesterday.js';



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



export const returnNotification = async ({ branchId, userId, hireDate, userType = 'user', adminId = null }) => {
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
        ia.branch_id,
        COALESCE(an.is_read, false) AS is_read
      FROM Inventory_Alerts ia
      LEFT JOIN admin_notification an
        ON ia.alert_id = an.alert_id AND an.admin_id = $1
      WHERE ia.alert_type IN ('User Approval Needed', 'Inventory Admin Approval Needed')
      ORDER BY ia.alert_date DESC
      LIMIT 100
    `, [adminId]);

    return rows.map((row) => ({
      ...row,
      alert_date_formatted: formatTime(row.alert_date),
      isDateToday: dayjs(row.alert_date).isToday()
    }));
  }

  const { rows } = await SQLquery(`
    SELECT 
      Inventory_Alerts.alert_id, 
      alert_type,
      message, 
      alert_date, 
      banner_color, 
      COALESCE(user_notification.is_read, false) AS is_read, 
      user_full_name, 
      Inventory_Alerts.user_id
    FROM Inventory_Alerts
    LEFT JOIN user_notification
      ON Inventory_Alerts.alert_id = user_notification.alert_id AND user_notification.user_id = $1
    WHERE Inventory_Alerts.branch_id = $2 AND Inventory_Alerts.alert_date >= $3 AND Inventory_Alerts.user_id != $4
    ORDER BY Inventory_Alerts.alert_date DESC;
  `, [userId, branchId, hireDate, userId]);

  return rows.map((row) => ({
    ...row,
    alert_date_formatted: formatTime(row.alert_date),
    isDateToday: dayjs(row.alert_date).isToday()
  }));
};



//MARKS THE NOTIFICATION AS READ IN THE DATABASE
export const markAsRead = async (userAndAlertID) =>{
  const { alert_id, user_id, user_type = 'user', admin_id = null } = userAndAlertID;

  if (user_type === 'admin' && admin_id) {
    await SQLquery(
      `INSERT INTO admin_notification(admin_id, alert_id, is_read)
       VALUES ($1, $2, TRUE)
       ON CONFLICT (admin_id, alert_id) DO UPDATE SET is_read = TRUE`,
      [admin_id, alert_id]
    );
    return;
  }

  await SQLquery(`INSERT INTO user_notification(user_id, alert_id) VALUES($1, $2)`,[user_id, alert_id]);
};

//MARKS ALL NOTIFICATIONS AS READ FOR A USER
export const markAllAsRead = async ({ userId, branchId, hireDate, userType = 'user', adminId = null }) => {
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

  const {rows: unreadAlerts} = await SQLquery(`
      SELECT Inventory_Alerts.alert_id
      FROM Inventory_Alerts
      LEFT JOIN user_notification
      ON Inventory_Alerts.alert_id = user_notification.alert_id AND user_notification.user_id = $1
      WHERE Inventory_Alerts.branch_id = $2 AND Inventory_Alerts.alert_date >= $3 
      AND user_notification.is_read IS NULL 
      AND Inventory_Alerts.user_id != $1
  `, [userId, branchId, hireDate]);

  if (unreadAlerts.length > 0) {
    const values = unreadAlerts.map(alert => `(${userId}, ${alert.alert_id})`).join(', ');

    await SQLquery(`INSERT INTO user_notification(user_id, alert_id) VALUES ${values}`);

  }

  return unreadAlerts.length;
};
