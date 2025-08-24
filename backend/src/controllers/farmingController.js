const logger = require('../utils/logger');
const EnsoYieldFarming = require('../services/EnsoYieldFarming');
const monitoringService = require('../services/monitoringService');
const socketService = require('../services/socketService');
const { generateTxId } = require('../utils/helpers');

// Initialize Enso service with validation
let ensoService = null;

try {
  const apiKey = process.env.ENSO_API_KEY;
  const privateKey = process.env.PRIVATE_KEY;
  
  if (!apiKey || !privateKey) {
    logger.warn('⚠️  ENSO_API_KEY or PRIVATE_KEY not configured - farming operations will be disabled');
  } else {
    ensoService = new EnsoYieldFarming(apiKey, privateKey);
    logger.info('✅ EnsoYieldFarming service initialized for farming operations');
  }
} catch (error) {
  logger.error('❌ Failed to initialize EnsoYieldFarming service:', error.message);
}

/**
 * Deposit EURe for LP tokens
 */
const deposit = async (req, res) => {
  try {
    if (!ensoService) {
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'EnsoYieldFarming service not configured. Please check ENSO_API_KEY and PRIVATE_KEY environment variables.',
        requestId: req.id
      });
    }

    const { amount, slippage, userAddress } = req.body;

    logger.info('Processing deposit request', {
      requestId: req.id,
      amount,
      slippage,
      userAddress
    });

    // Validate amount is positive
    if (parseFloat(amount) <= 0) {
      return res.status(400).json({
        error: 'Invalid Amount',
        message: 'Amount must be greater than 0',
        requestId: req.id
      });
    }

    // Check user balance before deposit
    const balances = await ensoService.getPolygonBalance(userAddress);
    const eureBalance = parseFloat(balances.eure.balance);
    const depositAmount = parseFloat(amount);

    if (eureBalance < depositAmount) {
      return res.status(400).json({
        error: 'Insufficient Balance',
        message: `Insufficient EURe balance. Available: ${eureBalance}, Required: ${depositAmount}`,
        requestId: req.id
      });
    }

    // Process deposit with monitoring
    const result = await ensoService.depositWithMonitoring(amount, slippage, userAddress);

    // Start monitoring the transaction
    monitoringService.startTransactionMonitoring(
      result.txId,
      result.txHash,
      userAddress,
      'deposit',
      {
        amount,
        slippage,
        fromChain: 'polygon',
        toChain: 'gnosis',
        token: 'EURe'
      }
    );

    // Send immediate response
    res.status(202).json({
      success: true,
      message: 'Deposit initiated successfully',
      data: {
        txId: result.txId,
        txHash: result.txHash,
        amount,
        slippage,
        userAddress,
        status: 'initiated',
        estimatedCompletionTime: '2-5 minutes'
      },
      timestamp: new Date().toISOString(),
      requestId: req.id
    });

    logger.info('Deposit initiated successfully', {
      requestId: req.id,
      txId: result.txId,
      txHash: result.txHash,
      amount,
      userAddress
    });

    // Send WebSocket notification
    socketService.sendUserNotification(userAddress, {
      type: 'info',
      title: 'Deposit Initiated',
      message: `Deposit of ${amount} EURe has been initiated`,
      txId: result.txId,
      txHash: result.txHash
    });

  } catch (error) {
    logger.error('Deposit failed', {
      requestId: req.id,
      error: error.message,
      stack: error.stack,
      amount: req.body.amount,
      userAddress: req.body.userAddress
    });

    res.status(500).json({
      error: 'Deposit Failed',
      message: 'Failed to process deposit request',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      requestId: req.id,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Withdraw LP tokens for EURe
 */
const withdraw = async (req, res) => {
  try {
    const { amount, slippage, userAddress } = req.body;

    logger.info('Processing withdraw request', {
      requestId: req.id,
      amount,
      slippage,
      userAddress
    });

    // Validate amount is positive
    if (parseFloat(amount) <= 0) {
      return res.status(400).json({
        error: 'Invalid Amount',
        message: 'Amount must be greater than 0',
        requestId: req.id
      });
    }

    // Check user LP token balance before withdraw
    const balances = await ensoService.getGnosisBalance(userAddress);
    const lpBalance = parseFloat(balances.lpToken.balance);
    const withdrawAmount = parseFloat(amount);

    if (lpBalance < withdrawAmount) {
      return res.status(400).json({
        error: 'Insufficient Balance',
        message: `Insufficient LP token balance. Available: ${lpBalance}, Required: ${withdrawAmount}`,
        requestId: req.id
      });
    }

    // Process withdraw with monitoring
    const result = await ensoService.withdrawWithMonitoring(amount, slippage, userAddress);

    // Start monitoring the transaction
    monitoringService.startTransactionMonitoring(
      result.txId,
      result.txHash,
      userAddress,
      'withdraw',
      {
        amount,
        slippage,
        fromChain: 'gnosis',
        toChain: 'polygon',
        token: 'LP-EURe'
      }
    );

    // Send immediate response
    res.status(202).json({
      success: true,
      message: 'Withdrawal initiated successfully',
      data: {
        txId: result.txId,
        txHash: result.txHash,
        amount,
        slippage,
        userAddress,
        status: 'initiated',
        estimatedCompletionTime: '2-5 minutes'
      },
      timestamp: new Date().toISOString(),
      requestId: req.id
    });

    logger.info('Withdraw initiated successfully', {
      requestId: req.id,
      txId: result.txId,
      txHash: result.txHash,
      amount,
      userAddress
    });

    // Send WebSocket notification
    socketService.sendUserNotification(userAddress, {
      type: 'info',
      title: 'Withdrawal Initiated',
      message: `Withdrawal of ${amount} LP tokens has been initiated`,
      txId: result.txId,
      txHash: result.txHash
    });

  } catch (error) {
    logger.error('Withdraw failed', {
      requestId: req.id,
      error: error.message,
      stack: error.stack,
      amount: req.body.amount,
      userAddress: req.body.userAddress
    });

    res.status(500).json({
      error: 'Withdrawal Failed',
      message: 'Failed to process withdrawal request',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      requestId: req.id,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Auto-compound earnings
 */
const compound = async (req, res) => {
  try {
    const { userAddress, slippage = 0.5 } = req.body;

    logger.info('Processing compound request', {
      requestId: req.id,
      userAddress,
      slippage
    });

    // Get available earnings
    const earnings = await ensoService.getEarnings(userAddress);
    const earningsAmount = parseFloat(earnings);

    if (earningsAmount <= 0.01) {
      return res.status(400).json({
        error: 'No Earnings Available',
        message: `Insufficient earnings to compound. Available: ${earnings} (minimum: 0.01)`,
        data: {
          availableEarnings: earnings,
          minimumRequired: '0.01'
        },
        requestId: req.id
      });
    }

    // Process auto-compound
    const result = await ensoService.autoCompound(userAddress);

    if (result.message) {
      // No earnings to compound
      return res.json({
        success: true,
        message: result.message,
        data: {
          availableEarnings: result.earnings,
          userAddress
        },
        timestamp: new Date().toISOString(),
        requestId: req.id
      });
    }

    // Start monitoring the compound transaction
    monitoringService.startTransactionMonitoring(
      result.txId,
      result.txHash,
      userAddress,
      'compound',
      {
        amount: earnings,
        slippage,
        type: 'auto-compound',
        originalEarnings: earnings
      }
    );

    // Send immediate response
    res.status(202).json({
      success: true,
      message: 'Auto-compound initiated successfully',
      data: {
        txId: result.txId,
        txHash: result.txHash,
        compoundAmount: earnings,
        slippage,
        userAddress,
        status: 'initiated',
        estimatedCompletionTime: '2-5 minutes'
      },
      timestamp: new Date().toISOString(),
      requestId: req.id
    });

    logger.info('Compound initiated successfully', {
      requestId: req.id,
      txId: result.txId,
      txHash: result.txHash,
      compoundAmount: earnings,
      userAddress
    });

    // Send WebSocket notification
    socketService.sendUserNotification(userAddress, {
      type: 'info',
      title: 'Auto-Compound Initiated',
      message: `Auto-compound of ${earnings} earnings has been initiated`,
      txId: result.txId,
      txHash: result.txHash
    });

  } catch (error) {
    logger.error('Compound failed', {
      requestId: req.id,
      error: error.message,
      stack: error.stack,
      userAddress: req.body.userAddress
    });

    res.status(500).json({
      error: 'Auto-Compound Failed',
      message: 'Failed to process auto-compound request',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      requestId: req.id,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Estimate gas costs for operations
 */
const estimate = async (req, res) => {
  try {
    const { amount, type, userAddress } = req.body;

    logger.info('Processing gas estimation request', {
      requestId: req.id,
      amount,
      type,
      userAddress
    });

    // Validate operation type
    const validTypes = ['deposit', 'withdraw', 'compound'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        error: 'Invalid Operation Type',
        message: `Operation type must be one of: ${validTypes.join(', ')}`,
        requestId: req.id
      });
    }

    // Get gas estimation
    const estimation = await ensoService.estimateGas(type, amount);

    res.json({
      success: true,
      message: 'Gas estimation completed',
      data: estimation,
      timestamp: new Date().toISOString(),
      requestId: req.id
    });

    logger.info('Gas estimation completed', {
      requestId: req.id,
      type,
      amount,
      estimatedGas: estimation.estimatedGas,
      estimatedCost: estimation.estimatedCost
    });

  } catch (error) {
    logger.error('Gas estimation failed', {
      requestId: req.id,
      error: error.message,
      amount: req.body.amount,
      type: req.body.type
    });

    res.status(500).json({
      error: 'Gas Estimation Failed',
      message: 'Failed to estimate gas costs',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      requestId: req.id,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Get available earnings for user
 */
const getEarnings = async (req, res) => {
  try {
    const { userAddress } = req.query;

    if (!userAddress) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'userAddress query parameter is required',
        requestId: req.id
      });
    }

    logger.info('Getting earnings', {
      requestId: req.id,
      userAddress
    });

    const earnings = await ensoService.getEarnings(userAddress);

    res.json({
      success: true,
      data: {
        userAddress,
        availableEarnings: earnings,
        canCompound: parseFloat(earnings) > 0.01,
        minimumCompoundAmount: '0.01'
      },
      timestamp: new Date().toISOString(),
      requestId: req.id
    });

    logger.info('Earnings retrieved successfully', {
      requestId: req.id,
      userAddress,
      earnings
    });

  } catch (error) {
    logger.error('Failed to get earnings', {
      requestId: req.id,
      error: error.message,
      userAddress: req.query.userAddress
    });

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve earnings',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      requestId: req.id,
      timestamp: new Date().toISOString()
    });
  }
};

module.exports = {
  deposit,
  withdraw,
  compound,
  estimate,
  getEarnings
};