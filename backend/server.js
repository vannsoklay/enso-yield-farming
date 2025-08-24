require('dotenv').config();
const app = require('./src/app');
const logger = require('./src/utils/logger');
const { connect: connectMongoDB } = require('./src/db/mongo');

const PORT = process.env.PORT || 3001;

async function startServer() {
  try {
    // Initialize MongoDB connection
    if (process.env.MONGODB_URI) {
      await connectMongoDB();
      logger.info('📦 MongoDB connection initialized');
    } else {
      logger.warn('⚠️  MongoDB not configured - transactions will not be persisted');
    }

    const server = app.listen(PORT, () => {
      logger.info(`🚀 Enso Yield Farming API server running on port ${PORT}`);
      logger.info(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`🌐 CORS enabled for: ${process.env.CORS_ORIGIN || 'http://localhost:3000'}`);
      logger.info(`🔗 Blockchain: viem v2 integration enabled`);
    });

    // Graceful shutdown
    const shutdown = async (signal) => {
      logger.info(`${signal} received, shutting down gracefully`);
      server.close(async () => {
        try {
          const { disconnect } = require('./src/db/mongo');
          await disconnect();
          logger.info('MongoDB connection closed');
        } catch (error) {
          logger.error('Error closing MongoDB connection:', error);
        }
        logger.info('Process terminated');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});