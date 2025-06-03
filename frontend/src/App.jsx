
import { useState } from "react";
import ModalForm from "./components/ModalForm";
import NavBar from "./components/navBar";
import ProductInventory from "./Pages/productInventory";
import { console } from "inspector";


function App() {

  const [isOpen, setIsOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add');

  const handleOpen = (mode) =>{
    setIsOpen(true);
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

      <ProductInventory onOpen={() => handleOpen('add')}/>

      <ModalForm/>


    </div>
   


  )
}

export default App;