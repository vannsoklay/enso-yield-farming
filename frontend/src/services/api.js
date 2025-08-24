import { APP_CONFIG, API_ENDPOINTS, ERROR_MESSAGES } from '../utils/constants'

class ApiService {
  constructor() {
    this.baseURL = APP_CONFIG.apiUrl
    this.timeout = 30000 // 30 seconds
    this.retryAttempts = APP_CONFIG.maxRetries
    this.retryDelay = APP_CONFIG.retryDelay
  }

  /**
   * Make HTTP request with error handling and retries
   * @param {string} endpoint - API endpoint
   * @param {Object} options - Request options
   * @returns {Promise} Response data
   */
  async makeRequest(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`
    
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      timeout: this.timeout,
      ...options
    }

    let lastError
    
    for (let attempt = 0; attempt < this.retryAttempts; attempt++) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), this.timeout)
        
        const response = await fetch(url, {
          ...config,
          signal: controller.signal
        })
        
        clearTimeout(timeoutId)

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new ApiError(
            errorData.message || `HTTP ${response.status}: ${response.statusText}`,
            response.status,
            errorData
          )
        }

        const data = await response.json()
        return data
      } catch (error) {
        lastError = error
        
        // Don't retry for certain errors
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
          throw error
        }
        
        if (attempt < this.retryAttempts - 1) {
          await this.sleep(this.retryDelay * Math.pow(2, attempt))
        }
      }
    }
    
    throw lastError
  }

  /**
   * GET request
   * @param {string} endpoint - API endpoint
   * @param {Object} params - Query parameters
   * @returns {Promise} Response data
   */
  async get(endpoint, params = {}) {
    const queryString = new URLSearchParams(params).toString()
    const url = queryString ? `${endpoint}?${queryString}` : endpoint
    
    return this.makeRequest(url, {
      method: 'GET'
    })
  }

  /**
   * POST request
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request body data
   * @returns {Promise} Response data
   */
  async post(endpoint, data = {}) {
    return this.makeRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }

  /**
   * PUT request
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request body data
   * @returns {Promise} Response data
   */
  async put(endpoint, data = {}) {
    return this.makeRequest(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data)
    })
  }

  /**
   * DELETE request
   * @param {string} endpoint - API endpoint
   * @returns {Promise} Response data
   */
  async delete(endpoint) {
    return this.makeRequest(endpoint, {
      method: 'DELETE'
    })
  }

  // Health and Status
  async getHealth() {
    return this.get(API_ENDPOINTS.HEALTH)
  }

  async getStatus() {
    return this.get(API_ENDPOINTS.STATUS)
  }

  // Balance Operations
  async getBalances(userAddress, chain = 'all') {
    return this.get(API_ENDPOINTS.BALANCES, { userAddress, chain })
  }

  async getBalancesByChain(chain, userAddress) {
    return this.get(`${API_ENDPOINTS.BALANCES}/${chain}`, { userAddress })
  }

  async refreshBalances(userAddress) {
    return this.post(API_ENDPOINTS.BALANCES_REFRESH, { userAddress })
  }

  async getBalanceHistory(userAddress, days = 7) {
    return this.get(API_ENDPOINTS.BALANCES_HISTORY, { userAddress, days })
  }

  // Farming Operations
  async deposit(amount, userAddress, slippage = 0.5) {
    return this.post(API_ENDPOINTS.DEPOSIT, {
      amount,
      userAddress,
      slippage
    })
  }

  async withdraw(amount, userAddress, slippage = 0.5) {
    return this.post(API_ENDPOINTS.WITHDRAW, {
      amount,
      userAddress,
      slippage
    })
  }

  async compound(userAddress, slippage = 0.5) {
    return this.post(API_ENDPOINTS.COMPOUND, {
      userAddress,
      slippage
    })
  }

  async estimateGas(type, amount, userAddress) {
    return this.post(API_ENDPOINTS.ESTIMATE, {
      type,
      amount,
      userAddress
    })
  }

  async getEarnings(userAddress) {
    return this.get(API_ENDPOINTS.EARNINGS, { userAddress })
  }

  // Transaction Operations
  async getTransactions(filters = {}) {
    return this.get(API_ENDPOINTS.TRANSACTIONS, filters)
  }

  async getTransactionById(id) {
    return this.get(`${API_ENDPOINTS.TRANSACTIONS}/${id}`)
  }

  async retryTransaction(transactionId) {
    return this.post(API_ENDPOINTS.TRANSACTIONS_RETRY, { transactionId })
  }

  async cancelTransaction(transactionId) {
    return this.post(API_ENDPOINTS.TRANSACTIONS_CANCEL, { transactionId })
  }

  async getTransactionStats(userAddress, days = 30) {
    return this.get(API_ENDPOINTS.TRANSACTIONS_STATS, { userAddress, days })
  }

  // Monitoring Operations
  async getMonitoringStats() {
    return this.get(API_ENDPOINTS.MONITORING_STATS)
  }

  async getWebSocketStats() {
    return this.get(API_ENDPOINTS.WEBSOCKET_STATS)
  }

  /**
   * Utility function to sleep/delay
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise} Promise that resolves after delay
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

/**
 * Custom API Error class
 */
class ApiError extends Error {
  constructor(message, status, data = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}

/**
 * Create singleton instance
 */
const apiService = new ApiService()

/**
 * Higher-order function to handle API errors consistently
 * @param {Function} apiCall - API function to wrap
 * @returns {Function} Wrapped function with error handling
 */
export const withErrorHandling = (apiCall) => {
  return async (...args) => {
    try {
      return await apiCall(...args)
    } catch (error) {
      console.error('API Error:', error)
      
      // Transform API errors into user-friendly messages
      if (error instanceof ApiError) {
        switch (error.status) {
          case 400:
            throw new Error(error.data.message || ERROR_MESSAGES.VALIDATION_ERROR)
          case 404:
            throw new Error('Resource not found')
          case 429:
            throw new Error('Too many requests. Please wait and try again.')
          case 500:
            throw new Error(ERROR_MESSAGES.API_ERROR)
          default:
            throw new Error(error.message || ERROR_MESSAGES.UNKNOWN_ERROR)
        }
      }
      
      // Handle network errors
      if (error.name === 'TypeError' || error.message.includes('fetch')) {
        throw new Error(ERROR_MESSAGES.NETWORK_ERROR)
      }
      
      // Handle timeout errors
      if (error.name === 'AbortError') {
        throw new Error('Request timeout. Please try again.')
      }
      
      throw new Error(error.message || ERROR_MESSAGES.UNKNOWN_ERROR)
    }
  }
}

/**
 * Wrapped API methods with error handling
 */
export const api = {
  // Health and Status
  getHealth: withErrorHandling(apiService.getHealth.bind(apiService)),
  getStatus: withErrorHandling(apiService.getStatus.bind(apiService)),
  
  // Balance Operations
  getBalances: withErrorHandling(apiService.getBalances.bind(apiService)),
  getBalancesByChain: withErrorHandling(apiService.getBalancesByChain.bind(apiService)),
  refreshBalances: withErrorHandling(apiService.refreshBalances.bind(apiService)),
  getBalanceHistory: withErrorHandling(apiService.getBalanceHistory.bind(apiService)),
  
  // Farming Operations
  deposit: withErrorHandling(apiService.deposit.bind(apiService)),
  withdraw: withErrorHandling(apiService.withdraw.bind(apiService)),
  compound: withErrorHandling(apiService.compound.bind(apiService)),
  estimateGas: withErrorHandling(apiService.estimateGas.bind(apiService)),
  getEarnings: withErrorHandling(apiService.getEarnings.bind(apiService)),
  
  // Transaction Operations
  getTransactions: withErrorHandling(apiService.getTransactions.bind(apiService)),
  getTransactionById: withErrorHandling(apiService.getTransactionById.bind(apiService)),
  retryTransaction: withErrorHandling(apiService.retryTransaction.bind(apiService)),
  cancelTransaction: withErrorHandling(apiService.cancelTransaction.bind(apiService)),
  getTransactionStats: withErrorHandling(apiService.getTransactionStats.bind(apiService)),
  
  // Monitoring Operations
  getMonitoringStats: withErrorHandling(apiService.getMonitoringStats.bind(apiService)),
  getWebSocketStats: withErrorHandling(apiService.getWebSocketStats.bind(apiService))
}

export { ApiError }
export default apiService