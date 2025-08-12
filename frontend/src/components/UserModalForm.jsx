import React, { useEffect, useState } from 'react';
import { useAuth } from '../authentication/Authentication';
import { RxCross2 } from "react-icons/rx";
import axios from 'axios';

function UserModalForm({branches, isModalOpen, onClose, mode, fetchUsersinfo, userDetailes, setUserDetailes}) {


  //FOR USER ROLE AUTHENTICATION
  const {user} = useAuth();


  //USERINFO FIELDS
  const [first_name, setFirstName] = useState('');
  const [last_name, setLastname] = useState('');
  const [branch, setBranch] = useState('');
  const [role, setRole] = useState('');
  const [cell_number, setCellNumber] = useState('');
  const [address, setAddress] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');


  //STATES FOR ERROR HANDLING
  const [emptyField, setEmptyField] = useState({});

 
  //USER ROLES
  const userRole = [
    'Branch Manager',
    'Inventory Staff',
    'Sales Associate'
  ];


  //FETCH THE DATA ONCE
  useEffect(() =>{
    if (!user) return;

    setEmptyField({});

    if (isModalOpen && mode === 'add' && user.role === 'Owner'){
        setFirstName('');
        setLastname('');
        setBranch('');
        setRole('');
        setCellNumber('');
        setAddress('');
        setUsername('');
        setPassword('');
    }


    if (isModalOpen && mode === 'edit' && user.role === 'Owner' && userDetailes){
        setFirstName(userDetailes.first_name);
        setLastname(userDetailes.last_name);
        setBranch(userDetailes.branch_id);
        setRole(userDetailes.role);
        setCellNumber(userDetailes.cell_number);
        setAddress(userDetailes.address);
        setUsername(userDetailes.username);
        setPassword(userDetailes.password);
    }
    
  }, [isModalOpen, user]);


  const validateInputs = () => {
    
    const isEmptyField = {};
    

    //CHECK IF INPUT IS EMPTY
    if (!String(first_name).trim()) isEmptyField.first_name = true;
    if (!String(last_name).trim()) isEmptyField.last_name = true;
    if (!String(branch).trim()) isEmptyField.branch = true;
    if (!String(role).trim()) isEmptyField.role = true;
    if (!String(cell_number).trim()) isEmptyField.cell_number = true;
    if (!String(address).trim()) isEmptyField.address = true;
    if (!String(username).trim()) isEmptyField.username = true;
    if (!String(password).trim()) isEmptyField.password = true;

    setEmptyField(isEmptyField);
 
    if (Object.keys(isEmptyField).length > 0) return false; 

    return true;

  };



  const submitUserConfirmation = async (e) => {
     e.preventDefault();

     if(!validateInputs()){
        return;
     }


     const userData = {
        first_name,
        last_name,
        branch,
        role,
        cell_number,
        address,
        username,
        password,

     };


     if (mode === 'add'){
        try {
        const response = await axios.post('http://localhost:3000/api/create_account', userData);
        fetchUsersinfo();
        console.log('Item Added', response.data);
        
        } catch (error) {
            console.error('Error adding Item', error);
        }

     };


     if (mode === 'edit'){
        try {
        const response = await axios.put(`http://localhost:3000/api/update_account/${userDetailes.user_id}`, userData);
        await fetchUsersinfo();
        await setUserDetailes(response.data);
        
        
        } catch (error) {
            console.error('Error adding Item', error);
        }

     };

     onClose();

  };

  const inputDesign = (field) => `w-full h-10 p-2 outline-green-700 border-gray-300 border-2 rounded-md ${emptyField[field] ? 'border-red-500' : ''}`;

  const errorflag = (field, field_warn) =>{
    if (emptyField[field])
      return <div className={`italic text-red-500 absolute ${field_warn === 'date' ? 'top-16':'top-17'} pl-2 text-xs mt-1`}>{`Please enter a ${field_warn}!`}</div>
      
  };

  return (
    <div>
        {isModalOpen && user.role === 'Owner' &&(
            <div
            className="fixed inset-0 bg-black/35 bg-opacity-50 z-100"
            style={{ pointerEvents: 'auto' }}  onClick={onClose}
            />
        )}

        <dialog className='bg-transparent fixed top-0 bottom-0  z-200 rounded-md animate-popup' open={isModalOpen && user.role === 'Owner'}>
            <div className='bg-white text-black w-[700px] rounded-md' >
                {/*HEADER TITLE */}
                <div className='bg-green-800 p-4 rounded-t-md flex justify-between items-center '>
                    <h1 className='text-white font-bold text-2xl'>{mode === 'add' ? 'ADD NEW USER': 'EDIT USER INFORMATION'}</h1>

                    <div>
                        <RxCross2 className='text-white text-lg cursor-pointer' onClick={onClose}/>
                    </div>
                </div>


                {/*FORM BODY*/}
                <div className='p-7 '>

                    <form action="dialog" onSubmit={submitUserConfirmation}>

                        {/*FEILDS CONTAINER*/}
                        <div className='flex gap-x-9 w-full'>

                            
                            {/*LEFT PART*/}
                            <div className='flex flex-col gap-y-8 w-full'>

                                <div className='relative'>

                                    <h2 className='font-semibold text-green-900 text-lg'>First Name</h2>

                                    <input type="text" 
                                    className={inputDesign('first_name')}
                                    value={first_name}
                                    onChange={(e) => setFirstName(e.target.value)}
                                    

                                    />

                                    {errorflag('first_name', 'First Name')}

                                </div>



                                <div>

                                    <h2 className='font-semibold text-green-900 text-lg'>Branch</h2>

                                    <select 
                                        name="" 
                                        id="branch_select" 
                                        className={inputDesign('branch')}
                                        value={branch}
                                        onChange={(e) => setBranch(e.target.value)}

                                    >

                                        <option value="">--Select a branch--</option>
                                        {branches.map((option) => (
                                            <option key={option.branch_id} value={option.branch_id}>{option.branch_name}</option>
                                        ))}

                                    </select>

                                    {errorflag('branch', 'Branch')}


                                </div>



                                <div>

                                    <h2 className='font-semibold text-green-900 text-lg'>Cellphone Number</h2>

                                    <input 
                                    type="text" 
                                    className={inputDesign('cell_number')}
                                    value={cell_number}
                                    onChange={(e) => setCellNumber(e.target.value)}

                                    />

                                    {errorflag('cell_number', 'Cellphone Number')}


                                </div>



                                <div>

                                    <h2 className='font-semibold text-green-900 text-lg'>Username</h2>

                                    <input 
                                    type="text" 
                                    className={inputDesign('username')}
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}

                                    />

                                    {errorflag('username', 'Username')}


                                </div>

                            </div>


                            {/*RIGHT PART*/}
                            <div className='flex flex-col gap-y-8 w-full'>

                                <div>

                                    <h2 className='font-semibold text-green-900 text-lg'>Last Name</h2>

                                    <input 
                                        type="text" 
                                        className={inputDesign('last_name')}
                                        value={last_name}
                                        onChange={(e) => setLastname(e.target.value)}

                                    />

                                    {errorflag('last_name', 'Last Name')}


                                </div>



                                <div>

                                    <h2 className='font-semibold text-green-900 text-lg'>User Role</h2>

                                    <select 
                                        name="" 
                                        id="role_select" 
                                        className={inputDesign('role')}
                                        value={role}
                                        onChange={(e) => setRole(e.target.value)}

                                    >

                                        <option value="">--Select the user role--</option>
                                        {userRole.map((role) => (
                                            <option key={role} value={role}>{role}</option>
                                        ))}

                                    </select>

                                    {errorflag('role', 'User Role')}


                                </div>



                                <div>

                                    <h2 className='font-semibold text-green-900 text-lg'>Address</h2>

                                    <input 
                                        type="text" 
                                        className={inputDesign('address')}
                                        value={address}
                                        onChange={(e) => setAddress(e.target.value)}

                                    />

                                    {errorflag('address', 'Address')}


                                </div>

                                <div>

                                    <h2 className='font-semibold text-green-900 text-lg'>Password</h2>

                                    <input 
                                        type="text" 
                                        className={inputDesign('password')} 
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}

                                    />

                                    {errorflag('password', 'Password')}


                                </div>
                                
                            </div>
                            

                        </div>

                    {/*REGISTER BUTTON*/}
                        <div className='mb-2 mt-12 w-full text-center'>
                            <button type='submit' className='py-2 px-6 bg-green-700 rounded-md text-white'>
                                {mode === 'add' ? 'Register User':'Update User'}
                            </button>
                        </div>
                    </form>

                </div>

            </div>
            
        </dialog>
        
    </div>
  )
}

export default UserModalForm