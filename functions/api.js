const serverless = require('serverless-http');
const mongoose = require('mongoose');
const app = require('../src/app');

// Configure mongoose for serverless environment
mongoose.set('bufferCommands', false);

const handler = serverless(app, {
  basePath: '/.netlify/functions/api',
  request: {
    // Configure request timeouts
    timeout: 29000, // Netlify's limit is 30s
  },
  response: {
    // Add default headers
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    },
  },
});

// Wrap handler to manage database connections
module.exports = {
  handler: async (event, context) => {
    // Make context callbackWaitsForEmptyEventLoop = false to prevent timeout
    context.callbackWaitsForEmptyEventLoop = false;

    // Handle preflight requests
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        },
      };
    }

    try {
      // Check MongoDB connection
      if (mongoose.connection.readyState !== 1) {
        await mongoose.connect(process.env.MONGODB_URI, {
          useNewUrlParser: true,
          useUnifiedTopology: true,
          serverSelectionTimeoutMS: 5000,
        });
      }

      // Handle the request
      const response = await handler(event, context);
      return response;
    } catch (error) {
      console.error('Function error:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: 'Internal Server Error',
          message: error.message
        })
      };
    }
  }
};
