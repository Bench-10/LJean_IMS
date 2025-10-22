import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../authentication/Authentication'
import { RiErrorWarningLine } from "react-icons/ri";

function RouteProtection({allowedRoles = [], children}) {
  const {user} = useAuth();


  //ALWAYS ROUTE TO THE LOGIN PART IF THERE IS NO USER
  if (!user) return <Navigate to="/" replace />;

  
  //THIS WILL RETURN IF LOGIN BUT DONT HAVE ACCESS TO THE PAGE
  if (
    allowedRoles.length > 0 &&
    (
      Array.isArray(user.role)
        ? !user.role || !user.role.some(role => allowedRoles.includes(role))
        : !allowedRoles.includes(user.role)
    )
  ) 
    return (
        <div className='ml-[220px] flex justify-center items-center h-screen'>

            {/*ALERT CONTAINER*/}
            <div className='flex flex-col justify-center items-center text-gray-500'>
                <RiErrorWarningLine className='size-24 mb-3'/>
                <h1 className='font-bold text-3xl mb-3'>Access Denied</h1>
                <p>You do not have permission to view this page.</p>

            </div>
            
        </div>
        
    );


  return children

 
}

export default RouteProtection
