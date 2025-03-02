const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { redisClient } = require('../src/config/redis');
const jwt = require('jsonwebtoken');

let mongoServer;

// Setup environment variables for testing
process.env.JWT_SECRET = 'test-secret';
process.env.NODE_ENV = 'test';
process.env.UPLOAD_PATH = './test/uploads';
process.env.MAX_FILE_SIZE = '5242880';

// Setup MongoDB Memory Server
beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
});

// Clear database and Redis cache before each test
beforeEach(async () => {
  const collections = await mongoose.connection.db.collections();
  for (let collection of collections) {
    await collection.deleteMany({});
  }
  await redisClient.flushall();
});

// Cleanup after all tests
afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
  await redisClient.quit();
});

// Global test helpers
global.createTestUser = async (userData = {}) => {
  const User = require('../src/models/user');
  const defaultData = {
    name: 'Test User',
    email: 'test@example.com',
    password: 'password123',
    isActive: true,
    emailVerified: true,
    roles: ['user']
  };

  const user = new User({
    ...defaultData,
    ...userData
  });

  await user.save();
  return user;
};

global.generateTestToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: '1h'
  });
};

global.createTestProject = async (projectData = {}) => {
  const Project = require('../src/models/project');
  const defaultData = {
    name: 'Test Project',
    description: 'A test project',
    owner: null,
    collaborators: [],
    isPublic: false,
    status: 'active'
  };

  const project = new Project({
    ...defaultData,
    ...projectData
  });

  await project.save();
  return project;
};

global.createTestComponent = async (componentData = {}) => {
  const Component = require('../src/models/component');
  const defaultData = {
    name: 'Test Component',
    type: 'react',
    content: '<div>Test</div>',
    project: null,
    creator: null,
    version: '1.0.0',
    status: 'active'
  };

  const component = new Component({
    ...defaultData,
    ...componentData
  });

  await component.save();
  return component;
};

global.createTestAsset = async (assetData = {}) => {
  const Asset = require('../src/models/asset');
  const defaultData = {
    name: 'test-image.jpg',
    type: 'image',
    url: '/assets/test-image.jpg',
    path: './test/uploads/test-image.jpg',
    project: null,
    uploader: null,
    metadata: {
      size: 1024,
      mimeType: 'image/jpeg',
      dimensions: {
        width: 800,
        height: 600
      }
    }
  };

  const asset = new Asset({
    ...defaultData,
    ...assetData
  });

  await asset.save();
  return asset;
};

// Mock Socket.IO for WebSocket tests
jest.mock('socket.io', () => {
  const mockIo = {
    use: jest.fn(),
    on: jest.fn(),
    to: jest.fn().mockReturnThis(),
    emit: jest.fn()
  };
  return jest.fn(() => mockIo);
});

// Mock file system operations
jest.mock('fs', () => ({
  promises: {
    unlink: jest.fn(),
    mkdir: jest.fn(),
    rename: jest.fn(),
    stat: jest.fn()
  }
}));

// Mock Sharp for image processing
jest.mock('sharp', () => {
  return jest.fn().mockReturnValue({
    resize: jest.fn().mockReturnThis(),
    jpeg: jest.fn().mockReturnThis(),
    webp: jest.fn().mockReturnThis(),
    avif: jest.fn().mockReturnThis(),
    toFile: jest.fn().mockResolvedValue({}),
    metadata: jest.fn().mockResolvedValue({
      width: 800,
      height: 600
    })
  });
});

// Mock Multer for file uploads
jest.mock('multer', () => {
  return jest.fn().mockImplementation(() => ({
    single: jest.fn().mockImplementation(() => (req, res, next) => next()),
    array: jest.fn().mockImplementation(() => (req, res, next) => next())
  }));
});
