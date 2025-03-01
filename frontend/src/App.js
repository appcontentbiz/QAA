import React, { useState } from "react";
import "./App.css";

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function App() {
  const [token, setToken] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const login = async () => {
    try {
      const response = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();
      if (data.token) {
        setToken(data.token);
        setIsLoggedIn(true);
        setMessage("Login successful!");
      } else {
        setMessage("Login failed: " + (data.error || "Invalid credentials"));
      }
    } catch (error) {
      console.error("Login error:", error);
      setMessage("Error connecting to server. Please make sure the backend server is running.");
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Quick App Agent</h1>
        <div className="login-container">
          {!isLoggedIn ? (
            <>
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
                onClick={login} 
                className="login-button"
                disabled={!username || !password}
              >
                Login
              </button>
            </>
          ) : (
            <div>
              <h2>Welcome to QAA!</h2>
              <button 
                onClick={() => {
                  setToken("");
                  setIsLoggedIn(false);
                  setMessage("");
                  setUsername("");
                  setPassword("");
                }} 
                className="login-button"
              >
                Logout
              </button>
            </div>
          )}
          <p className={`message ${message.includes('Error') ? 'error' : ''}`}>
            {message}
          </p>
        </div>
      </header>
    </div>
  );
}

export default App;
