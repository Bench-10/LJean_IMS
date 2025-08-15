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



export const returnNotification = async (branchId, userId, hireDate) =>{

    const {rows} = await SQLquery(`
        SELECT Inventory_Alerts.alert_id, alert_type, message, alert_date, banner_color, COALESCE(user_notification.is_read, false) AS is_read
        FROM Inventory_Alerts
        LEFT JOIN user_notification
        ON Inventory_Alerts.alert_id = user_notification.alert_id AND user_notification.user_id = $1
        WHERE Inventory_Alerts.branch_id = $2 AND Inventory_Alerts.alert_date >= $3
        ORDER BY Inventory_Alerts.alert_date DESC;
    `,[userId, branchId, hireDate]);

    //ADD A THE FORMATED TIME ON EACH ROW
    const formattedRows = rows.map(row => ({
        ...row,
        alert_date_formatted: formatTime(row.alert_date),
        isDateToday: dayjs(row.alert_date).isToday()

    }));


    return formattedRows;
    
};



//MARKS THE NOTIFICATION AS READ IN THE DATABASE
export const markAsRead = async (userAndAlertID) =>{

  const { alert_id, user_id} = userAndAlertID;

  await SQLquery(`INSERT INTO user_notification(user_id, alert_id) VALUES($1, $2)`,[user_id, alert_id]);

};
