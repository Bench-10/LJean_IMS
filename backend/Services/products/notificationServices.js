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



export const returnNotification = async (branchId) =>{

    const {rows} = await SQLquery(`
        SELECT alert_id, alert_type, message, alert_date, banner_color, is_read
        FROM Inventory_Alerts
        WHERE branch_id = $1
        ORDER BY alert_date DESC

    `,[branchId]);

    //ADD A THE FORMATED TIME ON EACH ROW
    const formattedRows = rows.map(row => ({
        ...row,
        alert_date_formatted: formatTime(row.alert_date),
        isDateToday: dayjs(row.alert_date).isToday()

    }));


    return formattedRows;
    
};



//MARKS THE NOTIFICATION AS READ IN THE DATABASE
export const markAsRead = async (alerId) =>{

  await SQLquery(`UPDATE Inventory_Alerts SET is_read = $1 WHERE alert_id = $2`,[true, alerId]);

};
