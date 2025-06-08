import axios from "axios";
import { useState, useEffect } from "react";
import ModalForm from "./components/ModalForm";
import NavBar from "./components/navBar";
import ProductInventory from "./Pages/ProductInventory";


function App() {

  const [isOpen, setIsOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add');
  const [itemData, setItemData] = useState(null);
  const [productsData, setProductsData] = useState([]);


  const fetchProductsData = async () =>{
      try {
        const response = await axios.get('http://localhost:3000/api/items/');
        setProductsData(response.data);
      } catch (error) {
        setError(error.message);
        
      }
  };


  useEffect(() =>{
      fetchProductsData();
  }, []);


  const handleOpen = (mode, items) =>{
    setItemData(items);
    setIsOpen(true);
    setModalMode(mode);
  };

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

      <ProductInventory handleOpen={handleOpen} setProductsData={setProductsData} productsData={productsData}/>

      <ModalForm isOpen={isOpen} OnSubmit={handleSubmit} mode={modalMode} 
      onClose={() => setIsOpen(false)} itemData={itemData}/>


    </div>
   


  );
}

export default App;