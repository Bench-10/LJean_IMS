import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaUser, FaLock } from 'react-icons/fa';
import Authentication from './Authentication';
import './login.css';
import { useAuth } from './Authentication'; 


function Login() {
  const navigate = useNavigate();
  const { loginAuthentication } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});



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
    //METHOD FROM AUTHENTICATION COMPONENT
    if (validateForm()){
      const userRole = await loginAuthentication(username, password);

      if (userRole){
        if (userRole === 'Inventory Staff'){
          navigate('/notification', { replace: true })
        }

        if (userRole === 'Owner'){
          navigate('/notification')
        }
        
      } else if(!userRole){
        console.log('wgrong')
      }
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
