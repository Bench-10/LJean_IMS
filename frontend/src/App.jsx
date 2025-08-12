import axios from "axios";
import { useState, useEffect } from "react";
import ModalForm from "./components/ModalForm";
import ProductInventory from "./Pages/ProductInventory";
import Notification from "./Pages/Notification";
import ProductValidity from "./Pages/ProductValidity";
import Category from "./components/Category";
import ProductTransactionHistory from "./components/ProductTransactionHistory";
import { Routes, Route} from "react-router-dom";
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



function App() {
  const [isModalOpen, setIsModalOpen] = useState(false);
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
  const [openNotif, setOpenNotif] = useState(false);


  const {user} = useAuth();
  



  //PREVENTS SCRIPTS ATTACKS ON INPUT FIELDS
  function sanitizeInput(input) {
    return input.replace(/[<>\/"']/g, '');
  }

  

  //DISPLAY THE INVENTORY TABLE
  const fetchProductsData = async () =>{
      try {
        let response;
        if (user.role !== 'Owner' && user.role !== 'Branch Manager'){
          response = await axios.get(`http://localhost:3000/api/items?branch_id=${user.branch_id}`);
        } else {
          response = await axios.get(`http://localhost:3000/api/items/`);
        }
        setProductsData(response.data);
      } catch (error) {
        console.log(error.message);
        
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
        const response = await axios.post('http://localhost:3000/api/items/', newItem);
        setProductsData((prevData) => [...prevData, response.data]);
        console.log('Item Added', response.data);
        
      } catch (error) {
         console.error('Error adding Item', error);
      }

    } else{
      try {
        console.log(itemData)
        const response = await axios.put(`http://localhost:3000/api/items/${itemData.product_id}`, newItem);
        setProductsData((prevData) => 
          prevData.map((item) => (item.product_id === itemData.product_id ? response.data : item))
        );
        console.log('Item Updated', response.data);
        
      } catch (error) {
         console.error('Error adding Item', error);
      }
    }
  };



  //FOR NOTIFICATION DATA
  const getTime = async () =>{
    try {
      const time = await axios.get(`http://localhost:3000/api/notifications?branch_id=${user.branch_id}`);
      setNotify(time.data);
    } catch (error) {
      console.log(error.message);
      
    }

  };



  //BEST FOR NOW
  useEffect(() => {

    if (!user) return;
    if (user.role === 'Owner') return;
    if (user.role === 'Sales Associate') return;


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
        const branch = await axios.get('http://localhost:3000/api/branches');
        setBranches(branch.data);
    } catch (error) {
        console.log(error)
    }
  };


  //FOR ADDING USER
  const fetchUsersinfo = async() =>{

    const response = await axios.get('http://localhost:3000/api/users');
    setUsers(response.data)

  };


  useEffect(() => {
    fetchUsersinfo();
    fetchBranch();
  }, [])


  const deleteUser = async(userID) =>{
    await axios.delete(`http://localhost:3000/api/delete_account/${userID}`);
    fetchUsersinfo();

  };

  //CANCULATE UNREAD NOTIFICATION
  const unreadCount = notify.filter(notification => !notification.is_read).length;



  return (

    <>

      {/*BRING BACK LATER IN THE DEVELOPMENT::: <NavBar />*/}


      {/*COMPONENTS*/}
      <AddSaleModalForm
         isModalOpen={isModalOpen}
         productsData={productsData}
         setIsModalOpen={setIsModalOpen}
      
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
        
      />


      <ProductTransactionHistory
        isProductTransactOpen={isProductTransactOpen}
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


          {/*USER MANAGEMENT PAGE*/}
          <Route path="/user_management" exact element={ 
              <RouteProtection allowedRoles={['Owner']}>

                  <UserManagement
                    handleUserModalOpen={handleUserModalOpen}
                    setOpenUsers={setOpenUsers}
                    setUserDetailes={setUserDetailes}
                    sanitizeInput={sanitizeInput}
                    users={users}
                  
                  />

              </RouteProtection>
        
          }/>


          {/*SALES TRANSACTION PAGE*/}
          <Route path="/sales" exact element={ 
              <RouteProtection allowedRoles={['Sales Associate']}>

                  <Sales
                    setIsModalOpen={setIsModalOpen}
                  
                  />

              </RouteProtection>
        
          }/>


          {/*DELIVERY PAGE*/}
          <Route path="/delivery" exact element={ 
              <RouteProtection allowedRoles={['Sales Associate']}>

                  <DeliveryMonitoring/>

              </RouteProtection>
        
          }/>


        </Route>

      </Routes>
  
    </>
   


  );
}

export default App;