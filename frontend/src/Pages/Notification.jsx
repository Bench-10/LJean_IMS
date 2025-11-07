import api from '../utils/api';
import { useEffect, useState, useRef } from 'react';
import { IoMdClose } from "react-icons/io";
import { useAuth } from '../authentication/Authentication';
import { toast } from 'react-hot-toast';

function Notification({ openNotif, notify, setNotify, unreadCount, onClose, onNotificationNavigate }) {

  const { user } = useAuth();
  

  const [visibleCount, setVisibleCount] = useState(15);
  const principalId = user?.user_id ?? user?.admin_id ?? null;
  const isAdminUser = Boolean(user?.admin_id);
  const prevLengthRef = useRef(notify.length);
  const currentUserRef = useRef(principalId);

  // RESET REFERENCE WHEN USER CHANGES
  useEffect(() => {
    if (principalId !== currentUserRef.current) {
      // RESET REFERENCE TO CURRENT NOTIFICATION COUNT TO PREVENT FALSE POPUPS
      prevLengthRef.current = notify.length;
      currentUserRef.current = principalId;
    }
  }, [user, notify.length, principalId]);

  // REQUEST FOR NOTIFICATION
  useEffect(() => {
    if ('Notification' in window && window.Notification.permission !== 'granted') {
      window.Notification.requestPermission();
    }
  }, []);

  // CHECK IF THERE IS NEW NOTIFICATION
  useEffect(() => {
    // PREVENTS THE NOTIFICATION TO POPUP EVERY REFRESH
    if (prevLengthRef.current === 0) { prevLengthRef.current = notify.length; return };

    if (notify.length > prevLengthRef.current) {
      const newNotification = notify[0];
      if (newNotification) {
        const toastId = `notification-${newNotification.alert_id ?? Date.now()}`;
        const senderName = newNotification.user_full_name || 'System';
        const toastContent = (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
              {newNotification.alert_type || 'System Update'}
            </span>
            <span className="text-sm text-slate-800">
              <strong className="text-emerald-800">{senderName}:</strong> {newNotification.message}
            </span>
          </div>
        );

        toast(toastContent, {
          id: toastId,
          duration: 5200
        });

        //  BROWSER NOTIFICATION
        if ('Notification' in window && window.Notification.permission === 'granted') {
          const notification = new window.Notification('LJean Notification', {
            body: newNotification.message,
            icon: '/src/assets/images/ljean.png',
            tag: newNotification.alert_id
          });

          setTimeout(() => notification.close(), 5000);
        }
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
    'amber': 'border-l-amber-500',
  };

  //FUNCTION THAT MARKS NOTIFICATION AS READ WHEN PRESSED
  const markedAsRead = async (alert_id) => {
    //CHECKS IF THE MESSAGE IS ALREADY READ TO PREVENT UNECCESSARY STATE AND UI CHANGES
    const alertItem = notify.find(n => n?.alert_id === alert_id);
    const isAlreadyRead = alertItem ? Boolean(alertItem.is_read) : false;

    if (isAlreadyRead) return;

    //UPDATES THE FRONTEND FOR INSTANT UI CHANGES
    setNotify(notify => notify.map(n =>
      n.alert_id === alert_id ? { ...n, is_read: true } : n
    ));

    const body = isAdminUser ? { alert_id: alert_id, user_type: 'admin',  admin_id: principalId } : { alert_id: alert_id, user_type: 'user',  user_id: principalId }


    //UPDATES THE BACKEND
    await api.post(`/api/notifications`, body);
  };

  const handleNotificationClick = (notification) => {
    if (!notification) return;
    markedAsRead(notification.alert_id);

    if (typeof onNotificationNavigate === 'function') {
      onNotificationNavigate(notification);
    }
  };

  //FUNCTION THAT MARKS ALL NOTIFICATIONS AS READ
  const markAllAsRead = async () => {
    try {

      //UPDATES THE UI
      setNotify(notify => notify.map(n => ({ ...n, is_read: true })));

      // Build top-level body fields expected by the server
      const body = isAdminUser
        ? { user_type: 'admin', admin_id: principalId }
        : { user_type: 'user', user_id: principalId, branch_id: user.branch_id, hire_date: user.hire_date };

      await api.post(`/api/notifications/mark-all-read`, body);

      
    } catch (error) {
      console.error('Error:', error);
    }
  };

  return (
    <>
      {openNotif && (
        <div className="fixed inset-0 bg-black/50 z-[998] backdrop-blur-sm" onClick={onClose} />
      )}

      {openNotif && (
        <dialog className='bg-transparent w-[100%] lg:w-[50%] fixed inset-0 flex items-center justify-center z-[999]'>
          <div className='bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] mx-2 lg:mx-4 overflow-hidden relative flex flex-col'>

            <button
              onClick={onClose}
              className='absolute top-3 right-3 sm:top-4 sm:right-4 p-2 z-10 hover:bg-gray-100 rounded-full transition-colors'
              aria-label="Close notifications"
            >
              <IoMdClose className='w-5 h-5 sm:w-6 sm:h-6' />
            </button>

            {/*HEADER*/}
            <div className='px-4 sm:px-6 lg:px-8 py-4 sm:py-5 lg:py-6 border-b border-gray-200 flex-shrink-0'>
              <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3'>
                <div>
                  <h1 className='text-3xl sm:text-2xl lg:text-3xl font-bold text-gray-800'>
                    Notifications
                  </h1>
                  <p className='text-xs sm:text-sm text-gray-700 mt-1'>
                    You have <span className='font-bold'>{unreadCount}</span> unread messages.
                  </p>
                </div>

                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className='w-full sm:w-auto px-4 py-2 mr-0 sm:mr-6 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors'
                  >
                    Mark All as Read
                  </button>
                )}
              </div>
            </div>

            {/*CONTENT*/}
            <div className='px-4 sm:px-6 lg:px-8 py-3 sm:py-4 lg:py-6 overflow-y-auto flex-1 modal-scroll-container hide-scrollbar'>

              <div className='flex flex-col gap-y-5 sm:gap-y-6'>

                {/*TODAY NOTIFICATION*/}
                <div>
                  <div className='flex items-center mb-3 sm:mb-4'>
                    <h2 className='font-semibold text-sm sm:text-base text-gray-700 mr-3'>
                      Today
                    </h2>
                    <hr className='flex-1 border-gray-300' />
                  </div>

                  {/*TODAYS NOTIFICATION BLOCK CONTAINER*/}
                  <div className='flex flex-col gap-y-2 sm:gap-y-3'>
                    {todayNotification.length === 0 ?
                      (
                        <div className="text-gray-500 italic text-center py-4 text-sm">
                          No notifications for today.
                        </div>
                      ) :
                      (
                        todayNotification.map((notification, index) => (
                          <div
                            key={index}
                            className={`${!notification.is_read ? 'bg-blue-50 border-blue-200' : 'bg-white'} relative flex flex-col px-4 sm:px-6 py-3 sm:py-4 border border-gray-200 border-l-4 ${borderColorMap[notification.banner_color] || ''} rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer`}
                            onClick={() => handleNotificationClick(notification)}
                          >
                            <div className='mb-2 flex items-start sm:items-center justify-between gap-2'>
                              <h3 className='text-base sm:text-lg font-semibold text-gray-800 break-words'>
                                {notification.alert_type}
                              </h3>
                              {!notification.is_read && (
                                <span className='text-xs font-medium text-blue-600 bg-blue-100 px-2 py-1 rounded-full whitespace-nowrap flex-shrink-0'>
                                  Unread
                                </span>
                              )}
                            </div>

                            <div className='mb-8 sm:mb-6'>
                              <p className='text-gray-600 text-xs sm:text-sm leading-relaxed break-words'>
                                <strong>{notification.user_full_name || 'System'}: </strong>
                                {notification.message || ''}
                              </p>
                            </div>

                            <div className='absolute right-4 sm:right-6 bottom-2 sm:bottom-3'>
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
                <div>
                  <div className='flex items-center mb-3 sm:mb-4'>
                    <h2 className='font-semibold text-sm sm:text-base text-gray-700 mr-3'>
                      Previous
                    </h2>
                    <hr className='flex-1 border-gray-300' />
                  </div>

                  {/*PREVIOUS NOTIFICATION BLOCK CONTAINER */}
                  <div className='flex flex-col gap-y-2 sm:gap-y-3'>
                    {notTodayNotification.length === 0 ?
                      (
                        <div className="text-gray-500 italic text-center py-4 text-sm">
                          No previous notifications.
                        </div>
                      ) :
                      (
                        notTodayNotification.slice(0, visibleCount).map((notification, index) => (
                          <div
                            key={index}
                            className={`${!notification.is_read ? 'bg-blue-50 border-blue-200' : 'bg-white'} relative flex flex-col px-4 sm:px-6 py-3 sm:py-4 border border-gray-200 border-l-4 ${borderColorMap[notification.banner_color] || ''} rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer`}
                            onClick={() => handleNotificationClick(notification)}
                          >
                            <div className='mb-2 flex items-start sm:items-center justify-between gap-2'>
                              <h3 className='text-base sm:text-lg font-semibold text-gray-800 break-words'>
                                {notification.alert_type}
                              </h3>
                              {!notification.is_read && (
                                <span className='text-xs font-medium text-blue-600 bg-blue-100 px-2 py-1 rounded-full whitespace-nowrap flex-shrink-0'>
                                  Unread
                                </span>
                              )}
                            </div>

                            <div className='mb-8 sm:mb-6'>
                              <p className='text-gray-600 text-xs sm:text-sm leading-relaxed break-words'>
                                <strong>{notification.user_full_name || 'System'}: </strong>
                                {notification.message || ''}
                              </p>
                            </div>

                            <div className='absolute right-4 sm:right-6 bottom-2 sm:bottom-3'>
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
            </div>
          </div>
        </dialog>
      )}
    </>
  );
}

export default Notification;
