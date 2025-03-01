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
  const [codePrompt, setCodePrompt] = useState("");
  const [generatedCode, setGeneratedCode] = useState("");
  const [activeTab, setActiveTab] = useState("generate"); // generate, projects, settings

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

  const generateCode = async () => {
    try {
      const response = await fetch(`${API_URL}/generate-code`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-access-token": token
        },
        body: JSON.stringify({ prompt: codePrompt }),
      });
      const data = await response.json();
      
      if (response.ok) {
        setGeneratedCode(data.generated_code);
        setMessage("Code generated successfully!");
      } else {
        setMessage(data.error || "Failed to generate code");
      }
    } catch (error) {
      console.error("Code generation error:", error);
      setMessage("Error connecting to server.");
    }
  };

  const resetForm = () => {
    setUsername("");
    setPassword("");
    setMessage("");
  };

  const logout = () => {
    setToken("");
    setIsLoggedIn(false);
    resetForm();
    setCodePrompt("");
    setGeneratedCode("");
    setActiveTab("generate");
  };

  const toggleMode = () => {
    setIsRegistering(!isRegistering);
    resetForm();
  };

  const renderDashboard = () => (
    <div className="dashboard">
      <div className="dashboard-header">
        <div className="tabs">
          <button 
            className={`tab-button ${activeTab === 'generate' ? 'active' : ''}`}
            onClick={() => setActiveTab('generate')}
          >
            Generate Code
          </button>
          <button 
            className={`tab-button ${activeTab === 'projects' ? 'active' : ''}`}
            onClick={() => setActiveTab('projects')}
          >
            Projects
          </button>
          <button 
            className={`tab-button ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            Settings
          </button>
        </div>
        <button onClick={logout} className="logout-button">
          Logout
        </button>
      </div>

      <div className="dashboard-content">
        {activeTab === 'generate' && (
          <div className="code-generation">
            <h2>Generate Code</h2>
            <div className="code-input">
              <textarea
                value={codePrompt}
                onChange={(e) => setCodePrompt(e.target.value)}
                placeholder="Describe the code you want to generate..."
                className="prompt-input"
              />
              <button 
                onClick={generateCode}
                disabled={!codePrompt.trim()}
                className="generate-button"
              >
                Generate
              </button>
            </div>
            {generatedCode && (
              <div className="code-output">
                <h3>Generated Code:</h3>
                <pre className="code-block">
                  <code>{generatedCode}</code>
                </pre>
                <button 
                  onClick={() => navigator.clipboard.writeText(generatedCode)}
                  className="copy-button"
                >
                  Copy to Clipboard
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'projects' && (
          <div className="projects">
            <h2>My Projects</h2>
            <p>Project management features coming soon!</p>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="settings">
            <h2>Settings</h2>
            <p>Settings and preferences coming soon!</p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="App">
      <header className="App-header">
        <h1>Quick App Agent</h1>
        {!isLoggedIn ? (
          <div className="login-container">
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
            <p className={`message ${message.includes('Error') || message.includes('failed') ? 'error' : message.includes('successful') ? 'success' : ''}`}>
              {message}
            </p>
          </div>
        ) : (
          renderDashboard()
        )}
      </header>
    </div>
  );
}

export default App;
