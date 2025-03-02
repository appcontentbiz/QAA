const jwt = require('jsonwebtoken');
const User = require('../models/user');
const { redisClient } = require('../config/redis');

/**
 * Authentication middleware
 */
exports.requireAuth = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if token is blacklisted (logged out)
    const isBlacklisted = await redisClient.get(`bl_${token}`);
    if (isBlacklisted) {
      return res.status(401).json({ message: 'Token has been invalidated' });
    }

    // Get user
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({ message: 'Account is deactivated' });
    }

    // Check if email is verified (skip for some routes)
    const skipVerificationRoutes = ['/api/auth/verify-email', '/api/auth/resend-verification'];
    if (!user.emailVerified && !skipVerificationRoutes.includes(req.path)) {
      return res.status(403).json({ 
        message: 'Email not verified',
        code: 'EMAIL_NOT_VERIFIED'
      });
    }

    // Add user to request
    req.user = user;

    // Update last active timestamp
    user.lastActive = new Date();
    await user.save();

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    console.error('Auth middleware error:', error);
    res.status(500).json({ message: 'Server error in auth middleware' });
  }
};

/**
 * Role-based authorization middleware
 */
exports.requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const hasRole = roles.some(role => req.user.roles.includes(role));
    if (!hasRole) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    next();
  };
};

/**
 * API key authentication middleware for service-to-service communication
 */
exports.requireApiKey = async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) {
      return res.status(401).json({ message: 'API key required' });
    }

    // Check API key in Redis cache first
    const cachedApiKey = await redisClient.get(`apikey_${apiKey}`);
    if (cachedApiKey) {
      req.apiClient = JSON.parse(cachedApiKey);
      return next();
    }

    // If not in cache, check database
    const apiClient = await ApiClient.findOne({ apiKey, isActive: true });
    if (!apiClient) {
      return res.status(401).json({ message: 'Invalid API key' });
    }

    // Cache API key details
    await redisClient.setex(
      `apikey_${apiKey}`,
      3600, // Cache for 1 hour
      JSON.stringify(apiClient)
    );

    req.apiClient = apiClient;
    next();
  } catch (error) {
    console.error('API key auth error:', error);
    res.status(500).json({ message: 'Server error in API key authentication' });
  }
};

/**
 * Rate limiting middleware
 */
exports.rateLimit = async (req, res, next) => {
  try {
    const key = req.user ? `rate_${req.user.id}` : `rate_${req.ip}`;
    const limit = req.user ? 100 : 30; // Higher limit for authenticated users
    const window = 60; // 1 minute window

    const current = await redisClient.get(key);
    if (current && parseInt(current) >= limit) {
      return res.status(429).json({
        message: 'Too many requests',
        retryAfter: await redisClient.ttl(key)
      });
    }

    await redisClient.multi()
      .incr(key)
      .expire(key, window)
      .exec();

    next();
  } catch (error) {
    console.error('Rate limit error:', error);
    // Continue on rate limit error
    next();
  }
};

/**
 * OAuth state verification middleware
 */
exports.verifyOAuthState = async (req, res, next) => {
  try {
    const { state } = req.query;
    if (!state) {
      return res.status(400).json({ message: 'OAuth state parameter required' });
    }

    const savedState = await redisClient.get(`oauth_state_${state}`);
    if (!savedState) {
      return res.status(400).json({ message: 'Invalid or expired OAuth state' });
    }

    // Clean up used state
    await redisClient.del(`oauth_state_${state}`);

    next();
  } catch (error) {
    console.error('OAuth state verification error:', error);
    res.status(500).json({ message: 'Server error in OAuth verification' });
  }
};

/**
 * Session management middleware
 */
exports.manageSession = async (req, res, next) => {
  try {
    if (!req.user) {
      return next();
    }

    const sessionKey = `session_${req.user.id}`;
    const currentSession = await redisClient.get(sessionKey);

    if (currentSession) {
      // Update session data
      const session = JSON.parse(currentSession);
      session.lastActivity = Date.now();
      session.userAgent = req.headers['user-agent'];
      session.ip = req.ip;

      await redisClient.setex(
        sessionKey,
        24 * 60 * 60, // 24 hours
        JSON.stringify(session)
      );
    }

    next();
  } catch (error) {
    console.error('Session management error:', error);
    // Continue on session error
    next();
  }
};

/**
 * Security headers middleware
 */
exports.securityHeaders = (req, res, next) => {
  // HSTS
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  
  // XSS Protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Content Security Policy
  res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; connect-src 'self' https:;");
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Frame Options
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  
  next();
};
