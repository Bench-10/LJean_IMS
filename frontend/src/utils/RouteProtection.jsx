import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../authentication/Authentication'

function RouteProtection({children}) {
  const {user} = useAuth();


  return user ? children : <Navigate to="/" replace />;
}

export default RouteProtection