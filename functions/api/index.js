const express = require('express');
const serverless = require('serverless-http');
const mongoose = require('mongoose');
const cors = require('cors');
const passport = require('passport');
const { Server } = require('socket.io');

// Import routes
const authRoutes = require('../../src/routes/auth');
const projectRoutes = require('../../src/routes/projects');
const componentRoutes = require('../../src/routes/components');
const assetRoutes = require('../../src/routes/assets');

// Create express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Routes
app.use('/auth', authRoutes);
app.use('/projects', projectRoutes);
app.use('/components', componentRoutes);
app.use('/assets', assetRoutes);

// WebSocket setup for Netlify
if (process.env.NETLIFY) {
  const io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL,
      methods: ["GET", "POST"],
      credentials: true
    }
  });

  // WebSocket handlers
  io.on('connection', (socket) => {
    console.log('Client connected');
    
    socket.on('disconnect', () => {
      console.log('Client disconnected');
    });
  });
}

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Export handler for serverless
exports.handler = serverless(app);
