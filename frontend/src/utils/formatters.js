import { VALIDATION_RULES } from './constants'

/**
 * Format amount for display with proper decimals
 * @param {string|number} amount - Amount to format
 * @param {number} decimals - Number of decimal places
 * @param {boolean} compact - Use compact notation for large numbers
 * @returns {string} Formatted amount
 */
export const formatAmount = (amount, decimals = 4, compact = false) => {
  if (amount === null || amount === undefined || amount === '') {
    return '0.0000'
  }

  const num = parseFloat(amount)
  
  if (isNaN(num)) {
    return '0.0000'
  }

  if (compact && num >= 1000000) {
    return (num / 1000000).toFixed(2) + 'M'
  } else if (compact && num >= 1000) {
    return (num / 1000).toFixed(2) + 'K'
  }

  return num.toFixed(decimals)
}

/**
 * Format currency with symbol
 * @param {string|number} amount - Amount to format
 * @param {string} symbol - Currency symbol
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted currency
 */
export const formatCurrency = (amount, symbol = '', decimals = 4) => {
  const formatted = formatAmount(amount, decimals)
  return symbol ? `${formatted} ${symbol}` : formatted
}

/**
 * Format USD value
 * @param {string|number} amount - Amount in USD
 * @param {boolean} compact - Use compact notation
 * @returns {string} Formatted USD value
 */
export const formatUSD = (amount, compact = false) => {
  const num = parseFloat(amount)
  
  if (isNaN(num)) {
    return '$0.00'
  }

  if (compact && num >= 1000000) {
    return `$${(num / 1000000).toFixed(2)}M`
  } else if (compact && num >= 1000) {
    return `$${(num / 1000).toFixed(2)}K`
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num)
}

/**
 * Format percentage
 * @param {string|number} value - Percentage value
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted percentage
 */
export const formatPercentage = (value, decimals = 2) => {
  const num = parseFloat(value)
  
  if (isNaN(num)) {
    return '0.00%'
  }

  return `${num.toFixed(decimals)}%`
}

/**
 * Format time duration
 * @param {number} milliseconds - Duration in milliseconds
 * @returns {string} Formatted duration
 */
export const formatDuration = (milliseconds) => {
  const seconds = Math.floor(milliseconds / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) {
    return `${days}d ${hours % 24}h`
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m`
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`
  } else {
    return `${seconds}s`
  }
}

/**
 * Format relative time (time ago)
 * @param {string|Date} date - Date to format
 * @returns {string} Relative time string
 */
export const formatTimeAgo = (date) => {
  const now = new Date()
  const target = new Date(date)
  const diff = now.getTime() - target.getTime()

  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) {
    return `${days} day${days === 1 ? '' : 's'} ago`
  } else if (hours > 0) {
    return `${hours} hour${hours === 1 ? '' : 's'} ago`
  } else if (minutes > 0) {
    return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  } else {
    return 'Just now'
  }
}

/**
 * Format date for display
 * @param {string|Date} date - Date to format
 * @param {string} format - Format type ('short', 'long', 'time')
 * @returns {string} Formatted date
 */
export const formatDate = (date, format = 'short') => {
  const target = new Date(date)
  
  if (isNaN(target.getTime())) {
    return 'Invalid date'
  }

  const options = {
    short: {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    },
    long: {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    },
    time: {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }
  }

  return target.toLocaleDateString('en-US', options[format] || options.short)
}

/**
 * Truncate text with ellipsis
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text
 */
export const truncateText = (text, maxLength = 50) => {
  if (!text || text.length <= maxLength) {
    return text || ''
  }
  
  return text.slice(0, maxLength) + '...'
}

/**
 * Truncate Ethereum address for display
 * @param {string} address - Ethereum address
 * @param {number} startLength - Length of start portion
 * @param {number} endLength - Length of end portion
 * @returns {string} Truncated address
 */
export const truncateAddress = (address, startLength = 6, endLength = 4) => {
  if (!address || !isValidAddress(address)) {
    return 'Invalid address'
  }

  if (address.length <= startLength + endLength) {
    return address
  }

  return `${address.slice(0, startLength)}...${address.slice(-endLength)}`
}

/**
 * Validate Ethereum address
 * @param {string} address - Address to validate
 * @returns {boolean} Is valid address
 */
export const isValidAddress = (address) => {
  return VALIDATION_RULES.ADDRESS.REGEX.test(address)
}

/**
 * Validate amount input
 * @param {string} amount - Amount to validate
 * @returns {Object} Validation result
 */
export const validateAmount = (amount) => {
  if (!amount || amount === '') {
    return { isValid: false, error: 'Amount is required' }
  }

  if (!VALIDATION_RULES.AMOUNT.REGEX.test(amount)) {
    return { isValid: false, error: 'Invalid amount format' }
  }

  const num = parseFloat(amount)

  if (num < VALIDATION_RULES.AMOUNT.MIN) {
    return { isValid: false, error: `Minimum amount is ${VALIDATION_RULES.AMOUNT.MIN}` }
  }

  if (num > VALIDATION_RULES.AMOUNT.MAX) {
    return { isValid: false, error: `Maximum amount is ${VALIDATION_RULES.AMOUNT.MAX}` }
  }

  return { isValid: true, value: num }
}

/**
 * Validate slippage input
 * @param {number} slippage - Slippage to validate
 * @returns {Object} Validation result
 */
export const validateSlippage = (slippage) => {
  if (slippage === null || slippage === undefined) {
    return { isValid: false, error: 'Slippage is required' }
  }

  const num = parseFloat(slippage)

  if (isNaN(num)) {
    return { isValid: false, error: 'Invalid slippage value' }
  }

  if (num < VALIDATION_RULES.SLIPPAGE.MIN) {
    return { isValid: false, error: `Minimum slippage is ${VALIDATION_RULES.SLIPPAGE.MIN}%` }
  }

  if (num > VALIDATION_RULES.SLIPPAGE.MAX) {
    return { isValid: false, error: `Maximum slippage is ${VALIDATION_RULES.SLIPPAGE.MAX}%` }
  }

  return { isValid: true, value: num }
}

/**
 * Calculate percentage change
 * @param {number} oldValue - Previous value
 * @param {number} newValue - Current value
 * @returns {number} Percentage change
 */
export const calculatePercentageChange = (oldValue, newValue) => {
  if (oldValue === 0) {
    return newValue > 0 ? 100 : 0
  }
  
  return ((newValue - oldValue) / oldValue) * 100
}

/**
 * Generate color based on percentage change
 * @param {number} percentage - Percentage change
 * @returns {string} Color class name
 */
export const getChangeColor = (percentage) => {
  if (percentage > 0) {
    return 'text-success'
  } else if (percentage < 0) {
    return 'text-error'
  }
  return 'text-secondary'
}

/**
 * Get status color class
 * @param {string} status - Status value
 * @returns {string} Color class name
 */
export const getStatusColor = (status) => {
  const colors = {
    completed: 'text-success',
    pending: 'text-warning',
    failed: 'text-error',
    cancelled: 'text-muted',
    timeout: 'text-warning'
  }
  
  return colors[status] || 'text-secondary'
}

/**
 * Capitalize first letter of string
 * @param {string} str - String to capitalize
 * @returns {string} Capitalized string
 */
export const capitalize = (str) => {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1)
}

/**
 * Deep clone an object
 * @param {any} obj - Object to clone
 * @returns {any} Cloned object
 */
export const deepClone = (obj) => {
  if (obj === null || typeof obj !== 'object') {
    return obj
  }
  
  if (obj instanceof Date) {
    return new Date(obj.getTime())
  }
  
  if (obj instanceof Array) {
    return obj.map(item => deepClone(item))
  }
  
  const cloned = {}
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      cloned[key] = deepClone(obj[key])
    }
  }
  
  return cloned
}

/**
 * Debounce function calls
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export const debounce = (func, wait) => {
  let timeout
  
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout)
      func(...args)
    }
    
    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

/**
 * Throttle function calls
 * @param {Function} func - Function to throttle
 * @param {number} limit - Limit in milliseconds
 * @returns {Function} Throttled function
 */
export const throttle = (func, limit) => {
  let inThrottle
  
  return function executedFunction(...args) {
    if (!inThrottle) {
      func.apply(this, args)
      inThrottle = true
      setTimeout(() => inThrottle = false, limit)
    }
  }
}

/**
 * Sleep/delay function
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise} Promise that resolves after delay
 */
export const sleep = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Generate random ID
 * @param {number} length - Length of ID
 * @returns {string} Random ID
 */
export const generateId = (length = 8) => {
  return Math.random().toString(36).substr(2, length)
}

/**
 * Check if value is empty
 * @param {any} value - Value to check
 * @returns {boolean} Is empty
 */
export const isEmpty = (value) => {
  if (value === null || value === undefined) return true
  if (typeof value === 'string') return value.trim() === ''
  if (Array.isArray(value)) return value.length === 0
  if (typeof value === 'object') return Object.keys(value).length === 0
  return false
}

export default {
  formatAmount,
  formatCurrency,
  formatUSD,
  formatPercentage,
  formatDuration,
  formatTimeAgo,
  formatDate,
  truncateText,
  truncateAddress,
  isValidAddress,
  validateAmount,
  validateSlippage,
  calculatePercentageChange,
  getChangeColor,
  getStatusColor,
  capitalize,
  deepClone,
  debounce,
  throttle,
  sleep,
  generateId,
  isEmpty
}