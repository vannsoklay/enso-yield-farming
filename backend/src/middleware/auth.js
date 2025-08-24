const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const { isValidAddress } = require('../utils/helpers');

// JWT secret from environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-in-production';

// Generate JWT token for user session
const generateToken = (userAddress) => {
  if (!isValidAddress(userAddress)) {
    throw new Error('Invalid user address');
  }

  const payload = {
    userAddress: userAddress.toLowerCase(),
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
  };

  return jwt.sign(payload, JWT_SECRET);
};

// Verify JWT token
const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
};

// Middleware to authenticate requests
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    logger.warn('Authentication failed - No token provided', {
      requestId: req.id,
      ip: req.ip,
      url: req.url
    });

    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Access token is required',
      timestamp: new Date().toISOString(),
      requestId: req.id
    });
  }

  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    
    logger.info('User authenticated successfully', {
      requestId: req.id,
      userAddress: decoded.userAddress
    });

    next();
  } catch (error) {
    logger.warn('Authentication failed - Invalid token', {
      requestId: req.id,
      error: error.message,
      ip: req.ip
    });

    return res.status(403).json({
      error: 'Forbidden',
      message: 'Invalid or expired token',
      timestamp: new Date().toISOString(),
      requestId: req.id
    });
  }
};

// Optional authentication middleware (doesn't fail if no token)
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    try {
      const decoded = verifyToken(token);
      req.user = decoded;
    } catch (error) {
      // Token is invalid, but we don't fail the request
      logger.info('Optional auth failed', {
        requestId: req.id,
        error: error.message
      });
    }
  }

  next();
};

// Middleware to validate user address matches token
const validateUserAddress = (req, res, next) => {
  const { userAddress } = req.body || req.query;
  
  if (!userAddress) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'User address is required',
      timestamp: new Date().toISOString(),
      requestId: req.id
    });
  }

  // If user is authenticated, check if address matches
  if (req.user && req.user.userAddress.toLowerCase() !== userAddress.toLowerCase()) {
    logger.warn('Address mismatch', {
      requestId: req.id,
      tokenAddress: req.user.userAddress,
      requestAddress: userAddress
    });

    return res.status(403).json({
      error: 'Forbidden',
      message: 'User address does not match authenticated user',
      timestamp: new Date().toISOString(),
      requestId: req.id
    });
  }

  next();
};

// Middleware for admin-only routes
const requireAdmin = (req, res, next) => {
  if (!req.user || !req.user.isAdmin) {
    logger.warn('Admin access denied', {
      requestId: req.id,
      userAddress: req.user?.userAddress,
      url: req.url
    });

    return res.status(403).json({
      error: 'Forbidden',
      message: 'Admin access required',
      timestamp: new Date().toISOString(),
      requestId: req.id
    });
  }

  next();
};

// Simple API key authentication for internal services
const authenticateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  const validApiKey = process.env.INTERNAL_API_KEY;

  if (!validApiKey) {
    return next(); // Skip if no API key is configured
  }

  if (!apiKey || apiKey !== validApiKey) {
    logger.warn('API key authentication failed', {
      requestId: req.id,
      providedKey: apiKey ? 'provided' : 'missing',
      ip: req.ip
    });

    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Valid API key is required',
      timestamp: new Date().toISOString(),
      requestId: req.id
    });
  }

  next();
};

module.exports = {
  generateToken,
  verifyToken,
  authenticateToken,
  optionalAuth,
  validateUserAddress,
  requireAdmin,
  authenticateApiKey
};