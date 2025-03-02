const jwt = require('jsonwebtoken');
const User = require('../models/user');
const Project = require('../models/project');
const Component = require('../models/component');
const { redisClient } = require('../config/redis');

class WebSocketHandler {
  constructor(io) {
    this.io = io;
    this.setupMiddleware();
    this.setupEventHandlers();
  }

  setupMiddleware() {
    // Authentication middleware
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        if (!token) {
          return next(new Error('Authentication token required'));
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Check if token is blacklisted
        const isBlacklisted = await redisClient.get(`bl_${token}`);
        if (isBlacklisted) {
          return next(new Error('Token has been invalidated'));
        }

        // Get user
        const user = await User.findById(decoded.id).select('-password');
        if (!user || !user.isActive) {
          return next(new Error('User not found or inactive'));
        }

        // Attach user to socket
        socket.user = user;
        next();
      } catch (error) {
        next(new Error('Authentication failed'));
      }
    });
  }

  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`User connected: ${socket.user.id}`);

      // Handle room joining
      socket.on('join_project', async (projectId) => {
        try {
          const project = await Project.findById(projectId);
          if (!project || !project.hasAccess(socket.user.id)) {
            socket.emit('error', { message: 'Access denied to project' });
            return;
          }

          // Leave previous project rooms
          const rooms = Array.from(socket.rooms);
          rooms.forEach(room => {
            if (room.startsWith('project_')) {
              socket.leave(room);
            }
          });

          // Join project room
          socket.join(`project_${projectId}`);
          
          // Update user's online status in project
          this.io.to(`project_${projectId}`).emit('user_online', {
            userId: socket.user.id,
            name: socket.user.name
          });

          // Track user's presence
          await redisClient.hset(
            `presence_${projectId}`,
            socket.user.id,
            JSON.stringify({
              userId: socket.user.id,
              name: socket.user.name,
              lastSeen: Date.now()
            })
          );
        } catch (error) {
          console.error('Join project error:', error);
          socket.emit('error', { message: 'Failed to join project' });
        }
      });

      // Handle component editing
      socket.on('start_editing_component', async ({ projectId, componentId }) => {
        try {
          const component = await Component.findOne({
            _id: componentId,
            project: projectId
          });

          if (!component) {
            socket.emit('error', { message: 'Component not found' });
            return;
          }

          const lockKey = `lock_${componentId}`;
          const currentLock = await redisClient.get(lockKey);

          if (currentLock && currentLock !== socket.user.id) {
            socket.emit('component_locked', {
              componentId,
              userId: currentLock
            });
            return;
          }

          // Set component lock
          await redisClient.set(lockKey, socket.user.id, 'EX', 30);

          // Notify others
          socket.to(`project_${projectId}`).emit('component_editing', {
            componentId,
            user: {
              id: socket.user.id,
              name: socket.user.name
            }
          });
        } catch (error) {
          console.error('Start editing error:', error);
          socket.emit('error', { message: 'Failed to start editing' });
        }
      });

      // Handle component changes
      socket.on('component_change', async ({ projectId, componentId, changes }) => {
        try {
          const lockKey = `lock_${componentId}`;
          const currentLock = await redisClient.get(lockKey);

          if (currentLock !== socket.user.id) {
            socket.emit('error', { message: 'You do not have the lock on this component' });
            return;
          }

          // Extend lock
          await redisClient.expire(lockKey, 30);

          // Broadcast changes
          socket.to(`project_${projectId}`).emit('component_updated', {
            componentId,
            changes,
            user: {
              id: socket.user.id,
              name: socket.user.name
            }
          });

          // Store changes in Redis for conflict resolution
          const changeKey = `changes_${componentId}`;
          await redisClient.rpush(changeKey, JSON.stringify({
            userId: socket.user.id,
            timestamp: Date.now(),
            changes
          }));
          await redisClient.expire(changeKey, 86400); // Keep for 24 hours
        } catch (error) {
          console.error('Component change error:', error);
          socket.emit('error', { message: 'Failed to save changes' });
        }
      });

      // Handle stop editing
      socket.on('stop_editing_component', async ({ projectId, componentId }) => {
        try {
          const lockKey = `lock_${componentId}`;
          const currentLock = await redisClient.get(lockKey);

          if (currentLock === socket.user.id) {
            await redisClient.del(lockKey);
          }

          socket.to(`project_${projectId}`).emit('component_unlocked', {
            componentId,
            user: {
              id: socket.user.id,
              name: socket.user.name
            }
          });
        } catch (error) {
          console.error('Stop editing error:', error);
          socket.emit('error', { message: 'Failed to release lock' });
        }
      });

      // Handle cursor position updates
      socket.on('cursor_move', ({ projectId, componentId, position }) => {
        socket.to(`project_${projectId}`).emit('cursor_moved', {
          componentId,
          position,
          user: {
            id: socket.user.id,
            name: socket.user.name
          }
        });
      });

      // Handle chat messages
      socket.on('send_message', async ({ projectId, message }) => {
        try {
          const project = await Project.findById(projectId);
          if (!project || !project.hasAccess(socket.user.id)) {
            socket.emit('error', { message: 'Access denied to project' });
            return;
          }

          const chatMessage = {
            userId: socket.user.id,
            userName: socket.user.name,
            message,
            timestamp: Date.now()
          };

          // Store message in Redis
          await redisClient.rpush(
            `chat_${projectId}`,
            JSON.stringify(chatMessage)
          );
          await redisClient.expire(`chat_${projectId}`, 604800); // Keep for 7 days

          // Broadcast message
          this.io.to(`project_${projectId}`).emit('new_message', chatMessage);
        } catch (error) {
          console.error('Send message error:', error);
          socket.emit('error', { message: 'Failed to send message' });
        }
      });

      // Handle disconnection
      socket.on('disconnect', async () => {
        try {
          const rooms = Array.from(socket.rooms);
          for (const room of rooms) {
            if (room.startsWith('project_')) {
              const projectId = room.split('_')[1];
              
              // Remove user's presence
              await redisClient.hdel(`presence_${projectId}`, socket.user.id);
              
              // Release any component locks
              const pattern = `lock_*`;
              const keys = await redisClient.keys(pattern);
              for (const key of keys) {
                const lockHolder = await redisClient.get(key);
                if (lockHolder === socket.user.id) {
                  await redisClient.del(key);
                  const componentId = key.split('_')[1];
                  this.io.to(`project_${projectId}`).emit('component_unlocked', {
                    componentId,
                    user: {
                      id: socket.user.id,
                      name: socket.user.name
                    }
                  });
                }
              }

              // Notify others
              this.io.to(`project_${projectId}`).emit('user_offline', {
                userId: socket.user.id,
                name: socket.user.name
              });
            }
          }
        } catch (error) {
          console.error('Disconnect cleanup error:', error);
        }
      });
    });
  }

  // Helper method to broadcast project updates
  broadcastProjectUpdate(projectId, updateType, data) {
    this.io.to(`project_${projectId}`).emit('project_update', {
      type: updateType,
      data
    });
  }

  // Helper method to broadcast component updates
  broadcastComponentUpdate(projectId, componentId, updateType, data) {
    this.io.to(`project_${projectId}`).emit('component_update', {
      componentId,
      type: updateType,
      data
    });
  }
}

module.exports = WebSocketHandler;
