const mongoose = require('mongoose');
const logger = require('../utils/logger');

/**
 * MongoDB connection handler
 */
class MongoConnection {
  constructor() {
    this.isConnected = false;
    this.connectionOptions = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4 // Use IPv4, skip trying IPv6
    };
  }

  /**
   * Connect to MongoDB
   */
  async connect() {
    if (this.isConnected) {
      logger.info('MongoDB already connected');
      return;
    }

    try {
      const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/enso-yield-farming';
      
      await mongoose.connect(mongoUri, this.connectionOptions);
      
      this.isConnected = true;
      logger.info('✅ Connected to MongoDB successfully');
      
      // Handle connection events
      mongoose.connection.on('error', (error) => {
        logger.error('MongoDB connection error:', error);
        this.isConnected = false;
      });

      mongoose.connection.on('disconnected', () => {
        logger.warn('MongoDB disconnected');
        this.isConnected = false;
      });

      // Graceful shutdown
      process.on('SIGINT', async () => {
        await this.disconnect();
        process.exit(0);
      });

    } catch (error) {
      logger.error('❌ Failed to connect to MongoDB:', error);
      this.isConnected = false;
      throw error;
    }
  }

  /**
   * Disconnect from MongoDB
   */
  async disconnect() {
    try {
      await mongoose.connection.close();
      this.isConnected = false;
      logger.info('MongoDB connection closed');
    } catch (error) {
      logger.error('Error closing MongoDB connection:', error);
    }
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      readyState: mongoose.connection.readyState,
      host: mongoose.connection.host,
      port: mongoose.connection.port,
      name: mongoose.connection.name
    };
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      if (!this.isConnected) {
        return { status: 'disconnected', message: 'Not connected to MongoDB' };
      }

      // Simple ping to check if connection is alive
      await mongoose.connection.db.admin().ping();
      
      return { 
        status: 'healthy', 
        message: 'MongoDB connection is healthy',
        details: this.getStatus()
      };
    } catch (error) {
      return { 
        status: 'unhealthy', 
        message: `MongoDB health check failed: ${error.message}` 
      };
    }
  }
}

// Export singleton instance
const mongoConnection = new MongoConnection();

module.exports = {
  connect: () => mongoConnection.connect(),
  disconnect: () => mongoConnection.disconnect(),
  getStatus: () => mongoConnection.getStatus(),
  healthCheck: () => mongoConnection.healthCheck(),
  mongoose
};