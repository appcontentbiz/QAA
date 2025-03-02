const express = require('express');
const serverless = require('serverless-http');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();

// Enable CORS
app.use(cors({
  origin: '*',
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  preflightContinue: false,
  optionsSuccessStatus: 204,
  allowedHeaders: ['Content-Type', 'Authorization', 'x-access-token']
}));

// Basic middleware
app.use(express.json());

// Mock database (replace with MongoDB later)
const users_db = { "admin": "password123" };
const projects_db = [];

// JWT middleware
const verifyToken = (req, res, next) => {
  const token = req.headers['x-access-token'];
  
  if (!token) {
    return res.status(401).json({ error: "Token is missing!" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.user = decoded.user;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Token is invalid!" });
  }
};

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok',
    message: "Welcome to the Web & Mobile App Builder API",
    timestamp: new Date().toISOString()
  });
});

// Login endpoint
app.post('/auth/login', (req, res) => {
  const { username, password } = req.body;
  
  if (users_db[username] === password) {
    const token = jwt.sign(
      { user: username },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '1h' }
    );
    res.json({ token });
  } else {
    res.status(401).json({ error: "Invalid credentials" });
  }
});

// Generate code endpoint
app.post('/generate-code', verifyToken, async (req, res) => {
  try {
    const { prompt } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    // Mock response for now (replace with actual OpenAI call)
    const mockCode = `// Generated code for: ${prompt}
function example() {
  console.log("Hello from generated code!");
}`;

    res.json({ generated_code: mockCode });
  } catch (error) {
    console.error('Code generation error:', error);
    res.status(500).json({ error: "Failed to generate code" });
  }
});

// Create project endpoint
app.post('/projects', verifyToken, (req, res) => {
  const { project_name, project_type } = req.body;
  
  if (!project_name || !project_type) {
    return res.status(400).json({ error: "Project name and type are required" });
  }
  
  const project = {
    id: projects_db.length + 1,
    name: project_name,
    type: project_type,
    status: "created",
    created_by: req.user
  };
  
  projects_db.push(project);
  res.json({ message: "Project created successfully", project });
});

// List projects endpoint
app.get('/projects', verifyToken, (req, res) => {
  const userProjects = projects_db.filter(proj => proj.created_by === req.user);
  res.json({ projects: userProjects });
});

// Delete project endpoint
app.delete('/projects/:id', verifyToken, (req, res) => {
  const projectId = parseInt(req.params.id);
  
  const index = projects_db.findIndex(
    proj => proj.id === projectId && proj.created_by === req.user
  );
  
  if (index === -1) {
    return res.status(404).json({ error: "Project not found" });
  }
  
  projects_db.splice(index, 1);
  res.json({ message: "Project deleted successfully", project_id: projectId });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: {
      message: err.message || 'Internal Server Error',
      status: 500
    }
  });
});

// Create handler
const handler = serverless(app);

exports.handler = async (event, context) => {
  // Make sure we don't wait for empty event loop
  context.callbackWaitsForEmptyEventLoop = false;

  // Log request details
  console.log('Request:', {
    path: event.path,
    method: event.httpMethod,
    headers: event.headers
  });

  // Handle OPTIONS requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,HEAD,PUT,PATCH,POST,DELETE',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization,x-access-token',
        'Access-Control-Max-Age': '86400'
      }
    };
  }

  try {
    // Handle the request
    const result = await handler(event, context);
    
    // Log response
    console.log('Response:', {
      statusCode: result.statusCode,
      body: result.body
    });

    return {
      ...result,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,HEAD,PUT,PATCH,POST,DELETE',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization,x-access-token',
        'Content-Type': 'application/json',
        ...result.headers
      }
    };
  } catch (err) {
    console.error('Handler error:', err);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,HEAD,PUT,PATCH,POST,DELETE',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization,x-access-token',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        error: 'Server error',
        message: err.message
      })
    };
  }
};
