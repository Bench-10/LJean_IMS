import React, { createContext, useState, useContext, useEffect } from 'react';
import api from '../utils/api';


const AuthContext = createContext();


function Authentication ({ children }) {
  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem('userInfo');
    return storedUser ? JSON.parse(storedUser) : null;
  });


  const loginAuthentication = async (username, password) => {
    try {
      const response = await api.post(`/api/authentication`, { username, password });
      const userData = response.data[0];
      setUser(userData);
      localStorage.setItem('userInfo', JSON.stringify(userData));
      return userData.role ? userData.role : false;
    } catch (error) {
      // Handle specific authentication errors
      if (error.response && error.response.status === 401) {
        const errorMessage = error.response.data.error;
        throw new Error(errorMessage);
      }
      // Handle other errors
      throw new Error('Something went wrong. Please try again.');
    }
  };


  const logout = async () => {

    if (!user || !user.role || !user.role.some(role => ['Owner'].includes(role))){
      await api.put(`/api/authentication/${user.user_id}`, { activity: false });
    }

    setUser(null);

    localStorage.removeItem('userInfo');
    
  };

  return (
    <AuthContext.Provider value={{user, loginAuthentication,  logout}}>
      {children}
    </AuthContext.Provider>
  )
}


export default Authentication;
export const useAuth = () => useContext(AuthContext);
