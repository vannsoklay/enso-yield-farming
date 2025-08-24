const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

// Create rate limiter middleware
const rateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too Many Requests',
    message: 'You have exceeded the rate limit. Please try again later.',
    retryAfter: Math.ceil((parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000) / 1000)
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  
  // Custom handler for rate limit exceeded
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      url: req.url,
      method: req.method
    });
    
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'You have exceeded the rate limit. Please try again later.',
      retryAfter: Math.ceil((parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000) / 1000),
      timestamp: new Date().toISOString()
    });
  },
  
  // Skip rate limiting for certain conditions
  skip: (req) => {
    // Skip rate limiting for health checks
    if (req.url.includes('/health')) {
      return true;
    }
    
    // Skip rate limiting in test environment
    if (process.env.NODE_ENV === 'test') {
      return true;
    }
    
    return false;
  }
});

// Stricter rate limiter for authentication endpoints
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 auth requests per windowMs
  message: {
    error: 'Too Many Authentication Attempts',
    message: 'Too many authentication attempts. Please try again later.',
    retryAfter: 900 // 15 minutes
  },
  standardHeaders: true,
  legacyHeaders: false,
  
  handler: (req, res) => {
    logger.warn('Auth rate limit exceeded', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      url: req.url
    });
    
    res.status(429).json({
      error: 'Too Many Authentication Attempts',
      message: 'Too many authentication attempts. Please try again later.',
      retryAfter: 900,
      timestamp: new Date().toISOString()
    });
  }
});

// Stricter rate limiter for transaction endpoints
const transactionRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // limit each IP to 10 transaction requests per minute
  message: {
    error: 'Too Many Transaction Requests',
    message: 'Too many transaction requests. Please wait before trying again.',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  
  handler: (req, res) => {
    logger.warn('Transaction rate limit exceeded', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      url: req.url
    });
    
    res.status(429).json({
      error: 'Too Many Transaction Requests',
      message: 'Too many transaction requests. Please wait before trying again.',
      retryAfter: 60,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = {
  rateLimiter,
  authRateLimiter,
  transactionRateLimiter
};