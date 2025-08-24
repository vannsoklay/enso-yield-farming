const { mongoose } = require('../db/mongo');

const transactionSchema = new mongoose.Schema({
  // Transaction identifiers
  txHash: {
    type: String,
    index: true,
    sparse: true // Allow null/undefined for pending transactions
  },
  ensoTxId: {
    type: String,
    index: true,
    sparse: true
  },
  internalId: {
    type: String,
    required: true,
    unique: true
  },

  // User and transaction details
  userAddress: {
    type: String,
    required: true,
    lowercase: true,
    index: true
  },
  type: {
    type: String,
    required: true,
    enum: ['deposit', 'withdraw', 'compound'],
    index: true
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'confirmed', 'completed', 'failed'],
    default: 'pending',
    index: true
  },

  // Amount and token information
  amount: {
    type: String, // Store as string to preserve precision for bigint
    required: true
  },
  tokenAddress: {
    type: String,
    required: true,
    lowercase: true
  },
  tokenSymbol: {
    type: String,
    required: true,
    uppercase: true
  },

  // Chain information
  fromChain: {
    type: Number,
    required: true,
    enum: [137, 100] // Polygon, Gnosis
  },
  toChain: {
    type: Number,
    required: true,
    enum: [137, 100] // Polygon, Gnosis
  },

  // Transaction execution details
  gasUsed: {
    type: String, // Store as string for bigint
    default: null
  },
  gasPrice: {
    type: String, // Store as string for bigint
    default: null
  },
  effectiveGasPrice: {
    type: String, // Store as string for bigint
    default: null
  },
  slippage: {
    type: Number,
    default: 0.5,
    min: 0,
    max: 100
  },

  // Error handling
  error: {
    message: String,
    code: String,
    reason: String
  },
  retryCount: {
    type: Number,
    default: 0,
    min: 0,
    max: 3
  },

  // Cross-chain tracking
  sourceTransactionHash: String,
  destinationTransactionHash: String,
  bridgeId: String,

  // Metadata
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true, // Adds createdAt and updatedAt
  versionKey: false
});

// Indexes for performance
transactionSchema.index({ userAddress: 1, createdAt: -1 });
transactionSchema.index({ status: 1, createdAt: -1 });
transactionSchema.index({ type: 1, fromChain: 1 });
transactionSchema.index({ txHash: 1, status: 1 });

// Instance methods
transactionSchema.methods.toSafeObject = function() {
  const obj = this.toObject();
  return {
    ...obj,
    // Convert string amounts back to display format if needed
    amount: obj.amount,
    gasUsed: obj.gasUsed,
    gasPrice: obj.gasPrice,
    effectiveGasPrice: obj.effectiveGasPrice
  };
};

transactionSchema.methods.markCompleted = function(txHash, gasUsed, gasPrice) {
  this.status = 'completed';
  this.txHash = txHash;
  if (gasUsed) this.gasUsed = gasUsed.toString();
  if (gasPrice) this.gasPrice = gasPrice.toString();
  return this.save();
};

transactionSchema.methods.markFailed = function(error) {
  this.status = 'failed';
  this.error = {
    message: error.message || 'Unknown error',
    code: error.code || 'UNKNOWN_ERROR',
    reason: error.reason || error.message
  };
  return this.save();
};

// Static methods
transactionSchema.statics.findByUser = function(userAddress, options = {}) {
  const { limit = 50, skip = 0, status, type } = options;
  
  let query = { userAddress: userAddress.toLowerCase() };
  
  if (status) query.status = status;
  if (type) query.type = type;
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip);
};

transactionSchema.statics.findPendingTransactions = function() {
  return this.find({ 
    status: { $in: ['pending', 'confirmed'] },
    createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
  }).sort({ createdAt: 1 });
};

transactionSchema.statics.generateInternalId = function() {
  return `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;