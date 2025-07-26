import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaUser, FaLock } from 'react-icons/fa';
import './login.css';
import { useAuth } from './Authentication'; 


function Login() {
  const navigate = useNavigate();
  const { loginAuthentication, user } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});


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




  const validateForm = () => {
    const newErrors = {};

    if (!username.trim()) 
      newErrors.username = 'Please enter your Username.';

    if (!password) 
      newErrors.password = 'Please enter your password.';


    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;

  };

  const handleSubmit = (e) => {
    e.preventDefault();

    //METHOD FROM AUTHENTICATION COMPONENT
    if (validateForm()){
      loginAuthentication(username, password);

    };
    
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
          <label htmlFor="userid">UserID</label>
          <div className="input-icon">
            <FaUser className="icon" />
            <input
              type="email"
              id="userid"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={errors.username ? 'input-error' : ''}
             
            />
          </div>
          {errors.username && <p className="error-message">{errors.username}</p>}
          

          <label htmlFor="password">Password</label>
          <div className="input-icon">
            <FaLock className="icon" />
            <input
              type="password"
              id="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={errors.password ? 'input-error' : ''}
             
            />
          </div>
          {errors.password && <p className="error-message">{errors.password}</p>}
          
        
          <button type='submit' className="login-btn">LOGIN</button>

        </form>
      </div>
    </div>
  )
}

export default Login
