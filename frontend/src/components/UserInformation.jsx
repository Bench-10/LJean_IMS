import React, { useEffect } from 'react'
import { useAuth } from '../authentication/Authentication'
import { FiEdit } from "react-icons/fi";
import { MdDelete } from "react-icons/md";
import { RxCross2 } from "react-icons/rx";

function UserInformation({openUsers, userDetailes, onClose, handleUserModalOpen, deleteUser}) {

  const {user} = useAuth();


  return (
    <div>
        {openUsers && user.role === 'Owner' &&(
            <div
            className="fixed inset-0 bg-black/35 bg-opacity-50 z-40 backdrop-blur-[1px]"
            style={{ pointerEvents: 'auto' }}  onClick={onClose}
            />
        )}

        <dialog className="bg-transparent fixed top-0 bottom-0  z-50 animate-popup" open={openUsers && user.role === 'Owner'}>

            <div className='bg-white rounded-lg w-[900px]'>
              
              {/*HEADER */}
              <div className='bg-green-800 p-4 rounded-t-md flex justify-between items-center'>
                  <h1 className='text-white font-bold text-2xl'>USER DETAILES</h1> 

                  <div>
                    <RxCross2 className='text-white text-lg cursor-pointer' onClick={onClose}/>
                  </div>

              </div>


              {/*BODY */}
              <div className='p-6 flex w-full'>

                {/*LEFT SIDE */}
                <div className='w-full flex flex-col gap-y-5 mr-4'> 

                    <div className='p-5 bg-gray-100 rounded-md'>
                        <h1 className='mb-1 font-semibold text-xs'>FIRST NAME</h1>
                        <span className='text-lg font-semibold'>{userDetailes.first_name}</span>

                    </div>

                    <div className='p-5 bg-gray-100 rounded-md'>
                        <h1 className='mb-1 font-semibold text-xs'>BRANCH</h1>
                        <span className='text-lg font-semibold'>{userDetailes.branch}</span>

                    </div>

                    <div className='p-5 bg-gray-100 rounded-md'>
                        <h1 className='mb-1 font-semibold text-xs'>CELL NUMBER</h1>
                        <span className='text-lg font-semibold'>{userDetailes.cell_number}</span>

                    </div>

                    <div className='p-5 bg-gray-100 rounded-md'>
                        <h1 className='mb-1 font-semibold text-xs'>STATUS</h1>
                        <span className={`text-lg font-semibold py-1 px-4 rounded-full ${userDetailes.is_active ? 'bg-green-500 text-green-900': 'bg-red-500 text-red-900' } `}>{userDetailes.is_active ? 'Active':'Inactive'}</span>

                    </div>

                    <div className='p-5 bg-gray-100 rounded-md'>
                        <h1 className='mb-1 font-semibold text-xs'>PERMISSIONS</h1>
                        <span className='text-xs font-semibold'>{userDetailes.permissions}</span>

                    </div>






                </div>

                {/*RIGHT SIDE */}
                <div className='w-full flex flex-col gap-y-5 mr-4'>

                    <div className='p-5 bg-gray-100 rounded-md'>
                        <h1 className='mb-1 font-semibold text-xs'>LAST NAME</h1>
                        <span className='text-lg font-semibold'>{userDetailes.last_name}</span>

                    </div>

                    <div className='p-5 bg-gray-100 rounded-md'>
                        <h1 className='mb-1 font-semibold text-xs'>ROLE</h1>
                        <span className='text-lg font-semibold'>{userDetailes.role}</span>

                    </div>

                    <div className='p-5 bg-gray-100 rounded-md'>
                        <h1 className='mb-1 font-semibold text-xs'>ADDRESS</h1>
                        <span className='text-lg font-semibold'>{userDetailes.address}</span>

                    </div>

                    <div className='p-5 bg-gray-100 rounded-md'>
                        <h1 className='mb-1 font-semibold text-xs'>HIRE DATE</h1>
                        <span className='text-lg font-semibold'>{userDetailes.formated_hire_date}</span>

                    </div>

                    <div className='p-5 bg-gray-100 rounded-md'>
                        <h1 className='mb-1 font-semibold text-xs'>LAST LOGIN</h1>
                        <span className='text-lg font-semibold'>{userDetailes.last_login}</span>

                    </div>

                </div>



              </div>

              {/*BUTTONS */}
              <div className='flex justify-center mb-5 p-11 gap-x-10 text-white' >

                <button className='py-2 px-3 bg-blue-600 w-44 rounded-md flex items-center justify-center gap-2 hover:bg-blue-500' onClick={() => handleUserModalOpen('edit')}>
                    <FiEdit />Edit
                </button>


                <button className='py-2 px-3 bg-red-600 w-44 rounded-md flex items-center justify-center gap-2 hover:bg-red-500' onClick={() => {deleteUser(userDetailes.user_id); onClose()}}>
                    <MdDelete />Delete
                </button>



              </div>

            </div>


        </dialog>




    </div>
  )
}

export default UserInformation