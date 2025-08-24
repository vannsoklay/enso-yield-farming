const logger = require('../utils/logger');
const EnsoYieldFarming = require('../services/EnsoYieldFarming');
const socketService = require('../services/socketService');

// Initialize Enso service with validation
let ensoService = null;

try {
  const apiKey = process.env.ENSO_API_KEY;
  const privateKey = process.env.PRIVATE_KEY;
  
  if (!apiKey || !privateKey) {
    logger.warn('⚠️  ENSO_API_KEY or PRIVATE_KEY not configured - some features will be disabled');
  } else {
    ensoService = new EnsoYieldFarming(apiKey, privateKey);
    logger.info('✅ EnsoYieldFarming service initialized');
  }
} catch (error) {
  logger.error('❌ Failed to initialize EnsoYieldFarming service:', error.message);
}

/**
 * Get balances for all chains or specific chain
 */
const getBalances = async (req, res) => {
  try {
    if (!ensoService) {
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'EnsoYieldFarming service not configured. Please check ENSO_API_KEY and PRIVATE_KEY environment variables.',
        requestId: req.id
      });
    }

    const { userAddress, chain } = req.query;
    
    logger.info('Getting balances', {
      requestId: req.id,
      userAddress,
      chain
    });

    let balances;
    
    if (chain && chain !== 'all') {
      // Get balances for specific chain
      if (chain === 'polygon') {
        const polygonBalance = await ensoService.getPolygonBalance(userAddress);
        balances = { polygon: polygonBalance };
      } else if (chain === 'gnosis') {
        const gnosisBalance = await ensoService.getGnosisBalance(userAddress);
        balances = { gnosis: gnosisBalance };
      } else {
        return res.status(400).json({
          error: 'Invalid Chain',
          message: 'Chain must be "polygon", "gnosis", or "all"',
          requestId: req.id
        });
      }
    } else {
      // Get balances for all chains
      balances = await ensoService.getBalances(userAddress);
    }

    // Broadcast balance update via WebSocket
    if (userAddress) {
      socketService.broadcastBalanceUpdate(userAddress, balances);
    }

    res.json({
      success: true,
      data: balances,
      timestamp: new Date().toISOString(),
      requestId: req.id
    });

    logger.info('Balances retrieved successfully', {
      requestId: req.id,
      userAddress,
      chain
    });

  } catch (error) {
    logger.error('Failed to get balances', {
      requestId: req.id,
      error: error.message,
      userAddress: req.query.userAddress
    });

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve balances',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      requestId: req.id,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Get balances for specific chain
 */
const getBalancesByChain = async (req, res) => {
  try {
    const { chain } = req.params;
    const { userAddress } = req.query;

    if (!userAddress) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'userAddress query parameter is required',
        requestId: req.id
      });
    }

    logger.info('Getting balances by chain', {
      requestId: req.id,
      userAddress,
      chain
    });

    let balances;

    switch (chain.toLowerCase()) {
      case 'polygon':
        balances = await ensoService.getPolygonBalance(userAddress);
        break;
      case 'gnosis':
        balances = await ensoService.getGnosisBalance(userAddress);
        break;
      default:
        return res.status(400).json({
          error: 'Invalid Chain',
          message: 'Supported chains: polygon, gnosis',
          requestId: req.id
        });
    }

    // Broadcast balance update via WebSocket
    socketService.broadcastBalanceUpdate(userAddress, { [chain.toLowerCase()]: balances });

    res.json({
      success: true,
      data: {
        chain: chain.toLowerCase(),
        balances
      },
      timestamp: new Date().toISOString(),
      requestId: req.id
    });

    logger.info('Chain-specific balances retrieved successfully', {
      requestId: req.id,
      userAddress,
      chain
    });

  } catch (error) {
    logger.error('Failed to get chain-specific balances', {
      requestId: req.id,
      error: error.message,
      chain: req.params.chain,
      userAddress: req.query.userAddress
    });

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve chain-specific balances',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      requestId: req.id,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Refresh balances and broadcast update
 */
const refreshBalances = async (req, res) => {
  try {
    const { userAddress } = req.body;

    logger.info('Refreshing balances', {
      requestId: req.id,
      userAddress
    });

    // Clear cache for this user
    ensoService.clearCache();

    // Get fresh balances
    const balances = await ensoService.getBalances(userAddress);

    // Broadcast balance update via WebSocket
    socketService.broadcastBalanceUpdate(userAddress, balances);

    res.json({
      success: true,
      message: 'Balances refreshed successfully',
      data: balances,
      timestamp: new Date().toISOString(),
      requestId: req.id
    });

    logger.info('Balances refreshed successfully', {
      requestId: req.id,
      userAddress
    });

  } catch (error) {
    logger.error('Failed to refresh balances', {
      requestId: req.id,
      error: error.message,
      userAddress: req.body.userAddress
    });

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to refresh balances',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      requestId: req.id,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Get balance history for analytics
 */
const getBalanceHistory = async (req, res) => {
  try {
    const { userAddress } = req.query;
    const { days = 7 } = req.query;

    logger.info('Getting balance history', {
      requestId: req.id,
      userAddress,
      days
    });

    // In a real implementation, this would query historical data
    // For now, we'll return mock historical data
    const history = generateMockBalanceHistory(parseInt(days));

    res.json({
      success: true,
      data: {
        userAddress,
        days: parseInt(days),
        history
      },
      timestamp: new Date().toISOString(),
      requestId: req.id
    });

    logger.info('Balance history retrieved successfully', {
      requestId: req.id,
      userAddress,
      historyPoints: history.length
    });

  } catch (error) {
    logger.error('Failed to get balance history', {
      requestId: req.id,
      error: error.message,
      userAddress: req.query.userAddress
    });

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve balance history',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      requestId: req.id,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Generate mock balance history for demonstration
 * @param {number} days - Number of days of history
 * @returns {Array} Mock balance history
 */
const generateMockBalanceHistory = (days) => {
  const history = [];
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  for (let i = days; i >= 0; i--) {
    const timestamp = new Date(now - (i * dayMs));
    const baseEure = 1000 + Math.random() * 500;
    const baseLp = 500 + Math.random() * 300;

    history.push({
      timestamp: timestamp.toISOString(),
      polygon: {
        eure: {
          balance: baseEure.toFixed(4),
          usdValue: (baseEure * 1.08).toFixed(2) // Mock EUR to USD rate
        },
        matic: {
          balance: (10 + Math.random() * 5).toFixed(4),
          usdValue: ((10 + Math.random() * 5) * 0.85).toFixed(2)
        }
      },
      gnosis: {
        lpToken: {
          balance: baseLp.toFixed(4),
          usdValue: (baseLp * 1.12).toFixed(2) // Mock LP token value
        },
        xdai: {
          balance: (5 + Math.random() * 2).toFixed(4),
          usdValue: (5 + Math.random() * 2).toFixed(2)
        }
      }
    });
  }

  return history;
};

module.exports = {
  getBalances,
  getBalancesByChain,
  refreshBalances,
  getBalanceHistory
};