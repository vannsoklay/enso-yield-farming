const { ethers } = require('ethers');

/**
 * Format wei amount to human readable format
 * @param {string|BigNumber} amount - Amount in wei
 * @param {number} decimals - Token decimals (default: 18)
 * @param {number} precision - Decimal precision for display (default: 4)
 * @returns {string} Formatted amount
 */
const formatAmount = (amount, decimals = 18, precision = 4) => {
  try {
    const formatted = ethers.formatUnits(amount, decimals);
    return parseFloat(formatted).toFixed(precision);
  } catch (error) {
    return '0.0000';
  }
};

/**
 * Parse human readable amount to wei
 * @param {string} amount - Human readable amount
 * @param {number} decimals - Token decimals (default: 18)
 * @returns {BigNumber} Amount in wei
 */
const parseAmount = (amount, decimals = 18) => {
  try {
    return ethers.parseUnits(amount.toString(), decimals);
  } catch (error) {
    throw new Error(`Invalid amount: ${amount}`);
  }
};

/**
 * Validate Ethereum address
 * @param {string} address - Address to validate
 * @returns {boolean} Is valid address
 */
const isValidAddress = (address) => {
  try {
    return ethers.isAddress(address);
  } catch (error) {
    return false;
  }
};

/**
 * Validate private key format
 * @param {string} privateKey - Private key to validate
 * @returns {boolean} Is valid private key
 */
const isValidPrivateKey = (privateKey) => {
  try {
    new ethers.Wallet(privateKey);
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Calculate percentage change
 * @param {number} oldValue - Previous value
 * @param {number} newValue - Current value
 * @returns {number} Percentage change
 */
const calculatePercentageChange = (oldValue, newValue) => {
  if (oldValue === 0) return newValue > 0 ? 100 : 0;
  return ((newValue - oldValue) / oldValue) * 100;
};

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise} Promise that resolves after delay
 */
const sleep = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Retry function with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} baseDelay - Base delay in milliseconds
 * @returns {Promise} Result of function or throws error
 */
const retryWithBackoff = async (fn, maxRetries = 3, baseDelay = 1000) => {
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      const delay = baseDelay * Math.pow(2, attempt);
      await sleep(delay);
    }
  }
  
  throw lastError;
};

/**
 * Generate unique transaction ID
 * @returns {string} Unique transaction ID
 */
const generateTxId = () => {
  return `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Sanitize user input
 * @param {string} input - User input to sanitize
 * @returns {string} Sanitized input
 */
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return '';
  return input.trim().replace(/[<>\"'&]/g, '');
};

/**
 * Check if chain ID is supported
 * @param {number} chainId - Chain ID to check
 * @returns {boolean} Is supported chain
 */
const isSupportedChain = (chainId) => {
  const supportedChains = [137, 100]; // Polygon, Gnosis
  return supportedChains.includes(chainId);
};

module.exports = {
  formatAmount,
  parseAmount,
  isValidAddress,
  isValidPrivateKey,
  calculatePercentageChange,
  sleep,
  retryWithBackoff,
  generateTxId,
  sanitizeInput,
  isSupportedChain
};