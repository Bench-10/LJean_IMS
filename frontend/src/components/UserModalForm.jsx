import React from 'react';
import { useAuth } from '../authentication/Authentication';
import { RxCross2 } from "react-icons/rx";

function UserModalForm({isModalOpen, onClose}) {

  const {user} = useAuth();

  return (
    <div>
        {isModalOpen && user.role === 'Owner' &&(
            <div
            className="fixed inset-0 bg-black/35 bg-opacity-50 z-40"
            style={{ pointerEvents: 'auto' }}  onClick={onClose}
            />
        )}

        <dialog className='bg-transparent fixed top-0 bottom-0  z-50 rounded-md' open={isModalOpen}>
            <div className='bg-white text-black w-[460px] rounded-md' >
                {/*HEADER TITLE */}
                <div className='bg-green-800 p-3 rounded-t-md flex justify-between items-center '>
                    <h1 className='text-white font-bold text-2xl'>ADD NEW USER</h1>

                    <div>
                        <RxCross2 className='text-white text-lg cursor-pointer' onClick={onClose}/>
                    </div>
                </div>


                {/*FORM BODY*/}
                <div className='p-7 flex flex-col gap-y-7'>
                    <div>
                        <h2 className='font-semibold text-green-900 text-lg'>Full Name</h2>
                        <input type="text" className='w-full h-10 p-2 outline-green-700 border-gray-300 border-2 rounded-md '/>

                    </div>
                    

                     <div>
                        <h2 className='font-semibold text-green-900 text-lg'>Branch</h2>
                        <select name="" id="" className='w-full h-10 p-2 outline-green-700 border-gray-300 border-2 rounded-md'>
                            <option value="">--Select a branch--</option>
                            <option value="">2</option>
                            <option value="">3</option>
                            <option value="">4</option>
                            <option value="">5</option>
                            <option value="">6</option>
                        </select>

                    </div>

                     <div>
                        <h2 className='font-semibold text-green-900 text-lg'>User Role</h2>
                        <select name="" id="" className='w-full h-10 p-2 outline-green-700 border-gray-300 border-2 rounded-md'>
                            <option value="">--Select the user role--</option>
                            <option value="">2</option>
                            <option value="">3</option>
                            <option value="">4</option>
                        </select>

                    </div>

                    <div>
                        <h2 className='font-semibold text-green-900 text-lg'>Cellphone Number</h2>
                        <input type="text" className='w-full h-10 p-2 outline-green-700 border-gray-300 border-2 rounded-md'/>

                    </div>

                    <div className='my-4 w-full text-center'>
                        <button type='submit' className='py-2 px-6 bg-green-700 rounded-md text-white'>
                            Register User
                        </button>
                    </div>

                </div>

            </div>
            
        </dialog>
        
        


    </div>
  )
}

export default UserModalForm