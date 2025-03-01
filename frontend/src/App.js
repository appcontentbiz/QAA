import React, { useState } from "react";
import "./App.css";

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function App() {
  const [token, setToken] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  const register = async () => {
    try {
      const response = await fetch(`${API_URL}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();
      
      if (response.ok) {
        setMessage("Registration successful! Please login.");
        setIsRegistering(false);
      } else {
        setMessage(data.error || "Registration failed");
      }
    } catch (error) {
      console.error("Registration error:", error);
      setMessage("Error connecting to server. Please try again later.");
    }
  };

  const login = async () => {
    try {
      const response = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();
      
      if (response.ok) {
        setToken(data.token);
        setIsLoggedIn(true);
        setMessage(`Welcome back, ${data.username}!`);
      } else {
        setMessage(data.error || "Login failed");
      }
    } catch (error) {
      console.error("Login error:", error);
      setMessage("Error connecting to server. Please make sure the backend server is running.");
    }
  };

  const resetForm = () => {
    setUsername("");
    setPassword("");
    setMessage("");
  };

  const toggleMode = () => {
    setIsRegistering(!isRegistering);
    resetForm();
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Quick App Agent</h1>
        <div className="login-container">
          {!isLoggedIn ? (
            <>
              <h2>{isRegistering ? "Register" : "Login"}</h2>
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input-field"
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
              />
              <button 
                onClick={isRegistering ? register : login}
                className="login-button"
                disabled={!username || !password}
              >
                {isRegistering ? "Register" : "Login"}
              </button>
              <button 
                onClick={toggleMode}
                className="toggle-button"
              >
                {isRegistering ? "Already have an account? Login" : "Need an account? Register"}
              </button>
            </>
          ) : (
            <div>
              <h2>Welcome to QAA!</h2>
              <button 
                onClick={() => {
                  setToken("");
                  setIsLoggedIn(false);
                  resetForm();
                }} 
                className="login-button"
              >
                Logout
              </button>
            </div>
          )}
          <p className={`message ${message.includes('Error') || message.includes('failed') ? 'error' : message.includes('successful') ? 'success' : ''}`}>
            {message}
          </p>
        </div>
      </header>
    </div>
  );
}

export default App;
