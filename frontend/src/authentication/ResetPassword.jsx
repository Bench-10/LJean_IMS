import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { FiLock, FiEye, FiEyeOff, FiCheck, FiAlertCircle, FiX } from 'react-icons/fi';
import api from '../utils/api';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [token] = useState(searchParams.get('token'));
  const [userType] = useState(searchParams.get('type') || 'user');
  
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenData, setTokenData] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Verify token on component mount
  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setError('Invalid reset link. No token provided.');
        setVerifying(false);
        return;
      }

      try {
        const response = await api.get(`/api/password-reset/verify/${token}`);
        const data = response.data;

        if (data.success) {
          setTokenValid(true);
          setTokenData(data.data);
        } else {
          setError(data.message);
        }
      } catch (err) {
        console.error('Token verification error:', err);
        if (err.response && err.response.data && err.response.data.message) {
          setError(err.response.data.message);
        } else {
          setError('Network error. Please check your connection.');
        }
      } finally {
        setVerifying(false);
      }
    };

    verifyToken();
  }, [token]);

  const validatePassword = (password) => {
    const errors = [];
    if (password.length < 8) {
      errors.push('At least 8 characters long');
    }
    if (!/\d/.test(password)) {
      errors.push('At least one number');
    }
    if (!/[!@#$%^&*(),.?":{}|<>\[\]\-_+=~`/\\]/.test(password)) {
      errors.push('At least one special character');
    }
    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    //PASSWORD VALIDATION
    const passwordErrors = validatePassword(newPassword);
    if (passwordErrors.length > 0) {
      setError(`Password must be: ${passwordErrors.join(', ')}`);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const response = await api.post('/api/password-reset/reset', {
        token,
        newPassword,
      });

      const data = response.data;

      if (data.success) {
        setSuccess(true);
        // Redirect to login after 3 seconds
        setTimeout(() => {
          navigate('/');
        }, 3000);
      } else {
        setError(data.message);
      }
    } catch (err) {
      console.error('Password reset error:', err);
      if (err.response && err.response.data && err.response.data.message) {
        setError(err.response.data.message);
      } else {
        setError('Network error. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = () => {
    navigate('/');
  };

  // LOADING STATE
  if (verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Verifying reset link...</p>
        </div>
      </div>
    );
  }

  // SUCESS DIALOG
  if (success) {
    return (

      <div className="min-h-screen  flex items-center justify-center p-4">
        <div className="w-full max-w-md">

          <div className="bg-white rounded-2xl shadow-xl p-8 text-center border-2">


            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <FiCheck className="text-green-600 text-2xl" />
            </div>

            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Password Reset Successful!
            </h2>

            <p className="text-gray-600 mb-6">
              Your password has been updated successfully. You can now login with your new password.
            </p>

            <p className="text-sm text-gray-500 mb-6">
              Redirecting to login in a few seconds...
            </p>

            <button
              onClick={handleBackToLogin}
              className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors"
            >
              Go to Login Now
            </button>
          </div>
        </div>
      </div>
    );
  }

  //INVALID TOKEN
  if (!tokenValid) {
    return (

      <div className="min-h-screen flex  items-center justify-center p-4">

        <div className="w-full max-w-md">

          <div className="bg-white rounded-2xl shadow-xl p-8 text-center border-2">


            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <FiX className="text-red-600 text-2xl" />
            </div>


            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Invalid Reset Link
            </h2>


            <p className="text-gray-600 mb-6">
              {error || 'This password reset link is invalid or has expired.'}
            </p>


            <button
              onClick={handleBackToLogin}
              className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors"
            >
              Back to Login

            </button>

          </div>

        </div>

      </div>

    );
  }

  // RESET PASSWORD FORM
  return (

    <div className="min-h-screen flex items-center justify-center p-4">


      <div className="w-full max-w-md ">

        <div className="bg-white rounded-2xl shadow-xl p-8 relative border-2">

          {/*HEADER*/}
          <div className="text-center mb-8">


            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FiLock className="text-green-600 text-2xl" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Reset Password
            </h2>
            <p className="text-gray-600">
              Enter your new password for: 
              <span className="font-medium block mt-1">{tokenData?.email}</span>
            </p>
          </div>

          {/*FORM */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/*NEW PASWORD*/}
            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-2">
                New Password
              </label>


              <div className="relative">

                <input
                  id="newPassword"
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => { setNewPassword(e.target.value); if (error) setError(''); }}
                  placeholder="Enter your new password"
                  required
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  disabled={loading}
                />


                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >

                  {showPassword ? (
                    <FiEyeOff className="text-gray-400 hover:text-gray-600" />

                  ) : (

                    <FiEye className="text-gray-400 hover:text-gray-600" />

                  )}
                </button>

              </div>

            </div>

            {/*CONFIRM PASSWORD*/}
            <div>

              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                Confirm New Password

              </label>

              <div className="relative">

                <input

                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); if (error) setError(''); }}
                  placeholder="Confirm your new password"
                  required
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  disabled={loading}

                />


                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  {showConfirmPassword ? (

                    <FiEyeOff className="text-gray-400 hover:text-gray-600" />
                  ) : (

                    <FiEye className="text-gray-400 hover:text-gray-600" />
                  )}
                </button>

              </div>

            </div>

            {/* Password requirements are now shown in the floating error popup when validation fails */}

            {/* ERROR MESSAGE (floating popup) */}
            {error && (
              <div className="bg-red-500 rounded-md p-3 absolute top-4 inset-x-4 z-50 shadow-md pointer-events-none">
                <p className="text-white text-sm flex items-center">
                  <FiAlertCircle className="mr-2 flex-shrink-0 text-white" />
                  {error}
                </p>
              </div>
            )}

            {/*SUBMIT NEW PASSWORD */}
            <button
              type="submit"
              disabled={loading || !newPassword || !confirmPassword}
              className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Resetting Password...
                </div>
              ) : (
                'Reset Password'
              )}
            </button>
          </form>

          {/*LOGIN PAGE*/}
          <div className="mt-6 text-center">
            <button
              onClick={handleBackToLogin}
              className="text-green-600 hover:text-green-700 text-sm font-medium"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
