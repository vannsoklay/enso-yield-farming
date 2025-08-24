import { io } from 'socket.io-client'
import { APP_CONFIG, SOCKET_EVENTS } from '../utils/constants'

class SocketService {
  constructor() {
    this.socket = null
    this.connected = false
    this.reconnectAttempts = 0
    this.maxReconnectAttempts = 5
    this.reconnectDelay = 1000
    this.listeners = new Map()
    this.subscriptions = new Set()
  }

  /**
   * Initialize socket connection
   * @returns {Promise} Connection promise
   */
  connect() {
    return new Promise((resolve, reject) => {
      if (this.socket?.connected) {
        resolve(this.socket)
        return
      }

      this.socket = io(APP_CONFIG.socketUrl, {
        transports: ['websocket', 'polling'],
        timeout: 20000,
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: this.reconnectDelay,
        reconnectionDelayMax: 5000,
        maxHttpBufferSize: 1e6,
        pingTimeout: 60000,
        pingInterval: 25000
      })

      // Connection event handlers
      this.socket.on(SOCKET_EVENTS.CONNECT, () => {
        console.log('WebSocket connected:', this.socket.id)
        this.connected = true
        this.reconnectAttempts = 0
        
        // Restore subscriptions after reconnection
        this.restoreSubscriptions()
        
        resolve(this.socket)
      })

      this.socket.on(SOCKET_EVENTS.DISCONNECT, (reason) => {
        console.log('WebSocket disconnected:', reason)
        this.connected = false
        
        // Emit custom disconnect event for components
        this.emitToListeners('connection_status', { connected: false, reason })
      })

      this.socket.on('connect_error', (error) => {
        console.error('WebSocket connection error:', error)
        this.connected = false
        this.reconnectAttempts++
        
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          reject(new Error(`Failed to connect after ${this.maxReconnectAttempts} attempts`))
        }
      })

      this.socket.on('reconnect', (attemptNumber) => {
        console.log(`WebSocket reconnected after ${attemptNumber} attempts`)
        this.connected = true
        this.reconnectAttempts = 0
        
        this.emitToListeners('connection_status', { connected: true, reconnected: true })
      })

      this.socket.on('reconnect_error', (error) => {
        console.error('WebSocket reconnection error:', error)
      })

      this.socket.on('reconnect_failed', () => {
        console.error('WebSocket reconnection failed')
        this.emitToListeners('connection_status', { connected: false, failed: true })
      })

      // Server message handlers
      this.socket.on(SOCKET_EVENTS.CONNECTED, (data) => {
        console.log('Server connection confirmed:', data)
        this.emitToListeners('server_connected', data)
      })

      // Ping/pong for connection health
      this.socket.on(SOCKET_EVENTS.PONG, (data) => {
        this.emitToListeners('pong', data)
      })

      // Global error handler
      this.socket.on('error', (error) => {
        console.error('WebSocket error:', error)
        this.emitToListeners('socket_error', error)
      })
    })
  }

  /**
   * Disconnect socket
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
      this.connected = false
      this.subscriptions.clear()
    }
  }

  /**
   * Check if socket is connected
   * @returns {boolean} Connection status
   */
  isConnected() {
    return this.connected && this.socket?.connected
  }

  /**
   * Subscribe to balance updates for user
   * @param {string} userId - User ID or address
   */
  subscribeToBalances(userId) {
    if (!this.isConnected() || !userId) return

    this.socket.emit(SOCKET_EVENTS.SUBSCRIBE_BALANCES, userId)
    this.subscriptions.add(`balances:${userId}`)
    
    console.log('Subscribed to balance updates for:', userId)
  }

  /**
   * Subscribe to transaction updates for user
   * @param {string} userId - User ID or address
   */
  subscribeToTransactions(userId) {
    if (!this.isConnected() || !userId) return

    this.socket.emit(SOCKET_EVENTS.SUBSCRIBE_TRANSACTIONS, userId)
    this.subscriptions.add(`transactions:${userId}`)
    
    console.log('Subscribed to transaction updates for:', userId)
  }

  /**
   * Authenticate user with socket
   * @param {string} userAddress - User's wallet address
   * @param {string} signature - Authentication signature
   */
  authenticate(userAddress, signature) {
    if (!this.isConnected()) return

    this.socket.emit(SOCKET_EVENTS.AUTHENTICATE, {
      userAddress,
      signature
    })
  }

  /**
   * Send ping to server
   */
  ping() {
    if (!this.isConnected()) return

    this.socket.emit(SOCKET_EVENTS.PING, {
      timestamp: new Date().toISOString()
    })
  }

  /**
   * Listen for balance updates
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  onBalanceUpdate(callback) {
    return this.on(SOCKET_EVENTS.BALANCE_UPDATE, callback)
  }

  /**
   * Listen for transaction updates
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  onTransactionUpdate(callback) {
    return this.on(SOCKET_EVENTS.TRANSACTION_UPDATE, callback)
  }

  /**
   * Listen for user notifications
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  onUserNotification(callback) {
    return this.on(SOCKET_EVENTS.USER_NOTIFICATION, callback)
  }

  /**
   * Listen for system notifications
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  onSystemNotification(callback) {
    return this.on(SOCKET_EVENTS.SYSTEM_NOTIFICATION, callback)
  }

  /**
   * Listen for subscription confirmations
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  onSubscribed(callback) {
    return this.on(SOCKET_EVENTS.SUBSCRIBED, callback)
  }

  /**
   * Listen for authentication confirmations
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  onAuthenticated(callback) {
    return this.on(SOCKET_EVENTS.AUTHENTICATED, callback)
  }

  /**
   * Listen for authentication errors
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  onAuthError(callback) {
    return this.on(SOCKET_EVENTS.AUTH_ERROR, callback)
  }

  /**
   * Listen for connection status changes
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  onConnectionStatus(callback) {
    return this.on('connection_status', callback)
  }

  /**
   * Generic event listener
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    
    this.listeners.get(event).add(callback)

    // Add socket listener if connected
    if (this.socket) {
      this.socket.on(event, callback)
    }

    // Return unsubscribe function
    return () => {
      this.off(event, callback)
    }
  }

  /**
   * Remove event listener
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   */
  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback)
      
      if (this.listeners.get(event).size === 0) {
        this.listeners.delete(event)
      }
    }

    // Remove socket listener if connected
    if (this.socket) {
      this.socket.off(event, callback)
    }
  }

  /**
   * Emit event to local listeners
   * @param {string} event - Event name
   * @param {any} data - Event data
   */
  emitToListeners(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data)
        } catch (error) {
          console.error(`Error in listener for event ${event}:`, error)
        }
      })
    }
  }

  /**
   * Restore subscriptions after reconnection
   */
  restoreSubscriptions() {
    this.subscriptions.forEach(subscription => {
      const [type, userId] = subscription.split(':')
      
      if (type === 'balances') {
        this.subscribeToBalances(userId)
      } else if (type === 'transactions') {
        this.subscribeToTransactions(userId)
      }
    })
  }

  /**
   * Get connection statistics
   * @returns {Object} Connection statistics
   */
  getConnectionStats() {
    return {
      connected: this.connected,
      socketId: this.socket?.id,
      transport: this.socket?.io?.engine?.transport?.name,
      subscriptions: Array.from(this.subscriptions),
      listeners: Object.fromEntries(
        Array.from(this.listeners.entries()).map(([event, callbacks]) => [
          event,
          callbacks.size
        ])
      ),
      reconnectAttempts: this.reconnectAttempts
    }
  }

  /**
   * Clean up all listeners and disconnect
   */
  cleanup() {
    this.listeners.clear()
    this.subscriptions.clear()
    this.disconnect()
  }
}

// Create singleton instance
const socketService = new SocketService()

export default socketService