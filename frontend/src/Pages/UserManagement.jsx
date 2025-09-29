import { MdGroupAdd } from "react-icons/md";
import NoInfoFound from "../components/common/NoInfoFound";
import { useState } from "react";
import { MdOutlineDesktopAccessDisabled, MdOutlineDesktopWindows } from "react-icons/md";
import EnableDisableAccountDialog from "../components/dialogs/EnableDisableAccountDialog";
import ChartLoading from "../components/common/ChartLoading";


function UserManagement({handleUserModalOpen, users, user, setOpenUsers, setUserDetailes, sanitizeInput, disableEnableAccount, usersLoading}) {



  const [searchItem, setSearchItem] = useState('');


  const [openAccountStatusDialog, setOpenAccountStatusDialog] = useState(false);
  const [userStatus, setUserStatus] = useState(false);
  const [userInfo, setUserInfo] = useState({});
  

  const handleSearch = (event) =>{
    setSearchItem(sanitizeInput(event.target.value));

  }


  const filteredUserData = users.filter((user) => 
    user.full_name.toLowerCase().includes(searchItem.toLowerCase()) || 
    user.branch.toLowerCase().includes(searchItem.toLowerCase())
  );



  return (
      <div className='ml-[220px] px-8 py-2 max-h-screen'>

        {openAccountStatusDialog && 
              
          <EnableDisableAccountDialog
              onClose={() => setOpenAccountStatusDialog(false)}
              status={userStatus}
              action={()=> {disableEnableAccount(userInfo)}}
          />
        }


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
              placeholder="Search Employee Name or Role"
              className="border outline outline-1 outline-gray-400 focus:outline-green-700 focus:py-2 transition-all px-3 py-2 rounded w-full h-9"
              onChange={handleSearch}
              
            />

          </div>
          
          <div  className="ml-auto flex gap-3">

              {/*ADD NEW USER BTN*/}
              <button className='inline-flex items-center border bg-[#29a419] text-white px-5 py-2 rounded-md transition-all' onClick={() => handleUserModalOpen('add')}><MdGroupAdd className="mr-2"/>ADD NEW USER</button>

          </div>

          

   
        </div>

        <hr className="border-t-2 my-4 w-full border-gray-500"/>


        {/*TABLE */}
        <div className="overflow-x-auto  overflow-y-auto h-[600px] border-b-2 border-gray-500 bg-red rounded-sm hide-scrollbar">
          <table className={`w-full ${filteredUserData.length === 0 ? 'h-full' : ''} divide-y divide-gray-200  text-sm`}>
            <thead className="sticky top-0 bg-gray-100 z-10">
              <tr>
                
                  <th className="bg-green-500 px-4 py-2 text-left text-sm font-medium text-white">
                    NAME
                  </th>

                  {user && user.role.some(role => ['Owner'].includes(role)) && 

                    <th className="bg-green-500 px-4 py-2 text-left text-sm font-medium text-white w-52 ">
                      BRANCH
                    </th>
            
                  }
                  
                  <th className="bg-green-500 px-4 py-2 text-left text-sm font-medium text-white w-52">
                    ROLE
                  </th>
                  <th className="bg-green-500 px-4 py-2 text-left text-sm font-medium text-white w-44">
                    CELL NUMBER
                  </th>
                  <th className="bg-green-500 px-4 py-2 text-center text-sm font-medium text-white w-36">
                    STATUS
                  </th>
                  <th className="bg-green-500 px-4 py-2 text-center text-sm font-medium text-white w-48">
                    ACTION
                  </th>
                  
               
              </tr>
            </thead>

            <tbody className="bg-white relative">

              {usersLoading ? 
                (
                  <tr>
                    <td colSpan={10}>
                        <ChartLoading message="Loading users..."/>
                    </td>
                  </tr>
                )
                :
                
                (filteredUserData.length === 0 ? 
                  (
                    <NoInfoFound col={10}/>
                  ) : 

                  (
                    filteredUserData.map((row, rowIndex) => (
                  
                      <tr key={rowIndex} className={`${!row.is_disabled ? 'hover:bg-gray-200/70': ''} h-14 ${row.is_disabled ? 'bg-red-200': (rowIndex + 1 ) % 2 === 0 ? "bg-[#F6F6F6]":""} cursor-pointer ${row.is_disabled ? 'text-red-900':''}` } onClick={() => {setOpenUsers(true); setUserDetailes(row);}} >
                        <td className="px-4 py-2"  >{row.full_name}</td>
                        {user && user.role.some(role => ['Owner'].includes(role)) && 
                          <td className="px-4 py-2 font-medium whitespace-nowrap" >{row.branch}</td>
                        }
                        <td className="px-4 py-2 whitespace-nowrap"  >

                            {Array.isArray(row.role)
                                ? (row.role.length > 1
                                    ? row.role.join(", ")
                                    : row.role[0] || "")
                                : row || ""}

                        </td>
                        <td className="px-4 py-2"  >{row.cell_number}</td>
                        <td className="px-4 py-2 text-center align-middle">
                          <div className={`mx-auto text-center font-semibold w-32 rounded-full px-5 py-1 ${row.is_active ? 'bg-[#61E85C] text-green-700 ' : row.is_disabled ? 'bg-red-400 text-red-800' : 'bg-gray-200 text-gray-500' }`}> 
                              {row.is_active ? 'Active' : row.is_disabled ? 'Disabled' : 'Inactive'}
                          </div>
                        </td>

                        <td className="text-center align-middle">
                          <button
                            className={`py-2 px-4 ${row.is_disabled ? 'bg-green-500 text-white':'bg-gray-300 text-gray-500'} w-auto rounded-md flex items-center justify-center gap-2 mx-auto`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setUserStatus(row.is_disabled);
                              setUserInfo(row);
                              setOpenAccountStatusDialog(true);
                            }}
                          >
                            {row.is_disabled ? <MdOutlineDesktopWindows /> : <MdOutlineDesktopAccessDisabled />}
                            {row.is_disabled ? "Enable account" : "Disable account"}
                          </button>
                        </td>

                      </tr>
                    ))
                  )
                )
              }
              
            </tbody>

          </table>
        </div>
      
          
          
      </div>
  
    )
}

export default UserManagement