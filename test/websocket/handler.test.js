const WebSocketHandler = require('../../src/websocket/handler');
const Project = require('../../src/models/project');
const Component = require('../../src/models/component');
const { redisClient } = require('../../src/config/redis');

describe('WebSocket Handler', () => {
  let mockIo;
  let mockSocket;
  let handler;
  let testUser;
  let testProject;
  let testComponent;

  beforeEach(async () => {
    // Create test user and project
    testUser = await createTestUser();
    testProject = await createTestProject({
      owner: testUser._id,
      collaborators: [{
        user: testUser._id,
        role: 'editor'
      }]
    });
    testComponent = await createTestComponent({
      project: testProject._id,
      creator: testUser._id
    });

    // Mock Socket.IO instance
    mockSocket = {
      handshake: {
        auth: {
          token: 'valid-token'
        }
      },
      user: testUser,
      rooms: new Set(),
      join: jest.fn(),
      leave: jest.fn(),
      to: jest.fn().mockReturnThis(),
      emit: jest.fn()
    };

    mockIo = {
      use: jest.fn((middleware) => middleware(mockSocket, jest.fn())),
      on: jest.fn(),
      to: jest.fn().mockReturnThis(),
      emit: jest.fn()
    };

    handler = new WebSocketHandler(mockIo);
  });

  describe('Authentication Middleware', () => {
    it('should authenticate valid token', async () => {
      const token = generateTestToken(testUser._id);
      mockSocket.handshake.auth.token = token;

      await handler.setupMiddleware();

      expect(mockSocket.user).toBeDefined();
      expect(mockSocket.user._id).toEqual(testUser._id);
    });

    it('should reject invalid token', async () => {
      mockSocket.handshake.auth.token = 'invalid-token';
      const next = jest.fn();

      await handler.setupMiddleware();

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect(next.mock.calls[0][0].message).toBe('Authentication failed');
    });

    it('should reject blacklisted token', async () => {
      const token = generateTestToken(testUser._id);
      mockSocket.handshake.auth.token = token;
      await redisClient.set(`bl_${token}`, 'true');
      const next = jest.fn();

      await handler.setupMiddleware();

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect(next.mock.calls[0][0].message).toBe('Token has been invalidated');
    });
  });

  describe('Project Room Management', () => {
    it('should handle joining project room', async () => {
      const callback = mockIo.on.mock.calls[0][1];
      await callback(mockSocket);

      mockSocket.emit('join_project', testProject._id);

      expect(mockSocket.join).toHaveBeenCalledWith(`project_${testProject._id}`);
      expect(mockSocket.to).toHaveBeenCalledWith(`project_${testProject._id}`);
      expect(mockSocket.emit).toHaveBeenCalledWith('user_online', {
        userId: testUser._id.toString(),
        name: testUser.name
      });

      // Verify presence in Redis
      const presence = await redisClient.hget(`presence_${testProject._id}`, testUser._id);
      expect(presence).toBeDefined();
      const presenceData = JSON.parse(presence);
      expect(presenceData.userId).toBe(testUser._id.toString());
    });

    it('should handle leaving project room', async () => {
      const callback = mockIo.on.mock.calls[0][1];
      await callback(mockSocket);

      mockSocket.rooms.add(`project_${testProject._id}`);
      mockSocket.emit('disconnect');

      expect(mockSocket.leave).toHaveBeenCalledWith(`project_${testProject._id}`);
      
      // Verify presence removed from Redis
      const presence = await redisClient.hget(`presence_${testProject._id}`, testUser._id);
      expect(presence).toBeNull();
    });
  });

  describe('Component Editing', () => {
    it('should handle start editing component', async () => {
      const callback = mockIo.on.mock.calls[0][1];
      await callback(mockSocket);

      mockSocket.emit('start_editing_component', {
        projectId: testProject._id,
        componentId: testComponent._id
      });

      // Verify lock in Redis
      const lock = await redisClient.get(`lock_${testComponent._id}`);
      expect(lock).toBe(testUser._id.toString());

      expect(mockSocket.to).toHaveBeenCalledWith(`project_${testProject._id}`);
      expect(mockSocket.emit).toHaveBeenCalledWith('component_editing', {
        componentId: testComponent._id.toString(),
        user: {
          id: testUser._id.toString(),
          name: testUser.name
        }
      });
    });

    it('should handle component changes', async () => {
      const callback = mockIo.on.mock.calls[0][1];
      await callback(mockSocket);

      // Set lock
      await redisClient.set(`lock_${testComponent._id}`, testUser._id);

      const changes = { content: 'Updated content' };
      mockSocket.emit('component_change', {
        projectId: testProject._id,
        componentId: testComponent._id,
        changes
      });

      expect(mockSocket.to).toHaveBeenCalledWith(`project_${testProject._id}`);
      expect(mockSocket.emit).toHaveBeenCalledWith('component_updated', {
        componentId: testComponent._id.toString(),
        changes,
        user: {
          id: testUser._id.toString(),
          name: testUser.name
        }
      });

      // Verify changes stored in Redis
      const changeKey = `changes_${testComponent._id}`;
      const storedChanges = await redisClient.lrange(changeKey, 0, -1);
      expect(storedChanges).toHaveLength(1);
      const parsedChanges = JSON.parse(storedChanges[0]);
      expect(parsedChanges.changes).toEqual(changes);
    });

    it('should handle stop editing component', async () => {
      const callback = mockIo.on.mock.calls[0][1];
      await callback(mockSocket);

      // Set lock
      await redisClient.set(`lock_${testComponent._id}`, testUser._id);

      mockSocket.emit('stop_editing_component', {
        projectId: testProject._id,
        componentId: testComponent._id
      });

      // Verify lock removed from Redis
      const lock = await redisClient.get(`lock_${testComponent._id}`);
      expect(lock).toBeNull();

      expect(mockSocket.to).toHaveBeenCalledWith(`project_${testProject._id}`);
      expect(mockSocket.emit).toHaveBeenCalledWith('component_unlocked', {
        componentId: testComponent._id.toString(),
        user: {
          id: testUser._id.toString(),
          name: testUser.name
        }
      });
    });
  });

  describe('Chat Messages', () => {
    it('should handle sending chat messages', async () => {
      const callback = mockIo.on.mock.calls[0][1];
      await callback(mockSocket);

      const message = 'Test message';
      mockSocket.emit('send_message', {
        projectId: testProject._id,
        message
      });

      expect(mockSocket.to).toHaveBeenCalledWith(`project_${testProject._id}`);
      expect(mockSocket.emit).toHaveBeenCalledWith('new_message', expect.objectContaining({
        userId: testUser._id.toString(),
        userName: testUser.name,
        message
      }));

      // Verify message stored in Redis
      const chatKey = `chat_${testProject._id}`;
      const messages = await redisClient.lrange(chatKey, 0, -1);
      expect(messages).toHaveLength(1);
      const storedMessage = JSON.parse(messages[0]);
      expect(storedMessage.message).toBe(message);
    });
  });

  describe('Cursor Position', () => {
    it('should broadcast cursor position updates', async () => {
      const callback = mockIo.on.mock.calls[0][1];
      await callback(mockSocket);

      const position = { line: 1, column: 10 };
      mockSocket.emit('cursor_move', {
        projectId: testProject._id,
        componentId: testComponent._id,
        position
      });

      expect(mockSocket.to).toHaveBeenCalledWith(`project_${testProject._id}`);
      expect(mockSocket.emit).toHaveBeenCalledWith('cursor_moved', {
        componentId: testComponent._id.toString(),
        position,
        user: {
          id: testUser._id.toString(),
          name: testUser.name
        }
      });
    });
  });

  describe('Cleanup', () => {
    it('should clean up resources on disconnect', async () => {
      const callback = mockIo.on.mock.calls[0][1];
      await callback(mockSocket);

      // Set up test data
      mockSocket.rooms.add(`project_${testProject._id}`);
      await redisClient.hset(
        `presence_${testProject._id}`,
        testUser._id,
        JSON.stringify({ userId: testUser._id, name: testUser.name })
      );
      await redisClient.set(`lock_${testComponent._id}`, testUser._id);

      mockSocket.emit('disconnect');

      // Verify presence removed
      const presence = await redisClient.hget(`presence_${testProject._id}`, testUser._id);
      expect(presence).toBeNull();

      // Verify lock removed
      const lock = await redisClient.get(`lock_${testComponent._id}`);
      expect(lock).toBeNull();

      expect(mockSocket.to).toHaveBeenCalledWith(`project_${testProject._id}`);
      expect(mockSocket.emit).toHaveBeenCalledWith('user_offline', {
        userId: testUser._id.toString(),
        name: testUser.name
      });
    });
  });
});
