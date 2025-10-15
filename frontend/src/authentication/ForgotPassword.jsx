import React, { useState } from 'react';
import { FiArrowLeft, FiCheck, FiAlertCircle } from 'react-icons/fi';
import { IoMdMailUnread } from "react-icons/io";
import api from '../utils/api';

const ForgotPassword = ({ onBackToLogin }) => {

    const [email, setEmail] = useState('');
    const [userType, setUserType] = useState('user');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');


    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');
        setError('');
        setSuccess(false);


        try {
          const response = await api.post('/api/password-reset/request', {
            email: email.trim(),
            userType,
          });


          const data = response.data;

          if (data.success) {
            setSuccess(true);
            setMessage(data.message);
            setEmail(''); //CLEAR FORM
          } else {
            setError(data.message);
          }

        } catch (err) {

          console.error('Password reset request error:', err);
          if (err.response && err.response.data && err.response.data.message) {
            setError(err.response.data.message);
          } else {
            setError('Network error. Please check your connection and try again.');
          }
        } finally {
          setLoading(false);
        }
    };

    if (success) {

      return (

        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="w-full max-w-md">
            <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <FiCheck className="text-green-600 text-2xl" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Email Sent!
              </h2>
              <p className="text-gray-600 mb-6 leading-relaxed">
                {message}
              </p>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <p className="text-yellow-800 text-sm">
                  <FiAlertCircle className="inline mr-2" />
                  The reset link will expire in 1 hour for security reasons.
                </p>
              </div>
              <button
                onClick={onBackToLogin}
                className="w-full flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <FiArrowLeft className="mr-2" />
                Back to Login
              </button>
            </div>
          </div>
        </div>
      );
    }


  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      <div className="w-full max-w-md">
         {/*ERROR MESSAGE*/}      
        <div className="bg-white rounded-2xl shadow-xl p-8 border-2 relative">
            {error && (
              <div className="bg-red-500 rounded-md p-3 absolute top-4 inset-x-4 z-50 shadow-md">
                <p className="text-white text-sm flex items-center">
                  <FiAlertCircle className="mr-2 flex-shrink-0 text-white" />
                  {error}
                </p>
              </div>
            )}

          {/* Header */}
          <div className="text-center mb-8">
            <div className=" flex items-center justify-center mx-auto mb-9">
              <IoMdMailUnread className="text-green-600 text-4xl" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              Forgot Password?
            </h2>
            <p className="text-gray-600 text-xs">
              Enter your email address and we'll send you a reset link.
            </p>
          </div>
          
          {/*FORME */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/*USER SELECTION */}
            <div className='text-center mb-4'>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Account Type
              </label>
              <div className="flex space-x-4 justify-center">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="user"
                    checked={userType === 'user'}
                    onChange={(e) => setUserType(e.target.value)}
                    className="text-green-600 focus:ring-green-500"
                    disabled={loading}
                  />
                  <span className="ml-2 text-sm text-gray-700">User</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="admin"
                    checked={userType === 'admin'}
                    onChange={(e) => setUserType(e.target.value)}
                    className="text-green-200 focus:ring-green-500"
                    disabled={loading}
                  />
                  <span className="ml-2 text-sm text-gray-700">Administrator</span>
                </label>
              </div>
            </div>

            {/*EMAIL INPUT*/}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email address"
                required
                className="w-full px-3 py-2 border border-gray-400 rounded-md"
                disabled={loading}
              />
            </div>

            {/*SUBMIT */}
            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Sending Email...
                </div>
              ) : (
                'Send Reset Link'
              )}
            </button>
          </form>

          {/*BACK TO LOGIN PAGE */}
          <div className="mt-6 text-center">
            <button
              onClick={onBackToLogin}
              className="text-green-600 hover:text-green-700 text-sm font-medium flex items-center justify-center w-full"
            >
              <FiArrowLeft className="mr-1" />
              Back to Login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};


export default ForgotPassword;