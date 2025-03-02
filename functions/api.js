const serverless = require('serverless-http');
const app = require('../src/app');

// Wrap express app with serverless
const handler = serverless(app);

module.exports = {
  handler: async (event, context) => {
    // Add CORS headers
    const response = await handler(event, context);
    response.headers = {
      ...response.headers,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
    };
    return response;
  }
};
