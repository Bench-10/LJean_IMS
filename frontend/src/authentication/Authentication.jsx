import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import api, { cancelAllPendingRequests } from '../utils/api';


const AuthContext = createContext();


function Authentication ({ children }) {

    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const hasAttemptedAuth = useRef(false);

    // Fetch current user from backend on mount (using JWT cookie)
    useEffect(() => {
        // Only attempt once per app load
        if (hasAttemptedAuth.current) return;
        hasAttemptedAuth.current = true;

        const fetchCurrentUser = async () => {
            try {
                const response = await api.get('/api/me');
                setUser(response.data);
            } catch (error) {
                // No valid session - user needs to login
                setUser(null);
            } finally {
                setLoading(false);
            }
        };

        fetchCurrentUser();
    }, []);



    const loginAuthentication = async (username, password) => {
      try {
        const response = await api.post(`/api/authentication`, { username, password });
        const userData = response.data?.user;

        if (!userData) {
          throw new Error('Invalid authentication response');
        }

        // Store user in state (data comes from backend, not localStorage)
        setUser(userData);
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



    const logout = async (skipApiCall = false) => {
      cancelAllPendingRequests();
      // SEND LOGOUT API CALL FOR ALL USER TYPES TO UPDATE STATUS (UNLESS SKIPPED FOR DELETED USERS)
      if (!skipApiCall && user && user.user_id) {
        try {
          await api.put(`/api/authentication/${user.user_id}`, { activity: false });
        } catch (error) {
          console.error('Error updating logout status:', error);
        }
      }

      setUser(null);
    };



    return (
      <AuthContext.Provider value={{user, loginAuthentication, logout, loading}}>
        {loading ? (
          <div className="min-h-screen flex items-center justify-center">
            <div className="text-center">
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-green-800 mb-2">L-JEAN TRADING</h1>
                <p className="text-lg text-gray-600">Construction and Supply</p>
              </div>
              <div className="flex flex-col items-center space-y-4">
                {/* SOLID SPINNER */}
                <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
            </div>
          </div>
        ) : (
          children
        )}
      </AuthContext.Provider>
    )
}



export default Authentication;
export const useAuth = () => useContext(AuthContext);
