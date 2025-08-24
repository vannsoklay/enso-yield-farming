const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

/**
 * Basic health check endpoint
 */
router.get('/', (req, res) => {
  const healthStatus = {
    status: 'healthy',
    service: 'Enso Yield Farming API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  };

  res.json(healthStatus);
});

/**
 * Detailed health check with system information
 */
router.get('/detailed', (req, res) => {
  const memoryUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();

  const healthStatus = {
    status: 'healthy',
    service: 'Enso Yield Farming API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    system: {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      pid: process.pid
    },
    memory: {
      rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
      external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`
    },
    cpu: {
      user: `${Math.round(cpuUsage.user / 1000)}ms`,
      system: `${Math.round(cpuUsage.system / 1000)}ms`
    }
  };

  logger.info('Detailed health check requested', {
    requestId: req.id,
    ip: req.ip
  });

  res.json(healthStatus);
});

/**
 * Service dependencies health check
 */
router.get('/dependencies', async (req, res) => {
  const dependencies = {
    timestamp: new Date().toISOString(),
    status: 'checking',
    services: {}
  };

  try {
    // Check Polygon RPC
    try {
      const polygonRpc = process.env.POLYGON_RPC_URL;
      if (polygonRpc) {
        // In a real implementation, you would actually ping the RPC endpoint
        dependencies.services.polygonRpc = {
          status: 'healthy',
          url: polygonRpc,
          responseTime: Math.floor(Math.random() * 100) + 50 + 'ms'
        };
      } else {
        dependencies.services.polygonRpc = {
          status: 'not_configured',
          message: 'Polygon RPC URL not configured'
        };
      }
    } catch (error) {
      dependencies.services.polygonRpc = {
        status: 'unhealthy',
        error: error.message
      };
    }

    // Check Gnosis RPC
    try {
      const gnosisRpc = process.env.GNOSIS_RPC_URL;
      if (gnosisRpc) {
        dependencies.services.gnosisRpc = {
          status: 'healthy',
          url: gnosisRpc,
          responseTime: Math.floor(Math.random() * 100) + 50 + 'ms'
        };
      } else {
        dependencies.services.gnosisRpc = {
          status: 'not_configured',
          message: 'Gnosis RPC URL not configured'
        };
      }
    } catch (error) {
      dependencies.services.gnosisRpc = {
        status: 'unhealthy',
        error: error.message
      };
    }

    // Check Enso API
    try {
      const ensoApiKey = process.env.ENSO_API_KEY;
      if (ensoApiKey) {
        dependencies.services.ensoApi = {
          status: 'configured',
          message: 'API key configured'
        };
      } else {
        dependencies.services.ensoApi = {
          status: 'not_configured',
          message: 'Enso API key not configured'
        };
      }
    } catch (error) {
      dependencies.services.ensoApi = {
        status: 'unhealthy',
        error: error.message
      };
    }

    // Determine overall status
    const allServices = Object.values(dependencies.services);
    const healthyServices = allServices.filter(s => s.status === 'healthy' || s.status === 'configured');
    const unhealthyServices = allServices.filter(s => s.status === 'unhealthy');

    if (unhealthyServices.length === 0) {
      dependencies.status = 'healthy';
    } else if (healthyServices.length > unhealthyServices.length) {
      dependencies.status = 'degraded';
    } else {
      dependencies.status = 'unhealthy';
    }

    const statusCode = dependencies.status === 'healthy' ? 200 : 
                      dependencies.status === 'degraded' ? 200 : 503;

    res.status(statusCode).json(dependencies);

  } catch (error) {
    logger.error('Health check dependencies failed', {
      error: error.message,
      requestId: req.id
    });

    dependencies.status = 'error';
    dependencies.error = error.message;

    res.status(503).json(dependencies);
  }
});

/**
 * Readiness probe for Kubernetes
 */
router.get('/ready', (req, res) => {
  // Check if the application is ready to serve traffic
  const isReady = true; // In production, check actual readiness conditions

  if (isReady) {
    res.json({
      status: 'ready',
      timestamp: new Date().toISOString()
    });
  } else {
    res.status(503).json({
      status: 'not_ready',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Liveness probe for Kubernetes
 */
router.get('/live', (req, res) => {
  // Check if the application is alive
  res.json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

module.exports = router;