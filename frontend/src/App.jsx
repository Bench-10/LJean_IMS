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
      
   
      setNotify(prevNotify => {
        // CHECK IF NOTIFICATION ALREADY EXIST
        const exists = prevNotify.some(notif => notif.alert_id === notification.alert_id);
        
        if (!exists && user.user_id !== notification.user_id) {
          return [notification, ...prevNotify];
        }
        return prevNotify;
      });
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
        if (!user.role.some(role => ['Branch Manager', 'Owner'].includes(role))){
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
    if (!user.role.some(role => ['Sales Associate'].includes(role))) return;

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
    if (!user.role.some(role => ['Branch Manager', 'Inventory Staff'].includes(role))) return;
    
    // FETCH NOTIFICATIONS FOR THE CURRENT USER
    getTime();

    const intervalId = setInterval(() => {
      getTime();
    }, 60000);

    return () => clearInterval(intervalId);

  }, [user]);



  //USER CREATION MODAL LOGIC
  const handleUserModalOpen = (mode) =>{
    setIsModalOpen(true);
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

       if (user.branch_id && user.role.some(role => ['Branch Manager'].includes(role))){
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
    if (!user.role.some(role => ['Owner', 'Branch Manager'].includes(role))) return;

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
        isModalOpen={isModalOpen}
        userDetailes={userDetailes}
        mode={modalMode}
        branches={branches}
        onClose={() => setIsModalOpen(false)}
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