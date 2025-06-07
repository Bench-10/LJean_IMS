import axios from "axios";
import { useState } from "react";
import ModalForm from "./components/ModalForm";
import NavBar from "./components/navBar";
import ProductInventory from "./Pages/ProductInventory";


function App() {

  const [isOpen, setIsOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add');
  const [itemData, setItemData] = useState(null);

  const handleOpen = (mode) =>{
    setIsOpen(true);
    setModalMode(mode);
  };

  const handleSubmit = async (newItem) =>{
    if (modalMode === 'add'){
      try {
        const response = await axios.post('http://localhost:3000/api/items/', newItem);
        console.log('Item Added', response.data);
        
      } catch (error) {
         console.error('Error adding Item', error);
      }

      console.log('hello add');
    } else{
      console.log('edit');
    }
  };


  return (

    <div>

      <NavBar />

      <ProductInventory handleOpen={handleOpen}/>

      <ModalForm isOpen={isOpen} OnSubmit={handleSubmit} mode={modalMode} 
      onClose={() => setIsOpen(false)} itemData={itemData}/>


    </div>
   


  );
}

export default App;