import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AccountDisabledPopUp from '../components/dialogs/AccountDisabledPopUp';
import { FaUser, FaLock, FaEye, FaExclamationCircle } from 'react-icons/fa';
import './login.css';
import { useAuth } from './Authentication'; 
import TooMuchAttempts from '../components/dialogs/TooMuchAttempts';
import axios from 'axios';


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
  const [usernameWithInvalidPass, setUsernameWithInvalidPass] = useState('');

  //FOR NOTIFYING THAT ACCOUNT IS DISABLED
  const [disabledDialog, setDisabledDialog] = useState(false);
  const [showTooManyAttempts, setShowTooManyAttempts] = useState(false);

  const trials = useRef(0);

  //PREVENTS THE USER FROM GOING BACK TO THE LOGIN PAGE AFTER A SUCCESSFUL LOGIN
  useEffect(() => {
    if (user && user.role) {
      if (user.role.some(role => ['Inventory Staff', 'Owner', 'Branch Manager'].includes(role))) {
        navigate('/inventory', { replace: true });
      } else {
        navigate('/sales', { replace: true });
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

    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!(regex.test(username.trim())))
      newErrors.username = 'Please enter correct Email format.';

    if (!username.trim()) 
      newErrors.username = 'Please enter your Email.';

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
      } else if (errorMessage === 'Account Disabled') {

        setDisabledDialog(true);

      }else if (errorMessage === 'Invalid password') {
        setAuthErrors({ password: 'Password is incorrect.' });
        setIsShaking({ password: true });
        setTimeout(() => setIsShaking({}), 500);

        if (usernameWithInvalidPass.length === 0 || username !== usernameWithInvalidPass){
          trials.current = 1;
          setUsernameWithInvalidPass(username);
          return;
        }

        if (usernameWithInvalidPass === username){
          if(trials.current > 10){
            
            await axios.put(`http://localhost:3000/api/disable_on_attempt/${username}`, {isDisabled: true})
            setShowTooManyAttempts(true);
            return;
          } 

          trials.current += 1;

          return;
        }

      }  else {
        // Generic error - show on both fields
        setAuthErrors({
          username: 'Authentication failed.',
          password: 'Please check your credentials.'
        });
        setIsShaking({ username: true, password: true });
        setTimeout(() => setIsShaking({}), 500);
      }

      trials.current = 0;
      setUsernameWithInvalidPass('');
    }
  };


  return (
    <div className="login-container">

      <AccountDisabledPopUp
        open={disabledDialog}
        onClose={() => setDisabledDialog(false)}
      />
      <TooMuchAttempts 
        open={showTooManyAttempts} 
        onClose={() => setShowTooManyAttempts(false)} 
      />

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
