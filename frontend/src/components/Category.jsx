import React, { useEffect } from 'react'

function Category({isCategoryOpen, onClose, setListCategories, listCategories}) {

  const generateCategories = () => {
    const dbCategories = [
      {category_id: "1", category_name: "Construction Supply"},
      {category_id: "2", category_name: "Electric Supply"},
      {category_id: "3", category_name: "Sewege Supply"},
    ];
    setListCategories(dbCategories);

  };

  useEffect(() =>{
    generateCategories();
  }, generateCategories)

  

  return (
    <div >

        {isCategoryOpen && (
        <div
          className="fixed inset-0 bg-black/35 bg-opacity-50 z-40"
          style={{ pointerEvents: 'auto' }}  onClick={onClose}
        />
       )}

        <dialog className='bg-transparent fixed top-0 bottom-0  z-50' open={isCategoryOpen}>  

            <div className="relative flex flex-col border border-gray-600/40 bg-white h-[600px] w-[600px] rounded-md p-7 pb-14 border-gray-300 animate-popup" >

            <button type='button' className="btn-sm btn-circle btn-ghost absolute right-2 top-2 " 
              onClick={onClose}>✕</button>

              {/*CATEGORIES TITLE*/}
              <div className='flex text-center mt-4'>
                <h1 className='w-full text-4xl font-bold' >
                 CATEGORIES
                </h1>

              </div>

              {/*ADD CATEGORIES */}

              <div className='flex justify-between w-full mt-8 gap-x-5 '>
                <div className='w-[73%]'>
                  <input type="text" placeholder='Category Name' className='w-full border rounded-md  bg-gray-100 border-gray-300 h-10 px-4' />
                </div>

                 <div className='flex align-middle'>
                  <button className='border rounded-md px-3 font-medium bg-[#61CBE0] text-white  hover:bg-[#61CBE0]/90'>Add Category</button>
                </div>
                

              </div>

              {/*CATEGORIES TABLE */}
              <div className='w-full h-full mt-5  overflow-y-auto hide-scrollbar border border-gray-200'>
                <table className='w-full text-left'>
                  <thead className='sticky top-0 h-9  bg-gray-200 '>
                    <tr>
                      <th className='text-center px-2 w-[120px]'>Category ID</th>
                      <th className='text-center px-2'>Category Name</th>
                      <th className='text-center px-2 w-[120px]'>Action</th>

                    </tr> 
                    
                  </thead>

                  <tbody className='divide-gray-100'>
                    {listCategories.map((row, rowIndex) =>(
                      <tr  key={rowIndex} className='h-12'>
                        <td className='text-center px-2'>{row.category_id}</td>
                        <td className='text-center px-2'>{row.category_name}</td>
                        <td className='text-center px-2'>
                          <button className='bg-blue-500 px-5 py-1 border rounded-md text-white'>Edit</button>
                        </td>
                      </tr>

                    ))}

                    
                  </tbody>

                </table>

              </div>
              
            
            </div>
           
        </dialog>

    </div>
  )
}

export default Category