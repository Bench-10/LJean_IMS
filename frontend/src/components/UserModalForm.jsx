import React, { useEffect, useState } from 'react';
import { useAuth } from '../authentication/Authentication';
import { RxCross2 } from "react-icons/rx";
import api from '../utils/api';
import ConfirmationDialog from './dialogs/ConfirmationDialog';
import FormLoading from './common/FormLoading';

function UserModalForm({branches, openUserModal, onClose, mode, fetchUsersinfo, userDetailes, setUserDetailes, setOpenUsers}) {


  //FOR USER ROLE AUTHENTICATION
  const {user} = useAuth();

  // Early return if user data is not loaded
  if (!user || !user.role) {
    return null;
  }


  //USERINFO FIELDS
  const [first_name, setFirstName] = useState('');
  const [last_name, setLastname] = useState('');
  const [branch, setBranch] = useState(user && user.role && user.role.some(role => ['Branch Manager'].includes(role)) ? user.branch_id: '');
  const [role, setRole] = useState({isManager: false, isInventoryStaff: false, isSalesAssociate: false});
  const [cell_number, setCellNumber] = useState('');    
  const [address, setAddress] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');


  //STATES FOR ERROR HANDLING
  const [emptyField, setEmptyField] = useState({});
  const [invalidEmail, setInvalidEmail] = useState(false)
  const [usernameExisting, setUsernameExisting] = useState(false);
  const [passwordCheck, setPasswordCheck] = useState('');
  const [cellCheck, setCellCheck] = useState(false);

  // LOADING STATE
  const [loading, setLoading] = useState(false);

 
  //USER ROLES
  const userRole = [
    'Branch Manager',
    'Inventory Staff',
    'Sales Associate'
  ];


  //FOR DIALOG
  const [openDialog, setDialog] = useState(false);
  const message =  mode === 'add' ? "Are you sure you want to add this ?": "Are you sure you want to add this ?";


  //FETCH THE DATA ONCE
  useEffect(() =>{
    if (!user || !user.role) return;

    setEmptyField({});


    if (openUserModal && mode === 'add' && user && user.role && user.role.some(role => ['Owner', 'Branch Manager'].includes(role))){
        setFirstName('');
        setLastname('');
        setBranch(user && user.role && user.role.some(role => ['Branch Manager'].includes(role)) ? user.branch_id: '');
        setRole({isManager: false, isInventoryStaff: false, isSalesAssociate: false});
        setCellNumber('');
        setAddress('');
        setUsername('');
        setPassword('');
        setPasswordCheck('');
        setUsernameExisting(false);
        setInvalidEmail(false);

        return;
    }



    if (openUserModal && mode === 'edit' && user && user.role && user.role.some(role => ['Owner', 'Branch Manager'].includes(role)) && userDetailes){


        let setDbUserRoles = {isManager: false, isInventoryStaff: false, isSalesAssociate: false};

    
        if(userDetailes.role && userDetailes.role.some(role => ['Branch Manager'].includes(role))){
            setDbUserRoles.isManager = true;
        }

        if(userDetailes.role && userDetailes.role.some(role => ['Inventory Staff'].includes(role))){
            setDbUserRoles.isInventoryStaff = true;
        }

        if(userDetailes.role && userDetailes.role.some(role => ['Sales Associate'].includes(role))){
            setDbUserRoles.isSalesAssociate = true;
        }


        setFirstName(userDetailes.first_name);
        setLastname(userDetailes.last_name);
        setBranch(userDetailes.branch_id);
        setRole(setDbUserRoles);
        setCellNumber(userDetailes.cell_number);
        setAddress(userDetailes.address);
        setUsername(userDetailes.username);
        setPassword(userDetailes.password);
        passwordStrength(userDetailes.password);
        setUsernameExisting(false);
        setInvalidEmail(false);

        return;
    }
    
  }, [openUserModal, user]);


  const passwordStrength = (value) => {
    if (!value || value.length < 8){

        if (passwordCheck === 'Password must be at least 8 characters!'){
            return;
        }

        setPasswordCheck('Password must be at least 8 characters!');
        
        return;

    };


    if (!(/\d/.test(value))){

        if (passwordCheck === 'Password must have at least one number!'){
            return;
        }

        setPasswordCheck('Password must have at least one number!');
 
        return;

    }


    if (!(/[^a-zA-Z0-9]/.test(value))){

        if (passwordCheck === 'Password contain one special character!'){
            return;
        }
        
        setPasswordCheck('Password contain one special character!');
        
        return;
    }


    setPasswordCheck('');


  };


  const validateInputs = async () => {
    
    const isEmptyField = {};

    setCellCheck(false);
    

    //CHECK IF INPUT IS EMPTY
    if (!String(first_name).trim()) isEmptyField.first_name = true;
    if (!String(last_name).trim()) isEmptyField.last_name = true;
    if (!String(branch).trim()) isEmptyField.branch = true;
    if (!Object.values(role).some(Boolean)) isEmptyField.role = true;
    if (!String(cell_number).trim()) isEmptyField.cell_number = true;
    if (!String(address).trim()) isEmptyField.address = true;
    if (!String(username).trim()) isEmptyField.username = true;
    if (!String(password).trim()) isEmptyField.password = true;


 

    setEmptyField(isEmptyField);


    const firstTwo = cell_number.substring(0, 2);


    if (cell_number.length !== 11 || firstTwo !== "09" || /[a-zA-Z]/.test(cell_number)  ) {
        setCellCheck(true);
        return
    }

 
    if (Object.keys(isEmptyField).length > 0) return; 


    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!(re.test(username.trim()))){

        setInvalidEmail(true); 
        
        return;
    } 


    if (passwordCheck && passwordCheck.length !== 0) return;


    if (mode === 'add'|| (userDetailes.username !== username) ){


        //CHECK IF USERNAME ALREADY EXIST
        const response = await api.get(`/api/existing_account`, { params: {username}});

        if (response.data.result){

            setUsernameExisting(true);

            return; 

        } else {

            setUsernameExisting(false);

        }

    }

    

    setDialog(true);
    
  };



  const submitUserConfirmation = async () => {
    try {
      setLoading(true);

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
        const response = await api.post(`/api/create_account`, userData);
        // DON'T MANUALLY REFRESH - LET WEBSOCKET HANDLE REAL-TIME UPDATES
        console.log('User Added', response.data);
        
        } catch (error) {
            console.error('Error adding User', error);
        }

     };


     if (mode === 'edit'){
        try {
        const response = await api.put(`/api/update_account/${userDetailes.user_id}`, userData);
        // DON'T MANUALLY REFRESH - LET WEBSOCKET HANDLE REAL-TIME UPDATES
        await setUserDetailes(response.data);
        
        } catch (error) {
            console.error('Error updating User', error);
        }

     };

     onClose(); 
     setCellCheck(false);
    } catch (error) {
      console.error('Error submitting user:', error);
    } finally {
      setLoading(false);
    }

  };

  const inputDesign = (field) => `w-full h-10 p-2 outline-green-700 border-gray-300 border-2 rounded-md ${emptyField[field] ? 'border-red-500' :  (field === 'username' && usernameExisting ) ? 'border-red-500' : (field === 'username' && invalidEmail ) ? 'border-red-500': (field === 'password' && passwordCheck && passwordCheck.length !== 0 ) ? 'border-red-500' : (field === 'cell_number' && cellCheck) ? 'border-red-500' :'' }`;

  const errorflag = (field, field_warn) =>{
    if (emptyField[field])
      return <div className={`italic text-red-500 absolute ${field_warn === 'date' ? 'top-16':'top-17'} pl-2 text-xs mt-1`}>{`Please ${field === 'role' ? 'pick' : 'enter'} a ${field_warn}!`}</div>

    if (field === 'username' && usernameExisting )
      return <div className={`italic text-red-500 absolute  pl-2 text-xs mt-1`}>{`${field_warn} already exist. Please try another one!`}</div>

    if (field === 'username' && invalidEmail )
      return <div className={`italic text-red-500 absolute  pl-2 text-xs mt-1`}>{`Not a valid email!`}</div>

    if (field === 'password' && passwordCheck && passwordCheck.length !== 0 )
      return <div className={`italic text-red-500 absolute  pl-2 text-xs mt-1`}>{passwordCheck}</div>

    if (field === 'cell_number' && cellCheck)
      return <div className={`italic text-red-500 absolute  pl-2 text-xs mt-1`}>Incorrect format! Must be ex. (09123456789)</div>
      
  };

  return (
    <div>
        {/* Loading overlay */}
        {loading && (
          <FormLoading 
            message={mode === 'add' ? "Creating user..." : "Updating user..."}
          />
        )}

        {openDialog && 
            
            <ConfirmationDialog
                mode={mode}
                message={message}
                submitFunction={() => {submitUserConfirmation(); setOpenUsers(false);}}
                onClose={() => {setDialog(false);}}

            />
        
        }


        {openUserModal && user && user.role && user.role.some(role => ['Owner', 'Branch Manager'].includes(role)) &&(
            <div
            className="fixed inset-0 bg-black/35 bg-opacity-50 z-100 backdrop-blur-[1px]"
            style={{ pointerEvents: 'auto' }}  onClick={onClose}
            />
        )}

        <dialog className='bg-transparent fixed top-0 bottom-0  z-200 rounded-md animate-popup' open={openUserModal && user && user.role && user.role.some(role => ['Owner', 'Branch Manager'].includes(role))}>
            <div className='bg-white text-black w-[700px] rounded-md' >
                {/*HEADER TITLE */}
                <div className='bg-green-800 p-4 rounded-t-md flex justify-between items-center '>
                    <h1 className='text-white font-bold text-2xl'>{mode === 'add' ? 'ADD NEW USER': 'EDIT USER INFORMATION'}</h1>

                    <div>
                        <RxCross2 className='text-white text-lg cursor-pointer' onClick={() => {onClose(); setCellCheck(false);}}/>
                    </div>
                </div>


                {/*FORM BODY*/}
                <div className='p-7 '>

                    <form action="dialog" onSubmit={(e) => {e.preventDefault(); validateInputs();}}>

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

                                    {user && user.role && user.role.some(role => ['Branch Manager'].includes(role)) ? 

                                        <input 
                                            type='text' 
                                            id="branch_select" 
                                            className={inputDesign('branch')}
                                            value={branches.find(b => b.branch_id === branch)?.branch_name || ''}
                                            readOnly

                                        />
                                        :

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
                                    
                                    }


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

                                    <h2 className='font-semibold text-green-900 text-lg'>Email</h2>

                                    <input 
                                    type="text" 
                                    className={inputDesign('username')}
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}

                                    />

                                    {errorflag('username', 'Email')}


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

                                     {user && user.role && user.role.some(role => ['Owner'].includes(role)) && 
                                        <div className='flex items-center gap-x-2 '>
                                            Branch Manager
                                            <input
                                                type="checkbox"
                                                checked={role.isManager}
                                                onChange={(e) => {

                                                    setRole(prev => ({
                                                        ...prev,
                                                        isManager: e.target.checked
                                                    }));
                                                    
                                                }}
                                                className="form-checkbox h-4 w-4 text-amber-500"
                                            />
                                        </div>
                                     }

                                    
                           
                                     <div className='flex items-center gap-x-2 '>
                                        Inventory Staff
                                        <input
                                            type="checkbox"
                                            checked={role.isInventoryStaff}
                                            onChange={(e) => {

                                                setRole(prev => ({
                                                    ...prev,
                                                    isInventoryStaff: e.target.checked
                                                }));

                                                
                                                
                                            }}
                                            className="form-checkbox h-4 w-4 text-amber-500"
                                        />
                                     </div>


                                     <div className='flex items-center gap-x-2 '>
                                        Sales Associate
                                        <input
                                            type="checkbox"
                                            checked={role.isSalesAssociate}
                                            onChange={(e) => {

                                                setRole(prev => ({
                                                    ...prev,
                                                    isSalesAssociate: e.target.checked
                                                }));
                                                
                                            }}
                                            className="form-checkbox h-4 w-4 text-amber-500"
                                        />
                                     </div>


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
                                        onChange={(e) => {
                                            setPassword(e.target.value)
                                            passwordStrength(e.target.value)
                                        }}

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