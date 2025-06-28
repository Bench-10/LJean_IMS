import React, { useEffect, useState } from 'react'
import axios from 'axios';

function Category({isCategoryOpen, onClose, setListCategories, listCategories, fetchProductsData, sanitizeInput}) {

  const [category_name, setCategoryName] = useState('');
  const [editCategory_name, setEditcategoryName] = useState ('')
  const [openEdit, setOpenEdit] = useState(false);
  const [selectEditCategory, setSelectEditCategory] = useState({});


  useEffect(()=>{
    if (openEdit)
      setEditcategoryName(selectEditCategory.category_name);
  },[selectEditCategory])



  const generateCategories =  async() => {
      try {
        const response = await axios.get('http://localhost:3000/api/categories/');
        setListCategories(response.data);
      } catch (error) {
        setError(error.message);
      }
  };

  useEffect(() =>{
      generateCategories();

  }, [])


  const submitCategory = async (type) =>{

    if (type === 'add'){
      if (category_name.length === 0)
      return;

      try {
        const response = await axios.post('http://localhost:3000/api/categories/', {category_name});
        setListCategories((prevData) => [...prevData, response.data]);
        console.log('Category Added', response.data);
        
      } catch (error) {
        console.error('Error adding Item', error);
      }

    } else if (type === 'edit') {
      try {
        if (editCategory_name.length === 0)
          return

        const category_name = editCategory_name;
        const response = await axios.put(`http://localhost:3000/api/categories/${selectEditCategory.category_id}`, { category_name }  );
        setListCategories((prevData) => 
          prevData.map((cat) => (cat.category_id === selectEditCategory.category_id ? response.data : cat))
        );
        

        console.log('Item Updated', response.data);
        
      } catch (error) {
        console.error('Error adding Item', error);
      }

      setOpenEdit(false);
    }
    
    setCategoryName('');
  }

  
  return (
    <div >

     

        {isCategoryOpen && (
        <div
          className="fixed inset-0 bg-black/35 bg-opacity-50 z-40"
          style={{ pointerEvents: 'auto' }}  onClick={onClose}
        />
       )}

        <dialog className='bg-transparent fixed top-0 bottom-0  z-50' open={isCategoryOpen}>  

            <div className="relative flex flex-col border border-gray-600/40 bg-white h-[600px] w-[600px] rounded-md p-7 pb-14 border-gray-300 animate-popup">

            <button type='button' className="btn-sm btn-circle btn-ghost absolute right-2 top-2 " 
              onClick={() => {onClose(); setOpenEdit(false);}}>✕</button>

              {/*CATEGORIES TITLE*/}
              <div className='flex text-center mt-4'>
                <h1 className='w-full text-4xl font-bold' >
                 CATEGORIES
                </h1>

              </div>

              {/*ADD CATEGORIES */}

              <div className='flex justify-between w-full mt-8 gap-x-5 '>
                <div className='w-[73%]'>
                  <input type="text" placeholder='Category Name' className='w-full border rounded-md  bg-gray-100 border-gray-300 h-10 px-4' value={category_name} onChange={(e) => setCategoryName(sanitizeInput(e.target.value))}/>
                </div>

                 <div className='flex align-middle'>
                  <button className='border rounded-md px-3 font-medium bg-[#61CBE0] text-white  hover:bg-[#53b4c7]' onClick={e => { e.preventDefault(); submitCategory('add'); }}>Add Category</button>
                </div>
                

              </div>

              {/*CATEGORIES TABLE */}
              <div className='w-full h-full mt-5 rounded-lg shadow-sm overflow-y-auto hide-scrollbar border border-gray-200'>
                <table className='w-full text-left'>
                  <thead className='sticky top-0 h-10'>
                    <tr className='bg-gray-200 '>
                      <th className='uppercase text-center text-gray-500  text-md font-medium px-2 w-[130px]'>Category ID</th>
                      <th className='uppercase text-gray-500  text-md font-medium px-7 '>Category Name</th>
                      <th className='uppercase text-center  text-gray-500  text-md font-medium px-2 w-[130px]'>Action</th>

                    </tr> 
                    
                  </thead>

                  <tbody className='divide-gray-100'>
                    {listCategories.map((row, rowIndex) =>(
                      <tr  key={rowIndex} className='h-14 hover:bg-gray-100 transition-colors'>
                        <td className='text-center text-md px-2'>{row.category_id}</td>
                        <td className='px-7 whitespace-nowrap text-gray-900 font-medium'>{row.category_name}</td>
                        <td className='text-center text-sm px-2'>
                          <button className='bg-blue-600 hover:bg-blue-700 px-5 py-1 border rounded-md text-white' onClick={() => {setOpenEdit(true); setSelectEditCategory(row)}}>Edit</button>
                        </td>
                      </tr>

                    ))}

                    
                  </tbody>

                </table>

              </div>

                {/*EDIT CATEGORY POPUP */}

                {openEdit && (
                  //OVERLAY
                  <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-60"  onClick={() => {
                    setOpenEdit(false);
                    setSelectEditCategory({});
                    setEditcategoryName('');
                  }}>
                    
                    <div className="relative w-[400px] bg-white rounded-md p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
                      <button 
                        type="button" 
                        className="absolute right-2 top-2 btn-sm btn-circle btn-ghost" 
                        onClick={() => {
                          setOpenEdit(false);
                          setSelectEditCategory({});
                          setEditcategoryName('');
                        }}
                      >
                        ✕
                      </button>
                      <h3 className="text-lg font-bold mb-4">Edit Category</h3>
                      <div className="flex flex-col gap-4">
                        <input 
                          type="text" 
                          className="border-2 rounded-md px-3 py-2 border-gray-300 w-full" 
                          value={editCategory_name} 
                          onChange={(e) => setEditcategoryName(sanitizeInput(e.target.value))}
                        />
                        <button 
                          className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
                          onClick={() => submitCategory('edit')}
                        >
                          Update Category
                        </button>
                      </div>
                    </div>
                  </div>
                )}
            
            </div>

        </dialog>
        
    </div>
  )
}


export default Category