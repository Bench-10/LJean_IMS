
import { useState } from "react";
import ModalForm from "./components/ModalForm";
import NavBar from "./components/navBar";
import ProductInventory from "./Pages/productInventory";


function App() {

  const [isOpen, setIsOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add');

  const handleOpen = (mode) =>{
    setIsOpen(true);
    setModalMode(mode);
  };

  const handleSubmit = () =>{
    if (modalMode === 'add'){
      console.log('hello add');
    } else{
      console.log('edit');
    }
  }


  return (

    <div>

      <NavBar />

      <ProductInventory handleOpen={handleOpen}/>

      <ModalForm isOpen={isOpen} onSubmit={handleSubmit} mode={modalMode} 
      onClose={() => setIsOpen(false)}/>


    </div>
   


  )
}

export default App;