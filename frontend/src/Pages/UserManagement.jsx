import { useState, useEffect } from "react";
import { MdGroupAdd } from "react-icons/md";
import axios from 'axios';
import NoInfoFound from "../utils/NoInfoFound";



function UserManagement({handleUserModalOpen}) {

  const [users, setUsers] = useState('');

  const fetchUsersinfo = async() =>{

    const response = await axios.get('http://localhost:3000/api/users');
    setUsers(response.data)

  };


  useEffect(() => {
    fetchUsersinfo();
  }, [])



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
              placeholder="Search Item Name or Category"
              className="border outline outline-1 outline-gray-400 focus:outline-green-700 focus:py-2 transition-all px-3 py-2 rounded w-full h-9"
              
            />

          </div>

          <div  className="ml-auto flex">

              {/*ADD NEW USER BTN*/}
              <button className='inline-flex items-center border bg-[#29a419] text-white px-5 rounded-md transition-all' onClick={() => handleUserModalOpen()}><MdGroupAdd className="mr-2"/>ADD NEW USER</button>

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
                  <th className="bg-green-500 px-4 py-2 text-left text-sm font-medium text-white w-64 ">
                    BRANCH
                  </th>
                  <th className="bg-green-500 px-4 py-2 text-left text-sm font-medium text-white w-64">
                    ROLE
                  </th>
                  <th className="bg-green-500 px-4 py-2 text-left text-sm font-medium text-white w-40">
                    CELL NUMBER
                  </th>
                  <th className="bg-green-500 px-4 py-2 text-center text-sm font-medium text-white w-60">
                    STATUS
                  </th>
                  
               
              </tr>
            </thead>

            <tbody className="bg-white">

              {users.length === 0 ? 
                (
                  <NoInfoFound col={10}/>
                ) : 

                (
                  users.map((row, rowIndex) => (
                
                    <tr key={rowIndex} className={`hover:bg-gray-200/70 h-14 ${(rowIndex + 1 ) % 2 === 0 ? "bg-[#F6F6F6]":""}` } >
                      <td className="px-4 py-2"  >{row.full_name}</td>
                      <td className="px-4 py-2 font-medium whitespace-nowrap"  >{row.branch}</td>
                      <td className="px-4 py-2 whitespace-nowrap"  >{row.role}</td>
                      <td className="px-4 py-2"  >{row.cell_number}</td>
                      <td className="px-4 py-2 text-center"  >Active</td>

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