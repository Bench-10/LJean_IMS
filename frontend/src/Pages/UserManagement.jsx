import { MdGroupAdd } from "react-icons/md";
import NoInfoFound from "../utils/NoInfoFound";
import { GrView } from "react-icons/gr";
import { useState } from "react";



function UserManagement({handleUserModalOpen, users, setOpenUsers, setUserDetailes, sanitizeInput}) {



  const [searchItem, setSearchItem] = useState('');
  

  const handleSearch = (event) =>{
    setSearchItem(sanitizeInput(event.target.value));

  }


  const filteredUserData = users.filter((user) => 
    user.full_name.toLowerCase().includes(searchItem.toLowerCase()) || 
    user.branch.toLowerCase().includes(searchItem.toLowerCase()) || 
    user.role.toLowerCase().includes(searchItem.toLowerCase())
  );



  return (
      <div className='ml-[220px] p-8 max-h-screen'>
        {/*TITLE*/}
        <h1 className=' text-4xl font-bold text-green-900'>
          USER MANAGEMENT
        </h1>

        <hr className="mt-3 mb-6 border-t-4 border-green-800"/>


        {/*SEARCH AND ADD*/}
        <div className='flex w-full'>
          {/*SEARCH */}
          <div className='w-[400px]'>
            
            <input
              type="text"
              placeholder="Search Employee Name or Branch or Role"
              className="border outline outline-1 outline-gray-400 focus:outline-green-700 focus:py-2 transition-all px-3 py-2 rounded w-full h-9"
              onChange={handleSearch}
              
            />

          </div>

          <div  className="ml-auto flex">

              {/*ADD NEW USER BTN*/}
              <button className='inline-flex items-center border bg-[#29a419] text-white px-5 rounded-md transition-all' onClick={() => handleUserModalOpen('add')}><MdGroupAdd className="mr-2"/>ADD NEW USER</button>

          </div>

          

   
        </div>

        <hr className="border-t-2 my-4 w-full border-gray-500"/>


        {/*TABLE */}
        <div className="overflow-x-auto  overflow-y-auto h-[600px] border-b-2 border-gray-500 bg-red rounded-sm hide-scrollbar">
          <table className="w-full divide-y divide-gray-200  text-sm">
            <thead className="sticky top-0 bg-gray-100">
              <tr>
                
                  <th className="bg-green-500 px-4 py-2 text-left text-sm font-medium text-white">
                    NAME
                  </th>
                  <th className="bg-green-500 px-4 py-2 text-left text-sm font-medium text-white w-52 ">
                    BRANCH
                  </th>
                  <th className="bg-green-500 px-4 py-2 text-left text-sm font-medium text-white w-52">
                    ROLE
                  </th>
                  <th className="bg-green-500 px-4 py-2 text-left text-sm font-medium text-white w-44">
                    CELL NUMBER
                  </th>
                  <th className="bg-green-500 px-4 py-2 text-center text-sm font-medium text-white w-36">
                    STATUS
                  </th>
                  <th className="bg-green-500 px-4 py-2 text-center text-sm font-medium text-white w-44">
                    ACTION
                  </th>
                  
               
              </tr>
            </thead>

            <tbody className="bg-white">

              {filteredUserData.length === 0 ? 
                (
                  <NoInfoFound col={10}/>
                ) : 

                (
                  filteredUserData.map((row, rowIndex) => (
                
                    <tr key={rowIndex} className={`hover:bg-gray-200/70 h-14 ${(rowIndex + 1 ) % 2 === 0 ? "bg-[#F6F6F6]":""} cursor-pointer` } onClick={() => {setOpenUsers(true); setUserDetailes(row);}} >
                      <td className="px-4 py-2"  >{row.full_name}</td>
                      <td className="px-4 py-2 font-medium whitespace-nowrap"  >{row.branch}</td>
                      <td className="px-4 py-2 whitespace-nowrap"  >{row.role}</td>
                      <td className="px-4 py-2"  >{row.cell_number}</td>
                      <td className="px-4 py-2 text-center align-middle">
                        <div className={`mx-auto text-center font-semibold w-32 rounded-full px-5 py-1 ${row.is_active ? 'bg-[#61E85C] text-green-700 ' : 'bg-[#f97878] text-red-900' }`}> 
                            {row.is_active ? 'Active' : 'Inactive'}
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex justify-center items-center h-full">
                          <button className="bg-blue-500 py-2 px-3 rounded-md text-xs flex items-center gap-2 text-white hover:bg-blue-400">
                            <GrView />
                            View More
                          </button>
                        </div>
                      </td>
                      

                    </tr>
                  ))
                ) 
              }
              
            </tbody>

          </table>
        </div>
      
          
          
      </div>
  
    )
}

export default UserManagement