import axios from "axios";
import { useState, useEffect } from "react";
import ModalForm from "./components/ModalForm";
import NavBar from "./components/NavBar";
import ProductInventory from "./Pages/ProductInventory";
import Notification from "./Pages/Notification";
import ProductValidity from "./Pages/ProductValidity";
import Category from "./components/Category";
import ProductTransactionHistory from "./components/ProductTransactionHistory";
import { Routes, Route} from "react-router-dom";



function App() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCategoryOpen, setIsCategory] = useState(false);
  const [isProductTransactOpen, setIsProductTransactOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add');
  const [itemData, setItemData] = useState(null);
  const [productsData, setProductsData] = useState([]);
  const [listCategories, setListCategories] = useState([]);
  const [isHome, setIsHome] = useState(false);



  //PREVENTS SCRIPTS ATTACKS ON INPUT FIELDS
  function sanitizeInput(input) {
    return input.replace(/[<>\/"']/g, '');
  }

  

  //DISPLAY THE INVENTORY TABLE
  const fetchProductsData = async () =>{
      try {
        const response = await axios.get('http://localhost:3000/api/items/');
        setProductsData(response.data);
      } catch (error) {
        setError(error.message);
        
      }
  };


  //RENDERS THE TABLE
  useEffect(() =>{
      fetchProductsData();
  }, [listCategories]);


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


  return (

    <div>

      <NavBar />


      {/*COMPONENTS*/}
      <Category 
         isCategoryOpen={isCategoryOpen} 
         onClose={() => setIsCategory(false)}  
         listCategories={listCategories} 
         setListCategories={setListCategories} 
         fetchProductsData={fetchProductsData}
         sanitizeInput={sanitizeInput}
         
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

      <ProductTransactionHistory
          isProductTransactOpen={isProductTransactOpen}
          onClose={() => setIsProductTransactOpen(false)}
      />

       {/*EXPERIMENTAL */} {/*PAGES */}
      <Routes>
          
          <Route path="/" exact element={ 
            <ProductInventory 
              setIsCategory={setIsCategory} 
              handleOpen={handleOpen} 
              setProductsData={setProductsData} 
              productsData={productsData}
              setIsProductTransactOpen={setIsProductTransactOpen}

            />
        
          }/>
         

          <Route path="/notification" exact element={
            <Notification />
            
            
          }/>


          <Route path="/product_validity" exact element={
            <ProductValidity 
              sanitizeInput={sanitizeInput}
            
            />
            
            
          }/>



      </Routes>
  

    </div>
   


  );
}

export default App;