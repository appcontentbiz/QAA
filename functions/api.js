const serverless = require('serverless-http');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const passport = require('passport');

// Create express app
const app = express();

// Configure mongoose for serverless environment
mongoose.set('bufferCommands', false);

// CORS configuration
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());

// Health check endpoint
app.get('/.netlify/functions/api', (req, res) => {
  res.json({ status: 'API is running', timestamp: new Date().toISOString() });
});

// Import routes
app.use('/.netlify/functions/api/auth', require('../src/routes/auth'));
app.use('/.netlify/functions/api/projects', require('../src/routes/projects'));
app.use('/.netlify/functions/api/components', require('../src/routes/components'));
app.use('/.netlify/functions/api/assets', require('../src/routes/assets'));

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal Server Error',
      status: err.status || 500
    }
  });
});

// Create handler
const handler = serverless(app);

// Wrap handler to manage database connections
exports.handler = async (event, context) => {
  // Make context callbackWaitsForEmptyEventLoop = false to prevent timeout
  context.callbackWaitsForEmptyEventLoop = false;

  // Log incoming request
  console.log('Request:', {
    path: event.path,
    httpMethod: event.httpMethod,
    headers: event.headers
  });

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Max-Age': '86400'
      }
    };
  }

  try {
    // Check MongoDB connection
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });
      console.log('MongoDB connected');
    }

    // Handle the request
    const response = await handler(event, context);

    // Log response
    console.log('Response:', {
      statusCode: response.statusCode,
      headers: response.headers
    });

    return {
      ...response,
      headers: {
        ...response.headers,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
      }
    };
  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
      },
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
};
