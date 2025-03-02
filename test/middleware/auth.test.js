const { requireAuth, requireRole, requireApiKey } = require('../../src/middleware/auth');
const User = require('../../src/models/user');
const { redisClient } = require('../../src/config/redis');

describe('Auth Middleware', () => {
  let mockReq;
  let mockRes;
  let nextFunction;

  beforeEach(() => {
    mockReq = {
      headers: {},
      path: '/test'
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    nextFunction = jest.fn();
  });

  describe('requireAuth', () => {
    it('should return 401 if no token is provided', async () => {
      await requireAuth(mockReq, mockRes, nextFunction);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'No token provided'
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should return 401 if token is invalid', async () => {
      mockReq.headers.authorization = 'Bearer invalid-token';

      await requireAuth(mockReq, mockRes, nextFunction);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Invalid token'
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should return 401 if token is blacklisted', async () => {
      const user = await createTestUser();
      const token = generateTestToken(user._id);
      mockReq.headers.authorization = `Bearer ${token}`;

      await redisClient.set(`bl_${token}`, 'true');

      await requireAuth(mockReq, mockRes, nextFunction);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Token has been invalidated'
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should return 401 if user not found', async () => {
      const nonExistentId = '507f1f77bcf86cd799439011';
      const token = generateTestToken(nonExistentId);
      mockReq.headers.authorization = `Bearer ${token}`;

      await requireAuth(mockReq, mockRes, nextFunction);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'User not found'
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should return 401 if user is inactive', async () => {
      const user = await createTestUser({ isActive: false });
      const token = generateTestToken(user._id);
      mockReq.headers.authorization = `Bearer ${token}`;

      await requireAuth(mockReq, mockRes, nextFunction);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Account is deactivated'
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should return 403 if email not verified', async () => {
      const user = await createTestUser({ emailVerified: false });
      const token = generateTestToken(user._id);
      mockReq.headers.authorization = `Bearer ${token}`;

      await requireAuth(mockReq, mockRes, nextFunction);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Email not verified',
        code: 'EMAIL_NOT_VERIFIED'
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should proceed if token is valid and user is active', async () => {
      const user = await createTestUser();
      const token = generateTestToken(user._id);
      mockReq.headers.authorization = `Bearer ${token}`;

      await requireAuth(mockReq, mockRes, nextFunction);

      expect(mockReq.user).toBeDefined();
      expect(mockReq.user.id).toEqual(user._id.toString());
      expect(nextFunction).toHaveBeenCalled();
    });
  });

  describe('requireRole', () => {
    it('should return 401 if user not authenticated', async () => {
      const requireAdmin = requireRole(['admin']);
      await requireAdmin(mockReq, mockRes, nextFunction);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'User not authenticated'
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should return 403 if user lacks required role', async () => {
      const user = await createTestUser({ roles: ['user'] });
      mockReq.user = user;

      const requireAdmin = requireRole(['admin']);
      await requireAdmin(mockReq, mockRes, nextFunction);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Insufficient permissions'
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should proceed if user has required role', async () => {
      const user = await createTestUser({ roles: ['admin'] });
      mockReq.user = user;

      const requireAdmin = requireRole(['admin']);
      await requireAdmin(mockReq, mockRes, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
    });
  });

  describe('requireApiKey', () => {
    it('should return 401 if no API key provided', async () => {
      await requireApiKey(mockReq, mockRes, nextFunction);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'API key required'
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should return 401 if API key is invalid', async () => {
      mockReq.headers['x-api-key'] = 'invalid-key';

      await requireApiKey(mockReq, mockRes, nextFunction);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Invalid API key'
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should proceed if API key is valid', async () => {
      const apiClient = {
        name: 'Test Client',
        apiKey: 'valid-key',
        isActive: true
      };

      // Cache the API key
      await redisClient.setex(
        `apikey_${apiClient.apiKey}`,
        3600,
        JSON.stringify(apiClient)
      );

      mockReq.headers['x-api-key'] = apiClient.apiKey;

      await requireApiKey(mockReq, mockRes, nextFunction);

      expect(mockReq.apiClient).toBeDefined();
      expect(mockReq.apiClient.name).toBe(apiClient.name);
      expect(nextFunction).toHaveBeenCalled();
    });
  });
});
