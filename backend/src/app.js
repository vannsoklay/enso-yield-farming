const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const { createServer } = require('http');
const { Server } = require('socket.io');

const logger = require('./utils/logger');
const rateLimiter = require('./middleware/rateLimiter');

// Import routes
const healthRoutes = require('./routes/health');
const apiRoutes = require('./routes/api');

// Import services
const socketService = require('./services/socketService');

const app = express();
const server = createServer(app);

// Socket.io setup
const io = new Server(server, {
  cors: {
    origin: process.env.SOCKET_CORS_ORIGIN || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Compression middleware
app.use(compression());

// HTTP request logging
app.use(morgan('combined', { stream: logger.stream }));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
app.use(rateLimiter);

// Request ID middleware for tracking
app.use((req, res, next) => {
  req.id = require('uuid').v4();
  res.setHeader('X-Request-ID', req.id);
  next();
});

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`, {
    requestId: req.id,
    userAgent: req.get('User-Agent'),
    ip: req.ip
  });
  next();
});

// Health check routes (no rate limiting)
app.use('/health', healthRoutes);
app.use('/api/health', healthRoutes);

// API routes
app.use('/api', apiRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Enso Yield Farming API',
    version: '1.0.0',
    status: 'operational',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/api/health',
      balances: '/api/balances',
      deposit: '/api/deposit',
      withdraw: '/api/withdraw',
      compound: '/api/compound',
      transactions: '/api/transactions'
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  logger.warn(`404 - Route not found: ${req.method} ${req.originalUrl}`, {
    requestId: req.id
  });
  
  res.status(404).json({
    error: 'Route not found',
    message: `The requested route ${req.method} ${req.originalUrl} does not exist`,
    timestamp: new Date().toISOString(),
    requestId: req.id
  });
});

// Global error handler
app.use((error, req, res, next) => {
  logger.error('Unhandled error:', {
    error: error.message,
    stack: error.stack,
    requestId: req.id,
    url: req.url,
    method: req.method
  });

  // Don't leak error details in production
  const isDev = process.env.NODE_ENV === 'development';
  
  res.status(error.status || 500).json({
    error: 'Internal Server Error',
    message: isDev ? error.message : 'Something went wrong',
    requestId: req.id,
    timestamp: new Date().toISOString(),
    ...(isDev && { stack: error.stack })
  });
});

// Initialize Socket.io service
socketService.initialize(io);

// Attach io to app for access in routes
app.set('io', io);

module.exports = app;