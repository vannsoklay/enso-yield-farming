const logger = require('../utils/logger');
const socketUsers = new Map(); // Store user socket connections

class SocketService {
  constructor() {
    this.io = null;
    this.connectedUsers = new Map();
  }

  /**
   * Initialize Socket.io server
   * @param {Object} io - Socket.io server instance
   */
  initialize(io) {
    this.io = io;
    
    io.on('connection', (socket) => {
      logger.info('Client connected', {
        socketId: socket.id,
        ip: socket.handshake.address
      });

      // Handle user subscription to balance updates
      socket.on('subscribe:balances', (userId) => {
        this.subscribeToBalances(socket, userId);
      });

      // Handle user subscription to transaction updates
      socket.on('subscribe:transactions', (userId) => {
        this.subscribeToTransactions(socket, userId);
      });

      // Handle user authentication
      socket.on('authenticate', (data) => {
        this.authenticateUser(socket, data);
      });

      // Handle disconnection
      socket.on('disconnect', (reason) => {
        this.handleDisconnect(socket, reason);
      });

      // Handle ping for connection health
      socket.on('ping', () => {
        socket.emit('pong', { timestamp: new Date().toISOString() });
      });

      // Send welcome message
      socket.emit('connected', {
        socketId: socket.id,
        timestamp: new Date().toISOString(),
        message: 'Connected to Enso Yield Farming WebSocket'
      });
    });

    logger.info('Socket.io service initialized');
  }

  /**
   * Subscribe user to balance updates
   * @param {Object} socket - Socket instance
   * @param {string} userId - User ID or address
   */
  subscribeToBalances(socket, userId) {
    if (!userId) {
      socket.emit('error', { message: 'User ID is required for subscription' });
      return;
    }

    const room = `balances:${userId}`;
    socket.join(room);
    
    // Store user connection
    this.connectedUsers.set(socket.id, {
      userId,
      rooms: [room],
      connectedAt: new Date().toISOString()
    });

    logger.info('User subscribed to balance updates', {
      socketId: socket.id,
      userId,
      room
    });

    socket.emit('subscribed', {
      type: 'balances',
      userId,
      room,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Subscribe user to transaction updates
   * @param {Object} socket - Socket instance
   * @param {string} userId - User ID or address
   */
  subscribeToTransactions(socket, userId) {
    if (!userId) {
      socket.emit('error', { message: 'User ID is required for subscription' });
      return;
    }

    const room = `transactions:${userId}`;
    socket.join(room);
    
    // Update user connection info
    const userInfo = this.connectedUsers.get(socket.id) || {
      userId,
      rooms: [],
      connectedAt: new Date().toISOString()
    };
    
    if (!userInfo.rooms.includes(room)) {
      userInfo.rooms.push(room);
    }
    
    this.connectedUsers.set(socket.id, userInfo);

    logger.info('User subscribed to transaction updates', {
      socketId: socket.id,
      userId,
      room
    });

    socket.emit('subscribed', {
      type: 'transactions',
      userId,
      room,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Authenticate user socket connection
   * @param {Object} socket - Socket instance
   * @param {Object} data - Authentication data
   */
  authenticateUser(socket, data) {
    try {
      const { userAddress, signature } = data;
      
      // In a real implementation, verify the signature
      // For now, we'll just store the user info
      
      const userInfo = this.connectedUsers.get(socket.id) || {
        rooms: [],
        connectedAt: new Date().toISOString()
      };
      
      userInfo.userAddress = userAddress;
      userInfo.authenticated = true;
      userInfo.authenticatedAt = new Date().toISOString();
      
      this.connectedUsers.set(socket.id, userInfo);

      logger.info('User authenticated', {
        socketId: socket.id,
        userAddress
      });

      socket.emit('authenticated', {
        userAddress,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('User authentication failed', {
        socketId: socket.id,
        error: error.message
      });

      socket.emit('auth_error', {
        message: 'Authentication failed',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Handle socket disconnection
   * @param {Object} socket - Socket instance
   * @param {string} reason - Disconnection reason
   */
  handleDisconnect(socket, reason) {
    const userInfo = this.connectedUsers.get(socket.id);
    
    logger.info('Client disconnected', {
      socketId: socket.id,
      reason,
      userInfo: userInfo || 'unknown'
    });

    // Clean up user connection data
    this.connectedUsers.delete(socket.id);
  }

  /**
   * Broadcast balance update to user
   * @param {string} userId - User ID or address
   * @param {Object} balances - Updated balance data
   */
  broadcastBalanceUpdate(userId, balances) {
    if (!this.io) {
      logger.warn('Socket.io not initialized');
      return;
    }

    const room = `balances:${userId}`;
    
    this.io.to(room).emit('balance:update', {
      userId,
      balances,
      timestamp: new Date().toISOString()
    });

    logger.info('Balance update broadcasted', {
      userId,
      room,
      polygon: balances.polygon?.eure?.balance || 'N/A',
      gnosis: balances.gnosis?.lpToken?.balance || 'N/A'
    });
  }

  /**
   * Broadcast transaction update to user
   * @param {string} userId - User ID or address
   * @param {Object} transaction - Transaction data
   */
  broadcastTransactionUpdate(userId, transaction) {
    if (!this.io) {
      logger.warn('Socket.io not initialized');
      return;
    }

    const room = `transactions:${userId}`;
    
    this.io.to(room).emit('transaction:update', {
      userId,
      transaction,
      timestamp: new Date().toISOString()
    });

    logger.info('Transaction update broadcasted', {
      userId,
      room,
      txId: transaction.txId || transaction.id,
      status: transaction.status
    });
  }

  /**
   * Broadcast system notification to all users
   * @param {Object} notification - Notification data
   */
  broadcastSystemNotification(notification) {
    if (!this.io) {
      logger.warn('Socket.io not initialized');
      return;
    }

    this.io.emit('system:notification', {
      ...notification,
      timestamp: new Date().toISOString()
    });

    logger.info('System notification broadcasted', {
      type: notification.type,
      message: notification.message
    });
  }

  /**
   * Send notification to specific user
   * @param {string} userId - User ID or address
   * @param {Object} notification - Notification data
   */
  sendUserNotification(userId, notification) {
    if (!this.io) {
      logger.warn('Socket.io not initialized');
      return;
    }

    // Send to both balance and transaction rooms for the user
    const rooms = [`balances:${userId}`, `transactions:${userId}`];
    
    rooms.forEach(room => {
      this.io.to(room).emit('user:notification', {
        userId,
        ...notification,
        timestamp: new Date().toISOString()
      });
    });

    logger.info('User notification sent', {
      userId,
      type: notification.type,
      message: notification.message
    });
  }

  /**
   * Get connected users count
   * @returns {number} Number of connected users
   */
  getConnectedUsersCount() {
    return this.connectedUsers.size;
  }

  /**
   * Get connection statistics
   * @returns {Object} Connection statistics
   */
  getConnectionStats() {
    const totalConnections = this.connectedUsers.size;
    const authenticatedUsers = Array.from(this.connectedUsers.values())
      .filter(user => user.authenticated).length;
    
    const roomStats = {};
    this.connectedUsers.forEach(user => {
      user.rooms.forEach(room => {
        roomStats[room] = (roomStats[room] || 0) + 1;
      });
    });

    return {
      totalConnections,
      authenticatedUsers,
      roomStats,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Disconnect user by ID
   * @param {string} userId - User ID to disconnect
   */
  disconnectUser(userId) {
    if (!this.io) {
      logger.warn('Socket.io not initialized');
      return;
    }

    // Find and disconnect all sockets for the user
    this.connectedUsers.forEach((userInfo, socketId) => {
      if (userInfo.userId === userId || userInfo.userAddress === userId) {
        const socket = this.io.sockets.sockets.get(socketId);
        if (socket) {
          socket.disconnect(true);
          logger.info('User disconnected by admin', {
            userId,
            socketId
          });
        }
      }
    });
  }
}

// Create singleton instance
const socketService = new SocketService();

module.exports = socketService;