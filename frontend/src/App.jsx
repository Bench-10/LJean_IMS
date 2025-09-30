import api from "./utils/api.js";
import { useState, useEffect } from "react";
import { io } from "socket.io-client";
import ModalForm from "./components/ModalForm";
import ProductInventory from "./Pages/ProductInventory";
import Notification from "./Pages/Notification";
import ProductValidity from "./Pages/ProductValidity";
import Category from "./components/Category";
import ProductTransactionHistory from "./components/ProductTransactionHistory";
import { Routes, Route } from "react-router-dom";
import Login from "./authentication/Login";
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
  const [deliveryData, setDeliveryData] = useState([]);
  const [deliveryEditData, setDeliveryEdit] = useState([]);
  const [productValidityList, setProductValidityList] = useState([]);


  //LOADING STATES
  const [invetoryLoading, setInventoryLoading] = useState(false);
  const [salesLoading, setSalesLoading] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);
  const [deliveryLoading, setDeliveryLoading] = useState(false);
  const [notificaionLoading, setNotificationLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);


  // Socket connection
  const [socket, setSocket] = useState(null);

  const {user} = useAuth();
  

  //PREVENTS SCRIPTS ATTACKS ON INPUT FIELDS
  function sanitizeInput(input) {
    return input.replace(/[<>="']/g, '');
  }


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
        } else if (inventoryData.action === 'update') {
          setProductsData(prevData => 
            prevData.map(item => 
              item.product_id === inventoryData.product.product_id 
                ? inventoryData.product 
                : item
            )
          );
        } else if (inventoryData.action === 'sale_deduction' || inventoryData.action === 'delivery_stock_change') {
          // HANDLE INVENTORY CHANGES FROM SALES OR DELIVERY STATUS CHANGES
          setProductsData(prevData => 
            prevData.map(item => 
              item.product_id === inventoryData.product.product_id 
                ? inventoryData.product 
                : item
            )
          );
        }
        
        // NOTE: No in-app notification here for other devices
        // The notification will come through the 'new-notification' event
        // which will show in the notification panel (old style)
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
          
          // SHOW IN-APP NOTIFICATION FOR NEW SALE
          const message = `New sale created by ${saleData.sale.transaction_by} for ${saleData.sale.charge_to} - Total: ₱${saleData.sale.total_amount_due}`;
          setOpenInAppNotif(true);
          setInAppNotifMessage(message);
          setTimeout(() => {
            setOpenInAppNotif(false);
            setInAppNotifMessage('');
          }, 5000);
          
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
        } else if (saleData.action === 'add_delivery') {
          // NEW DELIVERY ADDED - UPDATE DELIVERY LIST
          setDeliveryData(prevDelivery => [saleData.delivery, ...prevDelivery]);
        } else if (saleData.action === 'delivery_added') {
          // DELIVERY ADDED TO EXISTING SALE - UPDATE SALES LIST
          setSaleHeader(prevSales => 
            prevSales.map(sale => 
              sale.sales_information_id === saleData.sale.sales_information_id 
                ? saleData.sale 
                : sale
            )
          );
        }
      }
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from server');
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
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

        const message = `${response.data.product_name} has been successfuly added to the Inventory!`;

        setOpenInAppNotif(true);

        setInAppNotifMessage(message);

        setTimeout(() => {
          setOpenInAppNotif(false);
          setInAppNotifMessage('');
        }, 5000); 
        
      } catch (error) {
         console.error('Error adding Item', error);
      }

    } else{
      try {
        console.log(itemData)
        const response = await api.put(`/api/items/${itemData.product_id}`, newItem);
        setProductsData((prevData) => 
          prevData.map((item) => (item.product_id === itemData.product_id ? response.data : item))
        );
        console.log('Item Updated', response.data);

        const message = `${response.data.product_name} has been successfuly updated to the Inventory!`;

        setOpenInAppNotif(true);

        setInAppNotifMessage(message);

        setTimeout(() => {
          setOpenInAppNotif(false);
          setInAppNotifMessage('');
        }, 5000); 
        
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
      setNotificationLoading(true);
      const time = await api.get(`/api/notifications?branch_id=${user.branch_id}&user_id=${user.user_id}&hire_date=${user.hire_date}`);
      setNotify(time.data);
    } catch (error) {
      console.log(error.message);
      
    } finally {
      setNotificationLoading(false)
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
      fetchUsersinfo();
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
        setUsers((prev) =>
          prev.map((user) =>
            user.user_id === userToDisable.user_id
              ? { ...user, is_disabled: false }
              : user
          )
        );

    } else {

        await api.put(`/api/disable/${userToDisable.user_id}`, {isDisabled: true})
          setUsers((prev) =>
            prev.map((user) =>
              user.user_id === userToDisable.user_id
                ? { ...user, is_disabled: true }
                : user
            )
          );

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
        notificaionLoading={notificaionLoading}
        setNotify={setNotify}
        onClose={() => setOpenNotif(false)}
        

      />

  

      {/*PAGES */}
      <Routes>

        <Route path="/" exact element={
          <Login/>
        }/>

        
        {/*INVENTORY PAGE*/}
        <Route element={<RouteProtection>  <PageLayout setOpenNotif={() => setOpenNotif(true)} unreadCount={unreadCount}/>  </RouteProtection>}>
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