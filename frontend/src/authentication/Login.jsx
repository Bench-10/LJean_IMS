import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaUser, FaLock, FaEye, FaExclamationCircle, FaSpinner } from "react-icons/fa";

import AccountDisabledPopUp from "../components/dialogs/AccountDisabledPopUp";
import TooMuchAttempts from "../components/dialogs/TooMuchAttempts";
import ForgotPassword from "./ForgotPassword";

import { useAuth } from "./Authentication";
import api from "../utils/api";
import "./login.css";

function Login() {
  const navigate = useNavigate();
  const { loginAuthentication, user } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [errors, setErrors] = useState({});
  const [authErrors, setAuthErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [isShaking, setIsShaking] = useState({});
  const [validFields, setValidFields] = useState({});
  const [usernameWithInvalidPass, setUsernameWithInvalidPass] = useState("");

  const [disabledDialog, setDisabledDialog] = useState(false);
  const [showTooManyAttempts, setShowTooManyAttempts] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const trials = useRef(0);

  useEffect(() => {
    if (!user) return;
    if (user.role?.some((r) => ["Owner", "Branch Manager"].includes(r))) {
      navigate("/dashboard", { replace: true });
    } else if (user.role?.some((r) => ["Inventory Staff"].includes(r))) {
      navigate("/inventory", { replace: true });
    } else {
      navigate("/sales", { replace: true });
    }
  }, [user, navigate]);

  const handleUsernameChange = (e) => {
    const value = e.target.value;
    setUsername(value);
    if (errors.username || authErrors.username) {
      setErrors((p) => ({ ...p, username: "" }));
      setAuthErrors((p) => ({ ...p, username: "" }));
    }
    setValidFields((p) => ({ ...p, username: !!value.trim() }));
  };

  const handlePasswordChange = (e) => {
    const value = e.target.value;
    setPassword(value);
    if (errors.password || authErrors.password) {
      setErrors((p) => ({ ...p, password: "" }));
      setAuthErrors((p) => ({ ...p, password: "" }));
    }
    setValidFields((p) => ({ ...p, password: !!value }));
  };

  const validateForm = () => {
    const newErrors = {};
    const rx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!username.trim()) newErrors.username = "Please enter your Email.";
    else if (!rx.test(username.trim())) newErrors.username = "Please enter correct Email format.";
    if (!password) newErrors.password = "Please enter your password.";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setAuthErrors({});
    setIsShaking({});
    if (!validateForm()) return;

    try {
      setIsLoggingIn(true);
      await loginAuthentication(username, password);
    } catch (error) {
      const msg = String(error?.message || "");
      if (msg === "Invalid username") {
        setAuthErrors({ username: "Please enter a valid username." });
        setIsShaking({ username: true });
        setTimeout(() => setIsShaking({}), 500);
      } else if (msg === "Account Disabled") {
        setDisabledDialog(true);
      } else if (msg === "Invalid password") {
        setAuthErrors({ password: "Password is incorrect." });
        setIsShaking({ password: true });
        setTimeout(() => setIsShaking({}), 500);

        if (!usernameWithInvalidPass || username !== usernameWithInvalidPass) {
          trials.current = 1;
          setUsernameWithInvalidPass(username);
          return;
        }
        if (usernameWithInvalidPass === username) {
          if (trials.current > 10) {
            await api.put(`/api/disable_on_attempt/${username}`, { isDisabled: true });
            setShowTooManyAttempts(true);
            return;
          }
          trials.current += 1;
          return;
        }
      } else {
        setAuthErrors({
          username: "Authentication failed.",
          password: "Please check your credentials.",
        });
        setIsShaking({ username: true, password: true });
        setTimeout(() => setIsShaking({}), 500);
      }
      trials.current = 0;
      setUsernameWithInvalidPass("");
    } finally {
      setIsLoggingIn(false);
    }
  };

  if (showForgotPassword) {
    return <ForgotPassword onBackToLogin={() => setShowForgotPassword(false)} />;
  }

  return (
    <div className="login-container" role="main">
      <AccountDisabledPopUp open={disabledDialog} onClose={() => setDisabledDialog(false)} />
      <TooMuchAttempts open={showTooManyAttempts} onClose={() => setShowTooManyAttempts(false)} />

      {/* Left photo (auto-hides via CSS on narrow/short/touch screens) */}
      <div className="login-left" aria-hidden="true" />

      {/* Right column: its own scroll container */}
      <div className="login-right">
        {/* Inner wrapper = centered on tall screens; top-aligned on short screens via CSS */}
        <div className="login-right-inner">
          <div className="company-name-box">
            <h1>L-JEAN TRADING</h1>
            <p className="slogan">Construction and Supply</p>
          </div>

          <form className="login-form" onSubmit={handleSubmit} noValidate>
            <label htmlFor="userid">Email</label>
            <div className={`input-icon ${isShaking.username ? "shake" : ""}`}>
              <FaUser className="icon" />
              <input
                type="email"
                id="userid"
                placeholder="Enter your username"
                value={username}
                onChange={handleUsernameChange}
                autoComplete="username"
                inputMode="email"
                className={`${
                  errors.username || authErrors.username
                    ? "input-error"
                    : validFields.username
                    ? "input-valid"
                    : ""
                }`}
              />
            </div>
            {(errors.username || authErrors.username) && (
              <p className="error-message" aria-live="polite">
                <FaExclamationCircle className="error-icon" />
                {errors.username || authErrors.username}
              </p>
            )}

            <label htmlFor="password">Password</label>
            <div className={`input-icon ${isShaking.password ? "shake" : ""}`}>
              <FaLock className="icon" />
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                placeholder="Enter your password"
                value={password}
                onChange={handlePasswordChange}
                autoComplete="current-password"
                className={`${
                  errors.password || authErrors.password
                    ? "input-error"
                    : validFields.password
                    ? "input-valid"
                    : ""
                }`}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                <FaEye />
              </button>
            </div>
            {(errors.password || authErrors.password) && (
              <p className="error-message" aria-live="polite">
                <FaExclamationCircle className="error-icon" />
                {errors.password || authErrors.password}
              </p>
            )}

            <button
              type="submit"
              className="login-btn flex items-center justify-center gap-2"
              disabled={isLoggingIn}
              aria-busy={isLoggingIn}
            >
              {isLoggingIn ? (
                <>
                  <FaSpinner className="animate-spin" />
                  <span>Logging in…</span>
                </>
              ) : (
                "LOGIN"
              )}
            </button>

            <div className="forgot-password-container">
              <button
                type="button"
                onClick={() => setShowForgotPassword(true)}
                className="forgot-password-link"
              >
                Forgot your password?
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default Login;
