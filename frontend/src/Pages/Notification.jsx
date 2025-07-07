import { useEffect, useState, React} from 'react';
import axios from 'axios';




function Notification() {

  const [notify, setNotify] = useState([]);

  const getTime = async () =>{
    try {
      const time = await axios.get('http://localhost:3000/api/notifications')
      setNotify(time.data);
    } catch (error) {
      console.log(error.message);
      
    }

  };

  //BEST FOR NOW
  useEffect(() => {
    getTime();

    const intervalId = setInterval(() => {
      getTime();
    }, 5000);

    return () => clearInterval(intervalId);
  }, []);
  


  const todayNotification = notify.filter(n => n.isDateToday);
  const notTodayNotification = notify.filter(n => !n.isDateToday);

  const borderColorMap = {
    'red': 'border-l-red-600',
    'blue': 'border-l-blue-700',
    'green': 'border-l-green-600',
  };


  return (
    <div className=' ml-[220px] px-8 py-5 max-h-screen'>

      <div className='mb-6'>
         <h1 className='text-4xl font-bold mb-1'>
            Notification
         </h1>

         <h2 className='text-md font-semibold'>Welcome Bench Christian</h2>
      </div>
 
      {/*NOTIFICATION CONTAINER*/} 
      <div className='flex flex-col gap-y-8'>

        {/*TODAY NOTIFICATION*/}
        <div className=''>

          <div className='flex items-center'>
            <h1 className='font-bold mr-2'>
              Today
            </h1>

            <hr  className='w-[100%] border-1 border-gray-400'/>

          </div>
          

          {/*TODAYS NOTIFICATION BLOCK CONTAINER*/}
          <div className='mt-3 flex flex-col gap-y-4 py-3'>

            {/*NOTIFICATION BLOCK */}
            {todayNotification.length === 0 ? 
              (
                <div className="text-gray-500 italic text-center">No notifications for today.</div>
              ) :

              (
                todayNotification.map((notification, index) => (
                    <div key={index} className={`bg-white relative flex flex-col px-8 py-4 border-2 border-gray-200 border-l-4 ${borderColorMap[notification.banner_color] || ''} rounded-lg shadow-lg`}>

                      <div className='mb-2'>
                        <h1 className='text-xl font-bold'>{notification.alert_type}</h1>
                      </div>

                      <div className='mb-5'>
                        <p className=''>
                          {notification.message}
                        </p>
                      </div>

                      <div className='absolute right-8 bottom-2'>
                        <span className='text-xs italic'>
                          {notification.alert_date_formatted}
                        </span>
                      </div>

                  </div>

                ))

              )
            
            }

          </div>

        </div>

        {/*PREVIOUS NOTIFICATION*/}
        <div className=''>
          <div className='flex items-center'>
            <h1 className='font-bold mr-2'>
              Previous
            </h1>
            
            <hr  className='w-[100%] border-1 border-gray-400'/>

          </div>

          {/*PREVIOUS NOTIFICATION BLOCK CONTAINER */}
          <div className='mt-3 flex flex-col gap-y-4 py-3'>

            {/*NOTIFICATION BLOCK */}
            {notTodayNotification.length === 0 ? 
                (
                  <div className="text-gray-500 italic text-center mt-2">No notifications here.</div>
                ) :

                (
                  notTodayNotification.map((notification, index) => (
                      <div key={index} className={`bg-white relative flex flex-col px-8 py-4 border-2 border-gray-200 border-l-4 ${borderColorMap[notification.banner_color] || ''} rounded-lg shadow-lg`}>

                        <div className='mb-2'>
                          <h1 className='text-xl font-bold'>{notification.alert_type}</h1>
                        </div>

                        <div className='mb-5'>
                          <p className=''>
                            {notification.message}
                          </p>
                        </div>

                        <div className='absolute right-8 bottom-2'>
                          <span className='text-xs italic'>
                            {notification.alert_date_formatted}
                          </span>
                        </div>

                    </div>

                  ))
                )
              
              }

          </div>

        </div>

      </div>
      
    </div>

  )

}

export default Notification