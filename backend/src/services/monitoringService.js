const logger = require('../utils/logger');
const socketService = require('./socketService');

class MonitoringService {
  constructor() {
    this.activeMonitors = new Map();
    this.monitoringInterval = 30000; // 30 seconds
    this.maxRetries = 5;
  }

  /**
   * Start monitoring a transaction
   * @param {string} txId - Internal transaction ID
   * @param {string} txHash - Blockchain transaction hash
   * @param {string} userId - User ID
   * @param {string} type - Transaction type (deposit, withdraw, compound)
   * @param {Object} details - Transaction details
   */
  startTransactionMonitoring(txId, txHash, userId, type, details = {}) {
    if (this.activeMonitors.has(txId)) {
      logger.warn('Transaction already being monitored', { txId });
      return;
    }

    const monitor = {
      txId,
      txHash,
      userId,
      type,
      details,
      startTime: Date.now(),
      retryCount: 0,
      status: 'monitoring',
      lastCheck: null
    };

    this.activeMonitors.set(txId, monitor);

    logger.info('Started transaction monitoring', {
      txId,
      txHash,
      userId,
      type
    });

    // Start the monitoring loop
    this.monitorTransaction(txId);

    // Send initial update to user
    socketService.broadcastTransactionUpdate(userId, {
      txId,
      txHash,
      type,
      status: 'monitoring',
      message: 'Transaction monitoring started',
      details
    });
  }

  /**
   * Monitor a specific transaction
   * @param {string} txId - Transaction ID to monitor
   */
  async monitorTransaction(txId) {
    const monitor = this.activeMonitors.get(txId);
    if (!monitor) {
      return;
    }

    try {
      monitor.lastCheck = new Date().toISOString();
      
      // Simulate checking transaction status
      const result = await this.checkTransactionStatus(monitor.txHash, monitor.type);
      
      if (result.completed) {
        // Transaction completed
        await this.handleTransactionCompleted(txId, result);
      } else if (result.failed) {
        // Transaction failed
        await this.handleTransactionFailed(txId, result);
      } else {
        // Still pending, schedule next check
        monitor.retryCount++;
        
        if (monitor.retryCount >= this.maxRetries) {
          await this.handleTransactionTimeout(txId);
        } else {
          // Schedule next check
          setTimeout(() => this.monitorTransaction(txId), this.monitoringInterval);
          
          // Send progress update
          socketService.broadcastTransactionUpdate(monitor.userId, {
            txId: monitor.txId,
            txHash: monitor.txHash,
            type: monitor.type,
            status: 'pending',
            message: `Transaction pending (check ${monitor.retryCount}/${this.maxRetries})`,
            retryCount: monitor.retryCount,
            details: monitor.details
          });
        }
      }
    } catch (error) {
      logger.error('Transaction monitoring error', {
        txId,
        error: error.message
      });

      monitor.retryCount++;
      
      if (monitor.retryCount >= this.maxRetries) {
        await this.handleTransactionTimeout(txId);
      } else {
        // Retry after delay
        setTimeout(() => this.monitorTransaction(txId), this.monitoringInterval);
      }
    }
  }

  /**
   * Check transaction status (simulated)
   * @param {string} txHash - Transaction hash
   * @param {string} type - Transaction type
   * @returns {Object} Transaction status result
   */
  async checkTransactionStatus(txHash, type) {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Simulate different outcomes based on transaction type and randomness
    const random = Math.random();
    
    if (random < 0.7) {
      // 70% chance of completion
      return {
        completed: true,
        confirmations: 12,
        gasUsed: this.getEstimatedGasUsed(type),
        blockNumber: Math.floor(Math.random() * 1000000) + 40000000,
        timestamp: new Date().toISOString()
      };
    } else if (random < 0.8) {
      // 10% chance of failure
      return {
        failed: true,
        error: 'Transaction reverted due to insufficient gas',
        gasUsed: '21000'
      };
    } else {
      // 20% chance still pending
      return {
        pending: true,
        confirmations: Math.floor(Math.random() * 5)
      };
    }
  }

  /**
   * Handle completed transaction
   * @param {string} txId - Transaction ID
   * @param {Object} result - Transaction result
   */
  async handleTransactionCompleted(txId, result) {
    const monitor = this.activeMonitors.get(txId);
    if (!monitor) return;

    const duration = Date.now() - monitor.startTime;

    logger.info('Transaction completed', {
      txId: monitor.txId,
      txHash: monitor.txHash,
      duration,
      gasUsed: result.gasUsed,
      confirmations: result.confirmations
    });

    // Send completion notification to user
    socketService.broadcastTransactionUpdate(monitor.userId, {
      txId: monitor.txId,
      txHash: monitor.txHash,
      type: monitor.type,
      status: 'completed',
      message: 'Transaction completed successfully',
      result,
      duration,
      details: monitor.details
    });

    // Send success notification
    socketService.sendUserNotification(monitor.userId, {
      type: 'success',
      title: 'Transaction Successful',
      message: `Your ${monitor.type} transaction has been completed successfully`,
      txId: monitor.txId,
      txHash: monitor.txHash
    });

    // Clean up monitor
    this.activeMonitors.delete(txId);

    // Trigger balance update
    this.triggerBalanceUpdate(monitor.userId);
  }

  /**
   * Handle failed transaction
   * @param {string} txId - Transaction ID
   * @param {Object} result - Failure result
   */
  async handleTransactionFailed(txId, result) {
    const monitor = this.activeMonitors.get(txId);
    if (!monitor) return;

    const duration = Date.now() - monitor.startTime;

    logger.error('Transaction failed', {
      txId: monitor.txId,
      txHash: monitor.txHash,
      duration,
      error: result.error
    });

    // Send failure notification to user
    socketService.broadcastTransactionUpdate(monitor.userId, {
      txId: monitor.txId,
      txHash: monitor.txHash,
      type: monitor.type,
      status: 'failed',
      message: 'Transaction failed',
      error: result.error,
      duration,
      details: monitor.details
    });

    // Send error notification
    socketService.sendUserNotification(monitor.userId, {
      type: 'error',
      title: 'Transaction Failed',
      message: `Your ${monitor.type} transaction failed: ${result.error}`,
      txId: monitor.txId,
      txHash: monitor.txHash
    });

    // Clean up monitor
    this.activeMonitors.delete(txId);
  }

  /**
   * Handle transaction timeout
   * @param {string} txId - Transaction ID
   */
  async handleTransactionTimeout(txId) {
    const monitor = this.activeMonitors.get(txId);
    if (!monitor) return;

    const duration = Date.now() - monitor.startTime;

    logger.warn('Transaction monitoring timeout', {
      txId: monitor.txId,
      txHash: monitor.txHash,
      duration,
      retryCount: monitor.retryCount
    });

    // Send timeout notification to user
    socketService.broadcastTransactionUpdate(monitor.userId, {
      txId: monitor.txId,
      txHash: monitor.txHash,
      type: monitor.type,
      status: 'timeout',
      message: 'Transaction monitoring timed out - check manually',
      duration,
      retryCount: monitor.retryCount,
      details: monitor.details
    });

    // Send warning notification
    socketService.sendUserNotification(monitor.userId, {
      type: 'warning',
      title: 'Transaction Status Unknown',
      message: `Unable to confirm ${monitor.type} transaction status. Please check manually.`,
      txId: monitor.txId,
      txHash: monitor.txHash
    });

    // Clean up monitor
    this.activeMonitors.delete(txId);
  }

  /**
   * Get estimated gas used for transaction type
   * @param {string} type - Transaction type
   * @returns {string} Estimated gas used
   */
  getEstimatedGasUsed(type) {
    const gasEstimates = {
      deposit: '150000',
      withdraw: '120000',
      compound: '200000'
    };
    
    return gasEstimates[type] || '100000';
  }

  /**
   * Trigger balance update for user
   * @param {string} userId - User ID
   */
  async triggerBalanceUpdate(userId) {
    try {
      // This would typically call the EnsoYieldFarming service
      // For now, we'll just send a notification to refresh balances
      socketService.sendUserNotification(userId, {
        type: 'info',
        title: 'Balance Update',
        message: 'Your balances have been updated',
        action: 'refresh_balances'
      });

      logger.info('Balance update triggered', { userId });
    } catch (error) {
      logger.error('Failed to trigger balance update', {
        userId,
        error: error.message
      });
    }
  }

  /**
   * Get monitoring statistics
   * @returns {Object} Monitoring statistics
   */
  getMonitoringStats() {
    const activeCount = this.activeMonitors.size;
    const monitors = Array.from(this.activeMonitors.values());
    
    const typeStats = {};
    const statusStats = {};
    
    monitors.forEach(monitor => {
      typeStats[monitor.type] = (typeStats[monitor.type] || 0) + 1;
      statusStats[monitor.status] = (statusStats[monitor.status] || 0) + 1;
    });

    return {
      activeCount,
      typeStats,
      statusStats,
      averageMonitoringTime: monitors.length > 0 
        ? monitors.reduce((sum, m) => sum + (Date.now() - m.startTime), 0) / monitors.length 
        : 0,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Stop monitoring a specific transaction
   * @param {string} txId - Transaction ID
   */
  stopMonitoring(txId) {
    if (this.activeMonitors.has(txId)) {
      this.activeMonitors.delete(txId);
      logger.info('Stopped monitoring transaction', { txId });
      return true;
    }
    return false;
  }

  /**
   * Stop all monitoring
   */
  stopAllMonitoring() {
    const count = this.activeMonitors.size;
    this.activeMonitors.clear();
    logger.info('Stopped all transaction monitoring', { count });
    return count;
  }
}

// Create singleton instance
const monitoringService = new MonitoringService();

module.exports = monitoringService;