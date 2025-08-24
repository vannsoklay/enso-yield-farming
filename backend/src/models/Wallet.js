const { mongoose } = require('../db/mongo');

const walletSchema = new mongoose.Schema({
  // Wallet identification
  address: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    index: true
  },

  // Balance tracking per chain and token
  balances: [{
    chainId: {
      type: Number,
      required: true,
      enum: [137, 100] // Polygon, Gnosis
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
    balance: {
      type: String, // Store as string to preserve precision for bigint
      required: true,
      default: '0'
    },
    decimals: {
      type: Number,
      required: true,
      default: 18
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  }],

  // Farming positions
  farmingPositions: [{
    protocolName: {
      type: String,
      required: true
    },
    positionId: String,
    chainId: {
      type: Number,
      required: true,
      enum: [137, 100]
    },
    lpTokenAddress: {
      type: String,
      required: true,
      lowercase: true
    },
    lpBalance: {
      type: String,
      default: '0'
    },
    underlyingTokens: [{
      address: {
        type: String,
        required: true,
        lowercase: true
      },
      symbol: String,
      balance: String
    }],
    rewards: [{
      tokenAddress: {
        type: String,
        required: true,
        lowercase: true
      },
      amount: String,
      symbol: String
    }],
    apy: Number,
    totalValueLocked: String, // TVL in USD
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  }],

  // Transaction history summary
  transactionStats: {
    totalDeposits: {
      type: Number,
      default: 0
    },
    totalWithdrawals: {
      type: Number,
      default: 0
    },
    totalGasSpent: {
      type: String,
      default: '0'
    },
    lastActivity: Date
  },

  // User preferences
  preferences: {
    defaultSlippage: {
      type: Number,
      default: 0.5,
      min: 0.1,
      max: 10
    },
    autoCompound: {
      type: Boolean,
      default: false
    },
    notifications: {
      email: String,
      discord: String,
      telegram: String
    }
  },

  // Metadata
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true,
  versionKey: false
});

// Indexes
walletSchema.index({ address: 1 });
walletSchema.index({ 'balances.chainId': 1, 'balances.tokenAddress': 1 });
walletSchema.index({ 'farmingPositions.chainId': 1, 'farmingPositions.protocolName': 1 });

// Instance methods
walletSchema.methods.updateBalance = function(chainId, tokenAddress, tokenSymbol, balance, decimals = 18) {
  const existingBalance = this.balances.find(
    b => b.chainId === chainId && b.tokenAddress.toLowerCase() === tokenAddress.toLowerCase()
  );

  if (existingBalance) {
    existingBalance.balance = balance.toString();
    existingBalance.lastUpdated = new Date();
  } else {
    this.balances.push({
      chainId,
      tokenAddress: tokenAddress.toLowerCase(),
      tokenSymbol: tokenSymbol.toUpperCase(),
      balance: balance.toString(),
      decimals,
      lastUpdated: new Date()
    });
  }

  return this.save();
};

walletSchema.methods.getBalance = function(chainId, tokenAddress) {
  const balance = this.balances.find(
    b => b.chainId === chainId && b.tokenAddress.toLowerCase() === tokenAddress.toLowerCase()
  );
  
  return balance ? balance.balance : '0';
};

walletSchema.methods.addFarmingPosition = function(position) {
  const existingPosition = this.farmingPositions.find(
    p => p.chainId === position.chainId && 
        p.protocolName === position.protocolName &&
        p.lpTokenAddress.toLowerCase() === position.lpTokenAddress.toLowerCase()
  );

  if (existingPosition) {
    Object.assign(existingPosition, position, { lastUpdated: new Date() });
  } else {
    this.farmingPositions.push({
      ...position,
      lpTokenAddress: position.lpTokenAddress.toLowerCase(),
      lastUpdated: new Date()
    });
  }

  return this.save();
};

walletSchema.methods.updateTransactionStats = function(type, gasSpent) {
  if (type === 'deposit') {
    this.transactionStats.totalDeposits += 1;
  } else if (type === 'withdraw') {
    this.transactionStats.totalWithdrawals += 1;
  }

  if (gasSpent) {
    const currentGasSpent = BigInt(this.transactionStats.totalGasSpent || '0');
    const newGasSpent = BigInt(gasSpent.toString());
    this.transactionStats.totalGasSpent = (currentGasSpent + newGasSpent).toString();
  }

  this.transactionStats.lastActivity = new Date();
  return this.save();
};

walletSchema.methods.toSafeObject = function() {
  const obj = this.toObject();
  return {
    ...obj,
    // Remove sensitive data if needed
    preferences: {
      ...obj.preferences,
      notifications: undefined // Don't expose notification settings
    }
  };
};

// Static methods
walletSchema.statics.findOrCreateWallet = async function(address) {
  let wallet = await this.findOne({ address: address.toLowerCase() });
  
  if (!wallet) {
    wallet = new this({
      address: address.toLowerCase(),
      balances: [],
      farmingPositions: [],
      transactionStats: {
        totalDeposits: 0,
        totalWithdrawals: 0,
        totalGasSpent: '0'
      }
    });
    await wallet.save();
  }
  
  return wallet;
};

walletSchema.statics.getWalletsWithStaleBalances = function(hoursThreshold = 1) {
  const staleTime = new Date(Date.now() - hoursThreshold * 60 * 60 * 1000);
  
  return this.find({
    'balances.lastUpdated': { $lt: staleTime }
  });
};

const Wallet = mongoose.model('Wallet', walletSchema);

module.exports = Wallet;