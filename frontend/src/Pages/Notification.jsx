import api from '../utils/api';
import { useEffect, useState, React, useRef} from 'react';
import { IoMdClose } from "react-icons/io";
import { useAuth } from '../authentication/Authentication';
import InAppNotificationPopUp from '../components/dialogs/InAppNotificationPopUp';
import ChartLoading from '../components/common/ChartLoading'; // Make sure this is imported

function Notification({openNotif, notify, setNotify, unreadCount, onClose, notificaionLoading}) {


  const {user} = useAuth();

  const [visibleCount, setVisibleCount] = useState(15);
  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState('');
  const prevLengthRef = useRef(notify.length);
  const currentUserRef = useRef(user?.user_id);

  // RESET REFERENCE WHEN USER CHANGES
  useEffect(() => {
    if (user?.user_id !== currentUserRef.current) {
      // RESET REFERENCE TO CURRENT NOTIFICATION COUNT TO PREVENT FALSE POPUPS
      prevLengthRef.current = notify.length;
      currentUserRef.current = user?.user_id;
      setShowPopup(false);
    }
  }, [user, notify.length]);

  // REQUEST FOR NOTIFICATION
  useEffect(() => {
    if ('Notification' in window && window.Notification.permission !== 'granted') {
      window.Notification.requestPermission();
    }
  }, []);

  // CHECK IF THERE IS NEW NOTIFICATION
  useEffect(() => {

    // PREVENTS THE NOTIFICATION TO POPUP EVERY REFRESH
    if (prevLengthRef.current === 0 ) {prevLengthRef.current = notify.length; return };


    if (notify.length > prevLengthRef.current) {
      const newNotification = notify[0]; 
      if (newNotification) {

        const notifMessage = `${newNotification.user_full_name}: ${newNotification.message}`;
        
        // SHOW IN-APP NOTIFICATION
        setPopupMessage(notifMessage);

        setShowPopup(true);


        //  BROWSER NOTIFICATION
        if ('Notification' in window && window.Notification.permission === 'granted') {
          const notification = new window.Notification('LJean Notification', {
            body: newNotification.message,
            icon: '/src/assets/images/ljean.png',
            tag: newNotification.alert_id 
          });

       
          setTimeout(() => notification.close(), 5000);
        }

         setTimeout(() => {
          setShowPopup(false);
        }, 5000); 


       
      }

    }
    prevLengthRef.current = notify.length;
  }, [notify]);



  //SHOWS MORE NOFICATION WHEN SCROLLED
  useEffect(() => {
    const handleScroll = (e) => {
      const { scrollTop, scrollHeight, clientHeight } = e.target;
      if (scrollTop + clientHeight >= scrollHeight - 50) {
        setVisibleCount(prev => prev + 10); 
      }
    };

    const scrollContainer = document.querySelector('.modal-scroll-container');
    
    if (scrollContainer && openNotif) {
      scrollContainer.addEventListener("scroll", handleScroll);
      return () => scrollContainer.removeEventListener("scroll", handleScroll);
    }
  }, [openNotif]);


  const todayNotification = notify.filter(n => n.isDateToday);
  const notTodayNotification = notify.filter(n => !n.isDateToday);

  const borderColorMap = {
    'red': 'border-l-red-600',
    'blue': 'border-l-blue-700',
    'green': 'border-l-green-600',
    'yellow': 'border-l-yellow-500',
  };



  //FUNCTION THAT MARKS NOTIFICATION AS READ WHEN PRESSED
  const markedAsRead = async(alert_id) =>{

    //CHECKS IF THE MESSAGE IS ALREADY READ TO PREVENT UNECCESSARY STATE AND UI CHANGES
    const alertItem = notify.find(n => n?.alert_id === alert_id);
    const isAlreadyRead = alertItem ? Boolean(alertItem.is_read) : false;

    if (isAlreadyRead) return;


    //UPDATES TEH FRONTEND FOR INSTANT UI CHANGES
    setNotify(notify => notify.map(n => 
      n.alert_id === alert_id ? { ...n, is_read: true } : n
    ));

    //UPDATES THE BACKEND
    await api.post(`/api/notifications`,{ alert_id: alert_id, user_id: user.user_id});

  };



  return (
    <>
        {showPopup && !openNotif && (
          <InAppNotificationPopUp 
            title={'New Notification'}
            message={popupMessage}
          />
        )}

        {openNotif && (
          <div className="fixed inset-0 bg-black/50 z-[998] backdrop-blur-[1px]" onClick={onClose} />
        )}

        {openNotif && (
          <dialog className=' bg-transparent w-[50%] fixed inset-0 flex items-center justify-center z-[999]'>
          <div className='bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] mx-4 overflow-hidden relative'>
            
            <button 
              onClick={onClose}
              className='absolute top-4 right-4 p-2 z-10'
              aria-label="Close notifications"
            >
              <IoMdClose />
            </button>

            {/*HEADER*/}
            <div className='px-8 py-6 border-b border-gray-200'>
              <h1 className='text-3xl font-bold text-gray-800'>
                Notifications
              </h1>
              <p className='text-xs text-gray-700'>You have <span className='font-bold'>{unreadCount}</span> unread massages.</p>
            </div>

            {/*SCROLLABLE CONTENT*/}
            <div className='relative px-8 py-6 overflow-y-auto max-h-[calc(80vh-120px)] modal-scroll-container'>
              {notificaionLoading ? (
                <div className='flex items-center justify-center h-52'>
                  <ChartLoading message="Loading notifications..." />
                </div>
                
              ) : (
                <div className='flex flex-col gap-y-6'>

                  {/*TODAY NOTIFICATION*/}
                  <div className=''>

                    <div className='flex items-center mb-4'>
                      <h2 className='font-semibold text-gray-700 mr-3'>
                        Today
                      </h2>
                      <hr className='flex-1 border-gray-300'/>
                    </div>
                    

                    {/*TODAYS NOTIFICATION BLOCK CONTAINER*/}
                    <div className='flex flex-col gap-y-3'>

                      {/*NOTIFICATION BLOCK */}
                      {todayNotification.length === 0 ? 
                        (
                          <div className="text-gray-500 italic text-center py-4">No notifications for today.</div>
                        ) :

                        (
                          todayNotification.map((notification, index) => (
                              <div key={index} className={`${!notification.is_read ? 'bg-blue-50 border-blue-200' : 'bg-white'} relative flex flex-col px-6 py-4 border border-gray-200 border-l-4 ${borderColorMap[notification.banner_color] || ''} rounded-lg shadow-sm hover:shadow-md transition-shadow`} onClick={() => markedAsRead(notification.alert_id)}>

                                <div className='mb-2 flex items-center justify-between'>
                                  <h3 className='text-lg font-semibold text-gray-800'>{notification.alert_type}</h3>
                                  {!notification.is_read && (
                                    <div className='flex items-center gap-2'>
                                      <span className='text-xs font-medium text-blue-600 bg-blue-100 px-2 py-1 rounded-full'>Unread</span>
                                    </div>
                                  )}
                                </div>

                                <div className='mb-4'>
                                  <p className='text-gray-600 text-sm leading-relaxed'>
                                    <span>
                                      <strong>{notification.user_full_name}: </strong>{notification.message || ''}
                                    </span>
                                   
                                  </p>
                                </div>

                                <div className='absolute right-6 bottom-3'>
                                  <span className='text-xs text-gray-400'>
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
                    <div className='flex items-center mb-4'>
                      <h2 className='font-semibold text-gray-700 mr-3'>
                        Previous
                      </h2>
                      <hr className='flex-1 border-gray-300'/>
                    </div>

                    {/*PREVIOUS NOTIFICATION BLOCK CONTAINER */}
                    <div className='flex flex-col gap-y-3'>

                      {/*NOTIFICATION BLOCK */}
                      {notTodayNotification.length === 0 ? 
                          (
                            <div className="text-gray-500 italic text-center py-4">No previous notifications.</div>
                          ) :

                          (
                            notTodayNotification.slice(0, visibleCount).map((notification, index) => (
                                <div key={index} className={`${!notification.is_read ? 'bg-blue-50 border-blue-200' : 'bg-white'} relative flex flex-col px-6 py-4 border border-gray-200 border-l-4 ${borderColorMap[notification.banner_color] || ''} rounded-lg shadow-sm hover:shadow-md transition-shadow`} onClick={() => markedAsRead(notification.alert_id)}>

                                  <div className='mb-2 flex items-center justify-between'>
                                    <h3 className='text-lg font-semibold text-gray-800'>{notification.alert_type}</h3>
                                    {!notification.is_read && (
                                      <div className='flex items-center gap-2'>
                                        <span className='text-xs font-medium text-blue-600 bg-blue-100 px-2 py-1 rounded-full'>Unread</span>
                                      </div>
                                    )}
                                  </div>

                                  <div className='mb-4'>
                                    <p className='text-gray-600 text-sm leading-relaxed'>
                                         <span>
                                          <strong>{notification.user_full_name}: </strong>{notification.message || ''}
                                         </span>
                                    </p>
                                  </div>

                                  <div className='absolute right-6 bottom-3'>
                                    <span className='text-xs text-gray-400'>
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
              )}
            </div>
            
          </div>

        </dialog>

        )}

    </>

  )

}

export default Notification