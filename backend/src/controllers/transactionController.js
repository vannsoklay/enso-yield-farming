const logger = require('../utils/logger');
const monitoringService = require('../services/monitoringService');
const socketService = require('../services/socketService');

// Mock transaction storage (in production, use a database)
const transactionStore = new Map();

/**
 * Get transaction history with filtering and pagination
 */
const getTransactions = async (req, res) => {
  try {
    const { 
      userAddress, 
      status, 
      type, 
      limit = 20, 
      offset = 0 
    } = req.query;

    logger.info('Getting transaction history', {
      requestId: req.id,
      userAddress,
      status,
      type,
      limit,
      offset
    });

    // Generate mock transaction history
    const transactions = generateMockTransactions(userAddress, {
      status,
      type,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: {
        transactions,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: transactions.length,
          hasMore: transactions.length === parseInt(limit)
        },
        filters: {
          userAddress,
          status,
          type
        }
      },
      timestamp: new Date().toISOString(),
      requestId: req.id
    });

    logger.info('Transaction history retrieved', {
      requestId: req.id,
      count: transactions.length,
      userAddress
    });

  } catch (error) {
    logger.error('Failed to get transaction history', {
      requestId: req.id,
      error: error.message,
      userAddress: req.query.userAddress
    });

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve transaction history',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      requestId: req.id,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Get specific transaction by ID
 */
const getTransactionById = async (req, res) => {
  try {
    const { id } = req.params;

    logger.info('Getting transaction by ID', {
      requestId: req.id,
      transactionId: id
    });

    // Check if transaction exists in our mock store
    let transaction = transactionStore.get(id);

    if (!transaction) {
      // Generate a mock transaction if not found
      transaction = generateMockTransaction(id);
    }

    if (!transaction) {
      return res.status(404).json({
        error: 'Transaction Not Found',
        message: `Transaction with ID ${id} not found`,
        requestId: req.id,
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      data: transaction,
      timestamp: new Date().toISOString(),
      requestId: req.id
    });

    logger.info('Transaction retrieved successfully', {
      requestId: req.id,
      transactionId: id,
      status: transaction.status
    });

  } catch (error) {
    logger.error('Failed to get transaction', {
      requestId: req.id,
      error: error.message,
      transactionId: req.params.id
    });

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve transaction',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      requestId: req.id,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Retry a failed transaction
 */
const retryTransaction = async (req, res) => {
  try {
    const { transactionId } = req.body;

    logger.info('Retrying transaction', {
      requestId: req.id,
      transactionId
    });

    // Get original transaction
    let transaction = transactionStore.get(transactionId);

    if (!transaction) {
      return res.status(404).json({
        error: 'Transaction Not Found',
        message: `Transaction with ID ${transactionId} not found`,
        requestId: req.id
      });
    }

    if (transaction.status !== 'failed') {
      return res.status(400).json({
        error: 'Invalid Transaction Status',
        message: 'Only failed transactions can be retried',
        currentStatus: transaction.status,
        requestId: req.id
      });
    }

    // Create new transaction for retry
    const retryTxId = `retry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const retryTransaction = {
      ...transaction,
      id: retryTxId,
      status: 'pending',
      retryOf: transactionId,
      retryAttempt: (transaction.retryAttempt || 0) + 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      error: null
    };

    // Store retry transaction
    transactionStore.set(retryTxId, retryTransaction);

    // Start monitoring the retry
    monitoringService.startTransactionMonitoring(
      retryTxId,
      retryTransaction.txHash,
      transaction.userAddress,
      transaction.type,
      {
        ...transaction.details,
        isRetry: true,
        originalTxId: transactionId
      }
    );

    res.status(202).json({
      success: true,
      message: 'Transaction retry initiated',
      data: {
        originalTransactionId: transactionId,
        retryTransactionId: retryTxId,
        retryAttempt: retryTransaction.retryAttempt,
        status: 'pending'
      },
      timestamp: new Date().toISOString(),
      requestId: req.id
    });

    logger.info('Transaction retry initiated', {
      requestId: req.id,
      originalTxId: transactionId,
      retryTxId,
      retryAttempt: retryTransaction.retryAttempt
    });

    // Send WebSocket notification
    socketService.sendUserNotification(transaction.userAddress, {
      type: 'info',
      title: 'Transaction Retry Initiated',
      message: `Retry for ${transaction.type} transaction has been initiated`,
      txId: retryTxId,
      originalTxId: transactionId
    });

  } catch (error) {
    logger.error('Failed to retry transaction', {
      requestId: req.id,
      error: error.message,
      transactionId: req.body.transactionId
    });

    res.status(500).json({
      error: 'Transaction Retry Failed',
      message: 'Failed to retry transaction',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      requestId: req.id,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Cancel a pending transaction
 */
const cancelTransaction = async (req, res) => {
  try {
    const { transactionId } = req.body;

    logger.info('Cancelling transaction', {
      requestId: req.id,
      transactionId
    });

    let transaction = transactionStore.get(transactionId);

    if (!transaction) {
      return res.status(404).json({
        error: 'Transaction Not Found',
        message: `Transaction with ID ${transactionId} not found`,
        requestId: req.id
      });
    }

    if (transaction.status !== 'pending') {
      return res.status(400).json({
        error: 'Invalid Transaction Status',
        message: 'Only pending transactions can be cancelled',
        currentStatus: transaction.status,
        requestId: req.id
      });
    }

    // Update transaction status
    transaction.status = 'cancelled';
    transaction.updatedAt = new Date().toISOString();
    transaction.cancelledAt = new Date().toISOString();

    // Stop monitoring
    monitoringService.stopMonitoring(transactionId);

    res.json({
      success: true,
      message: 'Transaction cancelled successfully',
      data: {
        transactionId,
        status: 'cancelled',
        cancelledAt: transaction.cancelledAt
      },
      timestamp: new Date().toISOString(),
      requestId: req.id
    });

    logger.info('Transaction cancelled successfully', {
      requestId: req.id,
      transactionId
    });

    // Send WebSocket notification
    socketService.broadcastTransactionUpdate(transaction.userAddress, {
      ...transaction,
      status: 'cancelled'
    });

  } catch (error) {
    logger.error('Failed to cancel transaction', {
      requestId: req.id,
      error: error.message,
      transactionId: req.body.transactionId
    });

    res.status(500).json({
      error: 'Transaction Cancellation Failed',
      message: 'Failed to cancel transaction',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      requestId: req.id,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Get transaction statistics
 */
const getTransactionStats = async (req, res) => {
  try {
    const { userAddress, days = 30 } = req.query;

    logger.info('Getting transaction statistics', {
      requestId: req.id,
      userAddress,
      days
    });

    // Generate mock statistics
    const stats = generateMockTransactionStats(userAddress, parseInt(days));

    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
      requestId: req.id
    });

    logger.info('Transaction statistics retrieved', {
      requestId: req.id,
      userAddress,
      totalTransactions: stats.summary.total
    });

  } catch (error) {
    logger.error('Failed to get transaction statistics', {
      requestId: req.id,
      error: error.message,
      userAddress: req.query.userAddress
    });

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve transaction statistics',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      requestId: req.id,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Generate mock transactions for demonstration
 */
const generateMockTransactions = (userAddress, filters = {}) => {
  const { status, type, limit = 20, offset = 0 } = filters;
  const transactions = [];
  
  const types = ['deposit', 'withdraw', 'compound'];
  const statuses = ['completed', 'pending', 'failed'];
  
  for (let i = 0; i < limit; i++) {
    const txType = type || types[Math.floor(Math.random() * types.length)];
    const txStatus = status || statuses[Math.floor(Math.random() * statuses.length)];
    const timestamp = new Date(Date.now() - (Math.random() * 30 * 24 * 60 * 60 * 1000));
    
    const transaction = {
      id: `tx_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 9)}`,
      txHash: '0x' + Array.from({length: 64}, () => Math.floor(Math.random() * 16).toString(16)).join(''),
      userAddress: userAddress || '0x742d35Cc4700C2532237A43F4C1b05a4c8FE1B5C',
      type: txType,
      status: txStatus,
      amount: (Math.random() * 1000 + 100).toFixed(4),
      token: txType === 'deposit' ? 'EURe' : 'LP-EURe',
      fromChain: txType === 'deposit' ? 'polygon' : 'gnosis',
      toChain: txType === 'deposit' ? 'gnosis' : 'polygon',
      slippage: (Math.random() * 2 + 0.1).toFixed(1),
      gasUsed: txStatus === 'completed' ? (Math.random() * 100000 + 50000).toFixed(0) : null,
      gasPrice: txStatus === 'completed' ? (Math.random() * 100 + 20).toFixed(2) : null,
      createdAt: timestamp.toISOString(),
      updatedAt: new Date(timestamp.getTime() + Math.random() * 300000).toISOString(),
      completedAt: txStatus === 'completed' ? new Date(timestamp.getTime() + Math.random() * 300000).toISOString() : null,
      error: txStatus === 'failed' ? 'Transaction reverted due to insufficient gas' : null
    };
    
    transactions.push(transaction);
  }
  
  return transactions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
};

/**
 * Generate a mock transaction by ID
 */
const generateMockTransaction = (id) => {
  const types = ['deposit', 'withdraw', 'compound'];
  const statuses = ['completed', 'pending', 'failed'];
  
  const txType = types[Math.floor(Math.random() * types.length)];
  const txStatus = statuses[Math.floor(Math.random() * statuses.length)];
  const timestamp = new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000);
  
  return {
    id,
    txHash: '0x' + Array.from({length: 64}, () => Math.floor(Math.random() * 16).toString(16)).join(''),
    userAddress: '0x742d35Cc4700C2532237A43F4C1b05a4c8FE1B5C',
    type: txType,
    status: txStatus,
    amount: (Math.random() * 1000 + 100).toFixed(4),
    token: txType === 'deposit' ? 'EURe' : 'LP-EURe',
    fromChain: txType === 'deposit' ? 'polygon' : 'gnosis',
    toChain: txType === 'deposit' ? 'gnosis' : 'polygon',
    slippage: (Math.random() * 2 + 0.1).toFixed(1),
    gasUsed: txStatus === 'completed' ? (Math.random() * 100000 + 50000).toFixed(0) : null,
    gasPrice: txStatus === 'completed' ? (Math.random() * 100 + 20).toFixed(2) : null,
    createdAt: timestamp.toISOString(),
    updatedAt: new Date(timestamp.getTime() + Math.random() * 300000).toISOString(),
    completedAt: txStatus === 'completed' ? new Date(timestamp.getTime() + Math.random() * 300000).toISOString() : null,
    error: txStatus === 'failed' ? 'Transaction reverted due to insufficient gas' : null
  };
};

/**
 * Generate mock transaction statistics
 */
const generateMockTransactionStats = (userAddress, days) => {
  const totalTransactions = Math.floor(Math.random() * 50) + 10;
  const completed = Math.floor(totalTransactions * 0.8);
  const pending = Math.floor(totalTransactions * 0.1);
  const failed = totalTransactions - completed - pending;
  
  return {
    userAddress,
    period: `${days} days`,
    summary: {
      total: totalTransactions,
      completed,
      pending,
      failed,
      successRate: ((completed / totalTransactions) * 100).toFixed(1)
    },
    byType: {
      deposit: Math.floor(totalTransactions * 0.4),
      withdraw: Math.floor(totalTransactions * 0.4),
      compound: Math.floor(totalTransactions * 0.2)
    },
    volumes: {
      totalVolume: (Math.random() * 50000 + 10000).toFixed(2),
      averageTransaction: (Math.random() * 1000 + 200).toFixed(2),
      currency: 'USD'
    },
    fees: {
      totalGasFees: (Math.random() * 100 + 20).toFixed(4),
      averageGasFee: (Math.random() * 5 + 1).toFixed(4),
      currency: 'MATIC'
    }
  };
};

module.exports = {
  getTransactions,
  getTransactionById,
  retryTransaction,
  cancelTransaction,
  getTransactionStats
};