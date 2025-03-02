const express = require('express');
const serverless = require('serverless-http');
const cors = require('cors');
const mongoose = require('mongoose');
const passport = require('passport');

// Create express app
const app = express();

// Basic middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());

// Initialize passport
require('../src/config/passport')(passport);

// Health check endpoint
app.get('/.netlify/functions/api', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
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

// MongoDB connection with retry
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
    });
    console.log('MongoDB Connected');
  } catch (err) {
    console.error('MongoDB connection error:', err);
    throw err;
  }
};

// Handler
const handler = serverless(app);

exports.handler = async (event, context) => {
  // Make sure we don't wait for empty event loop
  context.callbackWaitsForEmptyEventLoop = false;

  // Connect to MongoDB if not connected
  if (mongoose.connection.readyState !== 1) {
    try {
      await connectDB();
    } catch (err) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: 'Database connection failed',
          message: 'Unable to connect to database'
        })
      };
    }
  }

  try {
    const result = await handler(event, context);
    return {
      ...result,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        ...result.headers
      }
    };
  } catch (err) {
    console.error('Handler error:', err);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
      },
      body: JSON.stringify({
        error: 'Server error',
        message: err.message
      })
    };
  }
};
