import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaUser, FaLock, FaEye, FaExclamationCircle } from 'react-icons/fa';
import './login.css';
import { useAuth } from './Authentication'; 


function Login() {
  const navigate = useNavigate();
  const { loginAuthentication, user } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [authErrors, setAuthErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [isShaking, setIsShaking] = useState({});
  const [validFields, setValidFields] = useState({});


//PREVENTS THE USER FROM GOING BACK TO THE LOGIN PAGE AFTER A SUCCESSFUL LOGIN
  useEffect(() => {
    if (user && user.role) {
      if (user.role === 'Inventory Staff' || user.role === 'Branch Manager') {
        navigate('/notification', { replace: true });
      } else if (user.role === 'Owner') {
        navigate('/inventory', { replace: true });
      }
    }
  }, [user, navigate]);

  // Clear errors when user starts typing
  const handleUsernameChange = (e) => {
    const value = e.target.value;
    setUsername(value);
    
    // Clear errors when user starts typing
    if (errors.username || authErrors.username) {
      setErrors(prev => ({ ...prev, username: '' }));
      setAuthErrors(prev => ({ ...prev, username: '' }));
    }
    
    // Show valid state for non-empty input
    if (value.trim()) {
      setValidFields(prev => ({ ...prev, username: true }));
    } else {
      setValidFields(prev => ({ ...prev, username: false }));
    }
  };

  const handlePasswordChange = (e) => {
    const value = e.target.value;
    setPassword(value);
    
    // Clear errors when user starts typing
    if (errors.password || authErrors.password) {
      setErrors(prev => ({ ...prev, password: '' }));
      setAuthErrors(prev => ({ ...prev, password: '' }));
    }
    
    // Show valid state for non-empty input
    if (value) {
      setValidFields(prev => ({ ...prev, password: true }));
    } else {
      setValidFields(prev => ({ ...prev, password: false }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!username.trim()) 
      newErrors.username = 'Please enter your Username.';

    if (!password) 
      newErrors.password = 'Please enter your password.';


    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;

  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Clear previous authentication errors
    setAuthErrors({});
    setIsShaking({});
    
    // Validate form first
    if (!validateForm()) {
      return;
    }

    try {
      // METHOD FROM AUTHENTICATION COMPONENT
      await loginAuthentication(username, password);
    } catch (error) {
      const errorMessage = error.message;
      
      // Handle specific authentication errors
      if (errorMessage === 'Invalid username') {
        setAuthErrors({ username: 'Please enter a valid username.' });
        setIsShaking({ username: true });
        setTimeout(() => setIsShaking({}), 500);
      } else if (errorMessage === 'Invalid password') {
        setAuthErrors({ password: 'Password is incorrect.' });
        setIsShaking({ password: true });
        setTimeout(() => setIsShaking({}), 500);
      } else {
        // Generic error - show on both fields
        setAuthErrors({ 
          username: 'Authentication failed.',
          password: 'Please check your credentials.' 
        });
        setIsShaking({ username: true, password: true });
        setTimeout(() => setIsShaking({}), 500);
      }
    }
  };


  return (

    
    <div className="login-container">
      <div className="login-left"></div>
      <div className="login-right">
        <div className="company-name-box">
          <h1>L-JEAN TRADING</h1>
          <p className="slogan">Construction and Supply</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <label htmlFor="userid">Username</label>
          <div className={`input-icon ${isShaking.username ? 'shake' : ''}`}>
            <FaUser className="icon" />
            <input
              type="email"
              id="userid"
              placeholder="Enter your username"
              value={username}
              onChange={handleUsernameChange}
              className={`${
                errors.username || authErrors.username ? 'input-error' : 
                validFields.username ? 'input-valid' : ''
              }`}
            />
          </div>
          {(errors.username || authErrors.username) && (
            <p className="error-message">
              <FaExclamationCircle className="error-icon" />
              {errors.username || authErrors.username}
            </p>
          )}
          

          <label htmlFor="password">Password</label>
          <div className={`input-icon ${isShaking.password ? 'shake' : ''}`}>
            <FaLock className="icon" />
            <input
              type={showPassword ? "text" : "password"}
              id="password"
              placeholder="Enter your password"
              value={password}
              onChange={handlePasswordChange}
              className={`${
                errors.password || authErrors.password ? 'input-error' : 
                validFields.password ? 'input-valid' : ''
              }`}
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              <FaEye />
            </button>
          </div>
          {(errors.password || authErrors.password) && (
            <p className="error-message">
              <FaExclamationCircle className="error-icon" />
              {errors.password || authErrors.password}
            </p>
          )}
          
        
          <button type='submit' className="login-btn">LOGIN</button>

        </form>
      </div>
    </div>
  )
}

export default Login
