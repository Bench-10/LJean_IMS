import api from "./utils/api.js";
import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import ModalForm from "./components/ModalForm";
import ProductInventory from "./Pages/ProductInventory";
import Notification from "./Pages/Notification";
import ProductValidity from "./Pages/ProductValidity";
import Category from "./components/Category";
import ProductTransactionHistory from "./components/ProductTransactionHistory";
import { Routes, Route, useNavigate } from "react-router-dom";
import Login from "./authentication/Login";
import ResetPassword from "./authentication/ResetPassword.jsx";
import PageLayout from "./components/PageLayout";
import Dashboard from "./Pages/Dashboard";
import RouteProtection from "./utils/RouteProtection";
import UserManagement from "./Pages/UserManagement";
import UserModalForm from "./components/UserModalForm";
import UserInformation from "./components/UserInformation";
import Sales from "./Pages/Sales";
import DeliveryMonitoring from "./Pages/DeliveryMonitoring";
import AddSaleModalForm from "./components/AddSaleModalForm";
import { useAuth } from "./authentication/Authentication";
import BranchAnalyticsCards from "./Pages/BranchAnalyticsCards";
import BranchKPI from "./Pages/BranchKPI.jsx";
import AddDeliveryInformation from "./components/AddDeliveryInformation.jsx";
import FormLoading from "./components/common/FormLoading";
import AccountDisabledPopUp from "./components/dialogs/AccountDisabledPopUp";
import InAppNotificationPopUp from "./components/dialogs/InAppNotificationPopUp";
import ProductExistsDialog from "./components/dialogs/ProductExistsDialog";



function App() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [openUserModal, setOpenUserModal] = useState(false);
  const [openSaleModal, setOpenSaleModal] = useState(false);
  const [openUsers, setOpenUsers] = useState(false);
  const [userDetailes, setUserDetailes] = useState([]);
  const [isCategoryOpen, setIsCategory] = useState(false);
  const [isProductTransactOpen, setIsProductTransactOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add');
  const [itemData, setItemData] = useState(null);
  const [productsData, setProductsData] = useState([])
  const [listCategories, setListCategories] = useState([]);
  const [users, setUsers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [notify, setNotify] = useState([]);
  const [saleHeader,setSaleHeader ] = useState([]);
  const [openNotif, setOpenNotif] = useState(false);
  const [openAddDelivery, setAddDelivery] = useState(false);
  const [openInAppNotif, setOpenInAppNotif] = useState(false);
  const [inAppNotifMessage, setInAppNotifMessage] = useState('');
  const [currentNotificationType, setCurrentNotificationType] = useState('System Update');
  const [deliveryData, setDeliveryData] = useState([]);
  const [deliveryEditData, setDeliveryEdit] = useState([]);
  const [productValidityList, setProductValidityList] = useState([]);

  // NOTIFICATION QUEUE SYSTEM
  const [notificationQueue, setNotificationQueue] = useState([]);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const queueTimeoutRef = useRef(null);

  // ACCOUNT STATUS STATES
  const [showAccountDisabledPopup, setShowAccountDisabledPopup] = useState(false);
  const [accountStatusType, setAccountStatusType] = useState(''); // 'disabled' or 'deleted'
  const [hasLoggedOutDueToStatus, setHasLoggedOutDueToStatus] = useState(false);

  // PRODUCT EXISTS DIALOG STATES
  const [showProductExistsDialog, setShowProductExistsDialog] = useState(false);
  const [productExistsMessage, setProductExistsMessage] = useState('');

  //LOADING STATES
  const [invetoryLoading, setInventoryLoading] = useState(false);
  const [salesLoading, setSalesLoading] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);
  const [deliveryLoading, setDeliveryLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);


  // Socket connection
  const [socket, setSocket] = useState(null);

  const {user, logout} = useAuth();
  const navigate = useNavigate();
  

  //PREVENTS SCRIPTS ATTACKS ON INPUT FIELDS
  function sanitizeInput(input) {
    return input.replace(/[<>="']/g, '');
  }

  // NOTIFICATION QUEUE MANAGEMENT
  const addToNotificationQueue = (message, isLocal = false) => {
    setNotificationQueue(prev => [...prev, { message, isLocal }]);
  };

  const processNotificationQueue = () => {
    if (isProcessingQueue || notificationQueue.length === 0 || openNotif) return;

    setIsProcessingQueue(true);
    const nextNotification = notificationQueue[0];
    
    // Show the notification
    setInAppNotifMessage(nextNotification.message);
    setCurrentNotificationType(nextNotification.isLocal ? 'Success' : 'System Update');
    setOpenInAppNotif(true);
    
    // Remove from queue after showing
    setNotificationQueue(prev => prev.slice(1));
    
    // Hide notification after 3 seconds and process next
    queueTimeoutRef.current = setTimeout(() => {
      setOpenInAppNotif(false);
      setInAppNotifMessage('');
      setCurrentNotificationType('System Update');
      setIsProcessingQueue(false);
      
      // Process next notification if queue not empty and notification panel not open
      setTimeout(() => {
        if (notificationQueue.length > 1 && !openNotif) {
          processNotificationQueue();
        }
      }, 500); // Small delay between notifications
      
    }, 3000);
  };

  // CLEAR NOTIFICATION QUEUE WHEN NOTIFICATION PANEL IS OPENED
  const handleNotificationPanelOpen = () => {
    setOpenNotif(true);
    
    // Stop current notification and clear queue
    if (queueTimeoutRef.current) {
      clearTimeout(queueTimeoutRef.current);
      queueTimeoutRef.current = null;
    }
    
    setOpenInAppNotif(false);
    setInAppNotifMessage('');
    setCurrentNotificationType('System Update');
    setNotificationQueue([]);
    setIsProcessingQueue(false);
  };

  // Process queue when new notifications are added
  useEffect(() => {
    if (!isProcessingQueue && notificationQueue.length > 0 && !openNotif) {
      processNotificationQueue();
    }
  }, [notificationQueue, isProcessingQueue, openNotif]);

  // Clear queue and timeouts when notification panel opens
  useEffect(() => {
    if (openNotif) {
      if (queueTimeoutRef.current) {
        clearTimeout(queueTimeoutRef.current);
        queueTimeoutRef.current = null;
      }
      setOpenInAppNotif(false);
      setInAppNotifMessage('');
      setCurrentNotificationType('System Update');
      setNotificationQueue([]);
      setIsProcessingQueue(false);
    }
  }, [openNotif]);

  // CHECK IF CURRENT USER IS DISABLED ON PAGE LOAD/REFRESH
  const checkUserStatus = async () => {
    if (!user || !user.user_id || showAccountDisabledPopup || hasLoggedOutDueToStatus) return;

    try {
      const response = await api.get(`/api/user_status/${user.user_id}`);
      const userData = response.data;
      
      if (userData.is_disabled && !showAccountDisabledPopup) {
        console.log('User is disabled on page load, showing popup');
        setAccountStatusType('disabled');
        setShowAccountDisabledPopup(true);
      }
    } catch (error) {
      // IF USER NOT FOUND (DELETED), SHOW DELETED POPUP
      if (error.response && error.response.status === 404 && !showAccountDisabledPopup) {
        console.log('User not found (deleted), showing popup');
        setAccountStatusType('deleted');
        setShowAccountDisabledPopup(true);
      } else {
        console.error('Error checking user status:', error);
      }
    }
  };

  // HANDLE ACCOUNT DISABLED/DELETED ACTION
  const handleAccountStatusAction = async () => {
    if (accountStatusType === 'deleted') {
      // FOR DELETED ACCOUNTS - REDIRECT TO LOGIN WITHOUT LOGOUT API CALL
      setHasLoggedOutDueToStatus(true);
      setShowAccountDisabledPopup(false);
      await logout(true); // SKIP API CALL FOR DELETED USERS
      navigate('/');
    } else if (accountStatusType === 'disabled') {
      // FOR DISABLED ACCOUNTS - LOGOUT NORMALLY
      setHasLoggedOutDueToStatus(true);
      setShowAccountDisabledPopup(false);
      await logout(false); // SEND LOGOUT API CALL FOR DISABLED USERS
      navigate('/');
    }
  };

  // HANDLE CLOSING THE POPUP (FOR WHEN NO USER IS PRESENT)
  const handleClosePopup = () => {
    setShowAccountDisabledPopup(false);
    setHasLoggedOutDueToStatus(true); // PREVENT RE-SHOWING
  };


  // RESET LOGOUT FLAG WHEN USER CHANGES
  useEffect(() => {
    if (user) {
      // RESET THE FLAG WHEN A NEW USER LOGS IN
      setHasLoggedOutDueToStatus(false);
    }
  }, [user]);

  // CHECK USER STATUS ON INITIAL LOAD OR USER CHANGE
  useEffect(() => {
    if (user && user.user_id && user.role && !user.role.some(role => ['Owner'].includes(role))) {
      // ONLY CHECK STATUS FOR NON-OWNER USERS
      checkUserStatus();

      // SET UP PERIODIC STATUS CHECK EVERY 2 MINUTES
      const statusCheckInterval = setInterval(() => {
        if (!showAccountDisabledPopup && !hasLoggedOutDueToStatus) { // ONLY CHECK IF POPUP IS NOT ALREADY SHOWING AND HAVEN'T LOGGED OUT DUE TO STATUS
          checkUserStatus();
        }
      }, 120000); // 2 minutes

      return () => clearInterval(statusCheckInterval);
    }
  }, [user, showAccountDisabledPopup, hasLoggedOutDueToStatus]);

  // WEB SOCKET CONNECTION
  useEffect(() => {
    if (!user) {
      // RESET NOTIFICATION STATE WHEN USER LOGS OUT
      setNotify([]);
      return;
    }

    const newSocket = io(`${import.meta.env.VITE_API_URL}`);
    
    newSocket.on('connect', () => {
      console.log('Connected to server');
     
      newSocket.emit('join-branch', {
        userId: user.user_id,
        branchId: user.branch_id,
        role: user.role
      });

      // CHECK USER STATUS WHEN WEBSOCKET RECONNECTS
      if (user.user_id && user.role && !user.role.some(role => ['Owner'].includes(role)) && !hasLoggedOutDueToStatus) {
        checkUserStatus();
      }
    });

    // LISTEN FOR NEW NOTIFICATION
    newSocket.on('new-notification', (notification) => {
      console.log('New notification received:', notification);
      
      // CHECK ROLE-BASED FILTERING AND CREATOR EXCLUSION
      const shouldReceiveNotification = () => {
        // Exclude the creator from receiving their own notification
        if (notification.creator_id && user.user_id === notification.creator_id) {
          return false;
        }
        
        // Check if user has required roles for this notification
        if (notification.target_roles && notification.target_roles.length > 0) {
          if (!user.role || !user.role.some(role => notification.target_roles.includes(role))) {
            return false;
          }
        }
        
        return true;
      };
   
      setNotify(prevNotify => {
        // CHECK IF NOTIFICATION ALREADY EXIST
        const exists = prevNotify.some(notif => notif.alert_id === notification.alert_id);
        
        if (!exists && user.user_id !== notification.user_id && shouldReceiveNotification()) {
          return [notification, ...prevNotify];
        }
        return prevNotify;
      });
    });

    // LISTEN FOR INVENTORY UPDATES
    newSocket.on('inventory-update', (inventoryData) => {
      console.log('Inventory update received:', inventoryData);
      
      // ONLY UPDATE IF THE UPDATE WASN'T MADE BY THE CURRENT USER
      if (user.user_id !== inventoryData.user_id) {
        if (inventoryData.action === 'add') {
          setProductsData(prevData => [...prevData, inventoryData.product]);
          
          // Don't show "added successfully" to other users - that's only for the person who added it
          // This WebSocket event just updates the data silently for other users
          
        } else if (inventoryData.action === 'update') {
          setProductsData(prevData => 
            prevData.map(item => 
              item.product_id === inventoryData.product.product_id 
                ? inventoryData.product 
                : item
            )
          );
          
          // Don't show "updated successfully" to other users - that's only for the person who updated it
          // This WebSocket event just updates the data silently for other users
          
        } else if (inventoryData.action === 'sale_deduction' || inventoryData.action === 'delivery_stock_change') {
          // HANDLE INVENTORY CHANGES FROM SALES OR DELIVERY STATUS CHANGES
          setProductsData(prevData => 
            prevData.map(item => 
              item.product_id === inventoryData.product.product_id 
                ? inventoryData.product 
                : item
            )
          );
          
          // Stock changes from sales/delivery are handled silently
          // No need to show notifications for these automatic updates
        }
      }
    });

    // LISTEN FOR PRODUCT VALIDITY UPDATES
    newSocket.on('validity-update', (validityData) => {
      console.log('Product validity update received:', validityData);
      
      // ONLY UPDATE IF THE UPDATE WASN'T MADE BY THE CURRENT USER
      if (user.user_id !== validityData.user_id) {
        // TRIGGER REFRESH FOR PRODUCT VALIDITY PAGE
        // This will be handled by individual components that need validity data
        window.dispatchEvent(new CustomEvent('validity-update', { 
          detail: validityData 
        }));
      }
    });

    // LISTEN FOR PRODUCT HISTORY UPDATES
    newSocket.on('history-update', (historyData) => {
      console.log('Product history update received:', historyData);
      
      // ONLY UPDATE IF THE UPDATE WASN'T MADE BY THE CURRENT USER
      if (user.user_id !== historyData.user_id) {
        // TRIGGER REFRESH FOR PRODUCT HISTORY COMPONENT
        window.dispatchEvent(new CustomEvent('history-update', { 
          detail: historyData 
        }));
      }
    });

    // LISTEN FOR SALES UPDATES
    newSocket.on('sale-update', (saleData) => {
      console.log('Sale update received:', saleData);
      
      // ONLY UPDATE IF THE UPDATE WASN'T MADE BY THE CURRENT USER
      if (user.user_id !== saleData.user_id) {
        if (saleData.action === 'add') {
          // NEW SALE ADDED - UPDATE SALES LIST
          setSaleHeader(prevSales => [saleData.sale, ...prevSales]);
          
          // Don't show "sale created successfully" to other users
          // This WebSocket event just updates the data silently for other users
          
        } else if (saleData.action === 'delivery_status_change') {
          // DELIVERY STATUS CHANGED - UPDATE SALES LIST
          setSaleHeader(prevSales => 
            prevSales.map(sale => 
              sale.sales_information_id === saleData.sale.sales_information_id 
                ? saleData.sale 
                : sale
            )
          );
          
          // UPDATE DELIVERY DATA IF AVAILABLE
          setDeliveryData(prevDelivery => 
            prevDelivery.map(delivery => 
              delivery.sales_information_id === saleData.sale.sales_information_id
                ? { 
                    ...delivery, 
                    is_delivered: saleData.new_status.is_delivered,
                    is_pending: saleData.new_status.is_pending 
                  }
                : delivery
            )
          );
          
          // Don't show delivery status changes to other users as success notifications
          // This WebSocket event just updates the data silently for other users
          
        } else if (saleData.action === 'add_delivery') {
          // NEW DELIVERY ADDED - UPDATE DELIVERY LIST
          setDeliveryData(prevDelivery => [saleData.delivery, ...prevDelivery]);
          
          // Don't show delivery creation to other users as success notifications
          // This WebSocket event just updates the data silently for other users
          
        } else if (saleData.action === 'delivery_added') {
          // DELIVERY ADDED TO EXISTING SALE - UPDATE SALES LIST
          setSaleHeader(prevSales => 
            prevSales.map(sale => 
              sale.sales_information_id === saleData.sale.sales_information_id 
                ? saleData.sale 
                : sale
            )
          );
          
          // Don't show delivery additions to other users as success notifications
          // This WebSocket event just updates the data silently for other users
        }
      }
    });

    // LISTEN FOR USER MANAGEMENT UPDATES
    newSocket.on('user-update', (userData) => {
      console.log('User management update received:', userData);
      
      if (userData.action === 'add') {
        // NEW USER ADDED - UPDATE USERS LIST
        setUsers(prevUsers => [userData.user, ...prevUsers]);
        
        // Don't show "user added successfully" to other users
        // This WebSocket event just updates the data silently for other users
        
      } else if (userData.action === 'update') {
        // USER UPDATED - CHECK IF CURRENT USER WAS DISABLED
        if (user && userData.user.user_id === user.user_id && userData.user.is_disabled && !showAccountDisabledPopup) {
          console.log('Current user was disabled, showing popup');
          setAccountStatusType('disabled');
          setShowAccountDisabledPopup(true);
        }
        
        // UPDATE USERS LIST
        setUsers(prevUsers => 
          prevUsers.map(user => 
            user.user_id === userData.user.user_id 
              ? userData.user 
              : user
          )
        );
        
        // Don't show "user updated successfully" to other users
        // This WebSocket event just updates the data silently for other users
        
      } else if (userData.action === 'delete') {
        // CHECK IF CURRENT USER WAS DELETED
        if (user && userData.user_id === user.user_id && !showAccountDisabledPopup) {
          console.log('Current user was deleted, showing popup');
          setAccountStatusType('deleted');
          setShowAccountDisabledPopup(true);
        }
        
        // USER DELETED - REMOVE FROM USERS LIST
        setUsers(prevUsers => 
          prevUsers.filter(user => user.user_id !== userData.user_id)
        );
        
        // Don't show "user deleted successfully" to other users
        // This WebSocket event just updates the data silently for other users
      }
    });

    // LISTEN FOR USER STATUS UPDATES (LOGIN/LOGOUT)
    newSocket.on('user-status-update', (statusData) => {
      console.log('User status update received:', statusData);
      
      // UPDATE USER STATUS IN THE USERS LIST
      setUsers(prevUsers => 
        prevUsers.map(user => 
          user.user_id === statusData.user_id 
            ? { 
                ...user, 
                is_active: statusData.is_active,
                last_login: statusData.last_login || user.last_login
              } 
            : user
        )
      );
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from server');
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
      
      // Cleanup notification queue timeout
      if (queueTimeoutRef.current) {
        clearTimeout(queueTimeoutRef.current);
        queueTimeoutRef.current = null;
      }
    };
  }, [user]);

  

  //DISPLAY THE INVENTORY TABLE
  const fetchProductsData = async () =>{
      try {
        setInventoryLoading(true);
        let response;
        if (!user || !user.role || !user.role.some(role => ['Branch Manager', 'Owner'].includes(role))){
          response = await api.get(`/api/items?branch_id=${user.branch_id}`);
        } else {
          response = await api.get(`/api/items/`);
        }
        setProductsData(response.data);
      } catch (error) {
        console.log(error.message);
        
      } finally {
        setInventoryLoading(false)
      }
  };

  //RENDERS THE TABLE
  useEffect(() =>{

    if (!user) return;

    fetchProductsData();
  }, [listCategories, user]);


  //HANDLES OPENING ADD OR EDIT MODAL
  const handleOpen = (mode, items) =>{
    setItemData(items);
    setIsModalOpen(true);
    setModalMode(mode);
  };



  //ADD OR EDIT DATA TO THE DATABASE
  const handleSubmit = async (newItem) =>{
    if (modalMode === 'add'){
      try {
        const response = await api.post(`/api/items/`, newItem);
        setProductsData((prevData) => [...prevData, response.data]);
        console.log('Item Added', response.data);

        const message = `${response.data.product_name} has been successfully added to the Inventory!`;
        addToNotificationQueue(message, true); // true = local notification for the person who made the change 
        
      } catch (error) {
        
         console.error('Error adding item:', error);

         const serverMessage = error?.response?.data?.message || error?.response?.data?.error || error?.message || 'Failed to add item';
         const status = error?.response?.status;

         
         if (status === 409 || /product id already/i.test(serverMessage)) {
           setProductExistsMessage(serverMessage || 'Product already exists in the inventory.');
           setShowProductExistsDialog(true);
         } 
      }

    } else{
      try {
        console.log(itemData)
        const response = await api.put(`/api/items/${itemData.product_id}`, newItem);
        setProductsData((prevData) => 
          prevData.map((item) => (item.product_id === itemData.product_id ? response.data : item))
        );
        console.log('Item Updated', response.data);

        const message = `${response.data.product_name} has been successfully updated in the Inventory!`;
        addToNotificationQueue(message, true); 
        
      } catch (error) {
         console.error('Error adding Item', error);
      }
    }
  };



  const fetchSaleRecords = async() =>{
    try {
      setSalesLoading(true);
      const saleHeader = await api.get(`/api/sale?branch_id=${user.branch_id}`);
      setSaleHeader(saleHeader.data);
    } catch (error) {
      console.log(error);
    } finally{
      setSalesLoading(false);
    }
  };



  const getDeliveries = async () => {
    try {
      setDeliveryLoading(true);
      const data = await api.get(`/api/delivery?branch_id=${user.branch_id}`);
      setDeliveryData(data.data);

    } catch (error) {
      console.log(error);
    } finally {
      setDeliveryLoading(false);
    }
    

  }


  useEffect(() =>{

    if (!user) return;
    if (!user || !user.role || !user.role.some(role => ['Sales Associate'].includes(role))) return;

    fetchSaleRecords();
    getDeliveries();
  },[user]);



  //FOR NOTIFICATION DATA
  const getTime = async () =>{
    try {

      const time = await api.get(`/api/notifications?branch_id=${user.branch_id}&user_id=${user.user_id}&hire_date=${user.hire_date}`);
      setNotify(time.data);
    } catch (error) {
      console.log(error.message);
      
    } 

  };



  //BEST FOR NOW
  useEffect(() => {

    if (!user) {
      // RESET NOTIFICATION STATE WHEN USER LOGS OUT
      setNotify([]);
      return;
    }
    if (!user || !user.role || !user.role.some(role => ['Branch Manager', 'Inventory Staff'].includes(role))) return;
    
    // FETCH NOTIFICATIONS FOR THE CURRENT USER
    getTime();

    const intervalId = setInterval(() => {
      getTime();
    }, 60000);

    return () => clearInterval(intervalId);

  }, [user]);



  //USER CREATION MODAL LOGIC
  const handleUserModalOpen = (mode) =>{
    setOpenUserModal(true);
    setModalMode(mode);
  }



  //FETCHING THE BRANCH GLOBALLY
  const fetchBranch = async() =>{
    try {
        const branch = await api.get(`/api/branches`);
        setBranches(branch.data);
    } catch (error) {
        console.log(error)
    }
  };


  //FOR ADDING USER
  const fetchUsersinfo = async() =>{

    try {
       setUsersLoading(true);
       let response;

       if (user && user.branch_id && user.role && user.role.some(role => ['Branch Manager'].includes(role))){
          response = await api.get(`/api/users?branch_id=${user.branch_id}&user_id=${user.user_id}`);
       } else {
          response = await api.get(`/api/users`);
       }

       setUsers(response.data)
    } catch (error) {
      console.log(error);
    } finally {
      setUsersLoading(false);
    }

   

  };


  //IMPROVE THIS IN THE FUTURE(IMPORTANT)
  useEffect(() => {

    if (!user) return;

    fetchUsersinfo();
    fetchBranch();
  }, [user])



  const deleteUser = async(userID) => {
    try {
      setDeleteLoading(true);
      await api.delete(`/api/delete_account/${userID}`);
      // DON'T MANUALLY REFRESH - LET WEBSOCKET HANDLE REAL-TIME UPDATES
    } catch (error) {
      console.error('Error deleting user:', error);
    } finally {
      setDeleteLoading(false);
    }
  };



  //DISABLE AND ENABLE ACCOUNT
  const disableEnableAccount = async(userToDisable) =>{
    
    //RE-ENABLE ACCOUNT
    if (!user || !user.role || !user.role.some(role => ['Owner', 'Branch Manager'].includes(role))) return;

    if (userToDisable.is_disabled){
        
        await api.put(`/api/disable/${userToDisable.user_id}`, {isDisabled: false})
        // DON'T MANUALLY UPDATE - LET WEBSOCKET HANDLE REAL-TIME UPDATES

    } else {

        await api.put(`/api/disable/${userToDisable.user_id}`, {isDisabled: true})
        // DON'T MANUALLY UPDATE - LET WEBSOCKET HANDLE REAL-TIME UPDATES

    }

  }


  //DELIVERY EDIT
  const deliveryEdit = (mode, data) =>{
    setModalMode(mode);
    setDeliveryEdit(data);
    setAddDelivery(true);

  };


  //CANCULATE UNREAD NOTIFICATION
  const unreadCount = notify.filter(notification => !notification.is_read).length;



  return (

    <>

      {deleteLoading && (
        <FormLoading message="Deleting user account..." />
      )}

      {/*ACCOUNT DISABLED/DELETED POPUP*/}
      <AccountDisabledPopUp
        user={user}
        open={showAccountDisabledPopup}
        type={accountStatusType}
        onAction={handleAccountStatusAction}
        onClose={handleClosePopup}
      />

      {/*GLOBAL IN-APP NOTIFICATION POPUP (QUEUE SYSTEM)*/}
      {openInAppNotif && (
        <InAppNotificationPopUp 
          title={currentNotificationType}
          message={inAppNotifMessage}
        />
      )}

      {/*PRODUCT EXISTS DIALOG*/}
      <ProductExistsDialog
        isOpen={showProductExistsDialog}
        message={productExistsMessage}
        onClose={() => setShowProductExistsDialog(false)}
      />

      {/*COMPONENTS*/}
      <AddSaleModalForm
        openSaleModal={openSaleModal}
        productsData={productsData}
        setOpenSaleModal={setOpenSaleModal}
        setSaleHeader={setSaleHeader}
        fetchProductsData={fetchProductsData}
      
      />


      <AddDeliveryInformation 
        openAddDelivery={openAddDelivery}
        mode={modalMode}
        saleHeader={saleHeader}
        deliveryData={deliveryData}
        deliveryEditData={deliveryEditData}
        getDeliveries={getDeliveries}
        fetchProductsData={fetchProductsData}
        onClose={() => {setAddDelivery(false); setModalMode('add')}}  

      />


      <Category 
         isCategoryOpen={isCategoryOpen} 
         onClose={() => setIsCategory(false)}  
         listCategories={listCategories} 
         setListCategories={setListCategories} 
         fetchProductsData={fetchProductsData}
         sanitizeInput={sanitizeInput}
         
      />


      <UserModalForm 
        openUserModal={openUserModal}
        userDetailes={userDetailes}
        mode={modalMode}
        branches={branches}
        onClose={() => setOpenUserModal(false)}
        fetchUsersinfo ={fetchUsersinfo}
        setUserDetailes={setUserDetailes}
        setOpenUsers={setOpenUsers}
      
      />


      <ModalForm 
        isModalOpen={isModalOpen} 
        OnSubmit={handleSubmit} 
        mode={modalMode} 
        onClose={() => setIsModalOpen(false)} 
        itemData={itemData}  
        listCategories={listCategories}
        sanitizeInput={sanitizeInput}
         
      />

      <UserInformation
        openUsers={openUsers}
        userDetailes={userDetailes}
        onClose={() => setOpenUsers(false)} 
        handleUserModalOpen={handleUserModalOpen}
        deleteUser={deleteUser}
        deleteLoading={deleteLoading}
        
      />


      <ProductTransactionHistory
        isProductTransactOpen={isProductTransactOpen}
        sanitizeInput={sanitizeInput}
        onClose={() => setIsProductTransactOpen(false)}

      />


      <Notification 
        openNotif={openNotif}
        notify={notify}
        unreadCount={unreadCount}
        setNotify={setNotify}
        onClose={() => setOpenNotif(false)}
      />

  

      {/*PAGES */}
      <Routes>

        <Route path="/" exact element={
          <Login/>
        }/>

        <Route path="/reset-password" element={
          <ResetPassword />
        }/>

        
        {/*INVENTORY PAGE*/}
        <Route element={<RouteProtection>  <PageLayout setOpenNotif={handleNotificationPanelOpen} unreadCount={unreadCount}/>  </RouteProtection>}>
          <Route path="/inventory" exact element={ 
              <RouteProtection allowedRoles={['Owner', 'Inventory Staff', 'Branch Manager']}>

                  <ProductInventory 
                    setIsCategory={setIsCategory} 
                    handleOpen={handleOpen} 
                    setProductsData={setProductsData} 
                    productsData={productsData}
                    setIsProductTransactOpen={setIsProductTransactOpen}
                    sanitizeInput={sanitizeInput}
                    listCategories={listCategories}
                    branches={branches}
                    mode={modalMode}
                    openInAppNotif={openInAppNotif}
                    message={inAppNotifMessage}
                    invetoryLoading={invetoryLoading}

                  />

              </RouteProtection>
        
          }/>
         

          {/*PRODUCT VALIDITY/SHELF LIFE PAGE*/}
          <Route path="/product_validity" exact element={
            <RouteProtection allowedRoles={['Inventory Staff', 'Branch Manager']} >

              <ProductValidity 
                sanitizeInput={sanitizeInput}
                productValidityList={productValidityList}
                setProductValidityList={setProductValidityList}
              
              />

            </RouteProtection>
            
            
          }/>


          {/*DASHBOARD PAGE*/}
          <Route path={"/dashboard"} exact element={
            <RouteProtection allowedRoles={['Owner','Branch Manager']} >

               <Dashboard/>


            </RouteProtection>
            
          }/>



          {/*BRANCHES PAGE*/}
          <Route path="/branches" exact element={ 
              <RouteProtection allowedRoles={['Owner']}>

                  <BranchAnalyticsCards/>

              </RouteProtection>
        
          }/>
          <Route path="/branch-analytics/:branchId" exact element={
            <RouteProtection allowedRoles={['Owner']}>
              <BranchKPI />
            </RouteProtection>
          } />


          {/*USER MANAGEMENT PAGE*/}
          <Route path="/user_management" exact element={ 
              <RouteProtection allowedRoles={['Owner', 'Branch Manager']}>

                  <UserManagement
                    handleUserModalOpen={handleUserModalOpen}
                    setOpenUsers={setOpenUsers}
                    setUserDetailes={setUserDetailes}
                    sanitizeInput={sanitizeInput}
                    disableEnableAccount={disableEnableAccount}
                    users={users}
                    user={user}
                    usersLoading={usersLoading}
                  
                  />

              </RouteProtection>
        
          }/>


          {/*SALES TRANSACTION PAGE*/}
          <Route path="/sales" exact element={ 
              <RouteProtection allowedRoles={['Sales Associate']}>

                  <Sales
                    saleHeader={saleHeader}
                    setOpenSaleModal={setOpenSaleModal}
                    sanitizeInput={sanitizeInput}
                    salesLoading={salesLoading}
                  
                  />

              </RouteProtection>
        
          }/>


          {/*DELIVERY PAGE*/}
          <Route path="/delivery" exact element={ 
              <RouteProtection allowedRoles={['Sales Associate']}>

                  <DeliveryMonitoring
                    deliveryData={deliveryData}
                    deliveryLoading={deliveryLoading}
                    getDeliveries={getDeliveries}
                    setAddDelivery={setAddDelivery}
                    sanitizeInput={sanitizeInput}
                    deliveryEdit={deliveryEdit}

                  />

              </RouteProtection>
        
          }/>

          
        </Route>

      </Routes>
  
    </>
   


  );
}

export default App;