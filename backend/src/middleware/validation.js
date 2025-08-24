const Joi = require('joi');
const logger = require('../utils/logger');
const { isValidAddress } = require('../utils/helpers');

// Custom Joi extension for Ethereum addresses
const JoiWithEthAddress = Joi.extend({
  type: 'ethAddress',
  base: Joi.string(),
  messages: {
    'ethAddress.invalid': 'Invalid Ethereum address format'
  },
  validate(value, helpers) {
    if (!isValidAddress(value)) {
      return { value, errors: helpers.error('ethAddress.invalid') };
    }
  }
});

// Validation schemas
const schemas = {
  // Deposit validation
  deposit: Joi.object({
    amount: Joi.string()
      .pattern(/^\d+(\.\d+)?$/)
      .required()
      .messages({
        'string.pattern.base': 'Amount must be a valid number',
        'any.required': 'Amount is required'
      }),
    slippage: Joi.number()
      .min(0.1)
      .max(5)
      .default(0.5)
      .messages({
        'number.min': 'Slippage must be at least 0.1%',
        'number.max': 'Slippage cannot exceed 5%'
      }),
    userAddress: JoiWithEthAddress.ethAddress()
      .required()
      .messages({
        'any.required': 'User address is required'
      })
  }),

  // Withdraw validation
  withdraw: Joi.object({
    amount: Joi.string()
      .pattern(/^\d+(\.\d+)?$/)
      .required()
      .messages({
        'string.pattern.base': 'Amount must be a valid number',
        'any.required': 'Amount is required'
      }),
    slippage: Joi.number()
      .min(0.1)
      .max(5)
      .default(0.5)
      .messages({
        'number.min': 'Slippage must be at least 0.1%',
        'number.max': 'Slippage cannot exceed 5%'
      }),
    userAddress: JoiWithEthAddress.ethAddress()
      .required()
      .messages({
        'any.required': 'User address is required'
      })
  }),

  // Compound validation
  compound: Joi.object({
    userAddress: JoiWithEthAddress.ethAddress()
      .required()
      .messages({
        'any.required': 'User address is required'
      }),
    slippage: Joi.number()
      .min(0.1)
      .max(5)
      .default(0.5)
      .optional()
  }),

  // Balance query validation
  balanceQuery: Joi.object({
    userAddress: JoiWithEthAddress.ethAddress()
      .required()
      .messages({
        'any.required': 'User address is required'
      }),
    chain: Joi.string()
      .valid('polygon', 'gnosis', 'all')
      .default('all')
      .messages({
        'any.only': 'Chain must be polygon, gnosis, or all'
      })
  }),

  // Transaction query validation
  transactionQuery: Joi.object({
    userAddress: JoiWithEthAddress.ethAddress()
      .optional(),
    status: Joi.string()
      .valid('pending', 'completed', 'failed', 'cancelled')
      .optional(),
    type: Joi.string()
      .valid('deposit', 'withdraw', 'compound')
      .optional(),
    limit: Joi.number()
      .integer()
      .min(1)
      .max(100)
      .default(20),
    offset: Joi.number()
      .integer()
      .min(0)
      .default(0)
  }),

  // Gas estimation validation
  gasEstimate: Joi.object({
    amount: Joi.string()
      .pattern(/^\d+(\.\d+)?$/)
      .required(),
    type: Joi.string()
      .valid('deposit', 'withdraw', 'compound')
      .required(),
    userAddress: JoiWithEthAddress.ethAddress()
      .required()
  })
};

// Validation middleware factory
const validateRequest = (schema, source = 'body') => {
  return (req, res, next) => {
    const data = source === 'query' ? req.query : req.body;
    
    const { error, value } = schema.validate(data, {
      abortEarly: false,
      stripUnknown: true,
      convert: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      logger.warn('Validation error', {
        requestId: req.id,
        url: req.url,
        method: req.method,
        errors
      });

      return res.status(400).json({
        error: 'Validation Error',
        message: 'Request validation failed',
        details: errors,
        timestamp: new Date().toISOString(),
        requestId: req.id
      });
    }

    // Replace the original data with validated data
    if (source === 'query') {
      req.query = value;
    } else {
      req.body = value;
    }

    next();
  };
};

// Specific validation middleware functions
const validateDeposit = validateRequest(schemas.deposit);
const validateWithdraw = validateRequest(schemas.withdraw);
const validateCompound = validateRequest(schemas.compound);
const validateBalanceQuery = validateRequest(schemas.balanceQuery, 'query');
const validateTransactionQuery = validateRequest(schemas.transactionQuery, 'query');
const validateGasEstimate = validateRequest(schemas.gasEstimate);

// Generic validation error handler
const handleValidationError = (error, req, res, next) => {
  if (error instanceof Joi.ValidationError) {
    const errors = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message
    }));

    return res.status(400).json({
      error: 'Validation Error',
      message: 'Request validation failed',
      details: errors,
      timestamp: new Date().toISOString(),
      requestId: req.id
    });
  }

  next(error);
};

module.exports = {
  schemas,
  validateRequest,
  validateDeposit,
  validateWithdraw,
  validateCompound,
  validateBalanceQuery,
  validateTransactionQuery,
  validateGasEstimate,
  handleValidationError
};