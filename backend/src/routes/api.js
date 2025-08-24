const express = require('express');
const router = express.Router();

// Import controllers
const balanceController = require('../controllers/balanceController');
const farmingController = require('../controllers/farmingController');
const transactionController = require('../controllers/transactionController');

// Import middleware
const { validateBalanceQuery, validateDeposit, validateWithdraw, validateCompound, validateGasEstimate, validateTransactionQuery } = require('../middleware/validation');
const { transactionRateLimiter } = require('../middleware/rateLimiter');
const { optionalAuth, validateUserAddress } = require('../middleware/auth');
const logger = require('../utils/logger');

// Middleware to log all API requests
router.use((req, res, next) => {
  logger.info('API request', {
    method: req.method,
    url: req.url,
    requestId: req.id,
    userAgent: req.get('User-Agent'),
    ip: req.ip
  });
  next();
});

// ==============
// HEALTH ROUTES
// ==============

/**
 * @route GET /api/status
 * @desc Get API status and basic information
 * @access Public
 */
router.get('/status', (req, res) => {
  const monitoringService = require('../services/monitoringService');
  const socketService = require('../services/socketService');

  res.json({
    success: true,
    service: 'Enso Yield Farming API',
    version: '1.0.0',
    status: 'operational',
    timestamp: new Date().toISOString(),
    stats: {
      monitoring: monitoringService.getMonitoringStats(),
      connections: socketService.getConnectionStats()
    }
  });
});

// ==============
// BALANCE ROUTES
// ==============

/**
 * @route GET /api/balances
 * @desc Get balances for all chains or specific chain
 * @access Public
 */
router.get('/balances', validateBalanceQuery, balanceController.getBalances);

/**
 * @route GET /api/balances/:chain
 * @desc Get balances for specific chain (polygon or gnosis)
 * @access Public
 */
router.get('/balances/:chain', balanceController.getBalancesByChain);

/**
 * @route POST /api/balances/refresh
 * @desc Refresh balances and clear cache
 * @access Public
 */
router.post('/balances/refresh', optionalAuth, validateUserAddress, balanceController.refreshBalances);

/**
 * @route GET /api/balances/history
 * @desc Get balance history for analytics
 * @access Public
 */
router.get('/balances/history', validateBalanceQuery, balanceController.getBalanceHistory);

// =================
// FARMING ROUTES
// =================

/**
 * @route POST /api/deposit
 * @desc Deposit EURe for LP tokens
 * @access Public
 */
router.post('/deposit', 
  transactionRateLimiter,
  validateDeposit, 
  optionalAuth, 
  validateUserAddress, 
  farmingController.deposit
);

/**
 * @route POST /api/withdraw
 * @desc Withdraw LP tokens for EURe
 * @access Public
 */
router.post('/withdraw', 
  transactionRateLimiter,
  validateWithdraw, 
  optionalAuth, 
  validateUserAddress, 
  farmingController.withdraw
);

/**
 * @route POST /api/compound
 * @desc Auto-compound available earnings
 * @access Public
 */
router.post('/compound', 
  transactionRateLimiter,
  validateCompound, 
  optionalAuth, 
  validateUserAddress, 
  farmingController.compound
);

/**
 * @route POST /api/estimate
 * @desc Estimate gas costs for operations
 * @access Public
 */
router.post('/estimate', validateGasEstimate, farmingController.estimate);

/**
 * @route GET /api/earnings
 * @desc Get available earnings for user
 * @access Public
 */
router.get('/earnings', farmingController.getEarnings);

// =====================
// TRANSACTION ROUTES
// =====================

/**
 * @route GET /api/transactions
 * @desc Get transaction history with filtering and pagination
 * @access Public
 */
router.get('/transactions', validateTransactionQuery, transactionController.getTransactions);

/**
 * @route GET /api/transactions/:id
 * @desc Get specific transaction by ID
 * @access Public
 */
router.get('/transactions/:id', transactionController.getTransactionById);

/**
 * @route POST /api/transactions/retry
 * @desc Retry a failed transaction
 * @access Public
 */
router.post('/transactions/retry', 
  transactionRateLimiter,
  transactionController.retryTransaction
);

/**
 * @route POST /api/transactions/cancel
 * @desc Cancel a pending transaction
 * @access Public
 */
router.post('/transactions/cancel', transactionController.cancelTransaction);

/**
 * @route GET /api/transactions/stats
 * @desc Get transaction statistics
 * @access Public
 */
router.get('/transactions/stats', transactionController.getTransactionStats);

// ======================
// MONITORING ROUTES
// ======================

/**
 * @route GET /api/monitoring/stats
 * @desc Get monitoring service statistics
 * @access Public
 */
router.get('/monitoring/stats', (req, res) => {
  const monitoringService = require('../services/monitoringService');
  
  res.json({
    success: true,
    data: monitoringService.getMonitoringStats(),
    timestamp: new Date().toISOString(),
    requestId: req.id
  });
});

/**
 * @route POST /api/monitoring/stop/:txId
 * @desc Stop monitoring a specific transaction
 * @access Public
 */
router.post('/monitoring/stop/:txId', (req, res) => {
  const { txId } = req.params;
  const monitoringService = require('../services/monitoringService');
  
  const stopped = monitoringService.stopMonitoring(txId);
  
  res.json({
    success: stopped,
    message: stopped ? 'Monitoring stopped' : 'Transaction not found or not being monitored',
    data: { transactionId: txId },
    timestamp: new Date().toISOString(),
    requestId: req.id
  });
});

// ===================
// WEBSOCKET ROUTES
// ===================

/**
 * @route GET /api/websocket/stats
 * @desc Get WebSocket connection statistics
 * @access Public
 */
router.get('/websocket/stats', (req, res) => {
  const socketService = require('../services/socketService');
  
  res.json({
    success: true,
    data: socketService.getConnectionStats(),
    timestamp: new Date().toISOString(),
    requestId: req.id
  });
});

/**
 * @route POST /api/websocket/broadcast
 * @desc Broadcast system notification to all users
 * @access Public (should be protected in production)
 */
router.post('/websocket/broadcast', (req, res) => {
  const { type, title, message } = req.body;
  const socketService = require('../services/socketService');
  
  if (!type || !message) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Type and message are required',
      requestId: req.id
    });
  }
  
  socketService.broadcastSystemNotification({
    type,
    title: title || 'System Notification',
    message
  });
  
  res.json({
    success: true,
    message: 'Notification broadcasted successfully',
    data: { type, title, message },
    timestamp: new Date().toISOString(),
    requestId: req.id
  });
});

// =================
// ERROR HANDLING
// =================

// Catch 404 for API routes
router.use('*', (req, res) => {
  res.status(404).json({
    error: 'API Endpoint Not Found',
    message: `The API endpoint ${req.method} ${req.originalUrl} does not exist`,
    availableEndpoints: [
      'GET /api/status',
      'GET /api/balances',
      'GET /api/balances/:chain',
      'POST /api/deposit',
      'POST /api/withdraw',
      'POST /api/compound',
      'POST /api/estimate',
      'GET /api/transactions',
      'GET /api/transactions/:id',
      'POST /api/transactions/retry'
    ],
    timestamp: new Date().toISOString(),
    requestId: req.id
  });
});

module.exports = router;