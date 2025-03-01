import React, { useState } from "react";
import "./App.css";

function App() {
  const [token, setToken] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const login = async () => {
    try {
      const response = await fetch("http://localhost:5000/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();
      if (data.token) {
        setToken(data.token);
        setMessage("Login successful!");
      } else {
        setMessage("Login failed!");
      }
    } catch (error) {
      setMessage("Error connecting to server");
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Quick App Agent</h1>
        <div className="login-container">
          <input
            type="text"
            placeholder="Username"
            onChange={(e) => setUsername(e.target.value)}
            className="input-field"
          />
          <input
            type="password"
            placeholder="Password"
            onChange={(e) => setPassword(e.target.value)}
            className="input-field"
          />
          <button onClick={login} className="login-button">
            Login
          </button>
          <p className="message">{message}</p>
        </div>
      </header>
    </div>
  );
}

export default App;
