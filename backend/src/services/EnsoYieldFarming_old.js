const { createPublicClient, createWalletClient, http, formatUnits, parseUnits, getBalance, readContract, writeContract, sendTransaction, estimateGas, waitForTransactionReceipt } = require('viem');
const { polygon, gnosis } = require('viem/chains');
const { privateKeyToAccount } = require('viem/accounts');
const logger = require('../utils/logger');
const { retryWithBackoff, generateTxId, formatAmount, parseAmount } = require('../utils/helpers');
const { getChainConfig, getRpcUrl } = require('../config/chains');
const { getFarmingPair, getTokenByAddress } = require('../config/tokens');
const Transaction = require('../models/Transaction');
const Wallet = require('../models/Wallet');

class EnsoYieldFarming {
  constructor(apiKey, privateKey) {
    this.apiKey = apiKey;
    this.privateKey = privateKey;
    
    // Initialize viem account
    this.account = privateKeyToAccount(privateKey);
    
    // Initialize viem public clients
    this.polygonClient = createPublicClient({
      chain: polygon,
      transport: http(getRpcUrl(137))
    });
    
    this.gnosisClient = createPublicClient({
      chain: gnosis,
      transport: http(getRpcUrl(100))
    });
    
    // Initialize viem wallet clients
    this.polygonWalletClient = createWalletClient({
      account: this.account,
      chain: polygon,
      transport: http(getRpcUrl(137))
    });
    
    this.gnosisWalletClient = createWalletClient({
      account: this.account,
      chain: gnosis,
      transport: http(getRpcUrl(100))
    });
    
    // Cache for balances and transactions
    this.cache = new Map();
    this.cacheTimeout = 30000; // 30 seconds
    
    logger.info('EnsoYieldFarming service initialized', {
      walletAddress: this.account.address,
      polygonRpc: getRpcUrl(137),
      gnosisRpc: getRpcUrl(100)
    });
  }

  /**
   * Get balances from both chains using viem v2 with MongoDB persistence
   * @param {string} userAddress - User's wallet address
   * @returns {Object} Balances from both chains
   */
  async getBalances(userAddress = null) {
    const address = userAddress || this.account.address;
    
    try {
      // Update wallet balances in MongoDB
      const wallet = await Wallet.findOrCreateWallet(address);
      
      const [polygonBalance, gnosisBalance] = await Promise.all([
        this.getPolygonBalance(address),
        this.getGnosisBalance(address)
      ]);

      // Update balances in MongoDB
      await this.updateWalletBalances(wallet, polygonBalance, gnosisBalance);

      const balances = {
        polygon: polygonBalance,
        gnosis: gnosisBalance,
        timestamp: new Date().toISOString()
      };
      
      return balances;
    } catch (error) {
      logger.error('Failed to get balances', {
        error: error.message,
        userAddress: address
      });
      throw error;
    }
  }

  /**
   * Get Polygon balances using viem v2
   * @param {string} address - Wallet address
   * @returns {Object} Polygon balances
   */
  async getPolygonBalance(address) {
    try {
      const farmingPair = getFarmingPair();
      const eureToken = farmingPair.deposit.token;
      
      // Get native MATIC balance using viem
      const nativeBalance = await this.polygonClient.getBalance({
        address: address
      });
      
      // Get EURe token balance using viem
      const eureBalance = await this.getTokenBalanceViem(
        address,
        eureToken.address,
        137
      );

      return {
        native: {
          symbol: 'MATIC',
          balance: formatAmount(nativeBalance, 18),
          raw: nativeBalance.toString()
        },
        eure: {
          symbol: 'EURe',
          balance: formatAmount(eureBalance, eureToken.decimals),
          raw: eureBalance.toString(),
          address: eureToken.address
        }
      };
    } catch (error) {
      logger.error('Failed to get Polygon balance', {
        error: error.message,
        address
      });
      throw error;
    }
  }

  /**
   * Get Gnosis balances using viem v2
   * @param {string} address - Wallet address
   * @returns {Object} Gnosis balances
   */
  async getGnosisBalance(address) {
    try {
      const farmingPair = getFarmingPair();
      const lpToken = farmingPair.reward.token;
      
      // Get native xDAI balance using viem
      const nativeBalance = await this.gnosisClient.getBalance({
        address: address
      });
      
      // Get LP token balance using viem
      const lpBalance = await this.getTokenBalanceViem(
        address,
        lpToken.address,
        100
      );

      return {
        native: {
          symbol: 'xDAI',
          balance: formatAmount(nativeBalance, 18),
          raw: nativeBalance.toString()
        },
        lpToken: {
          symbol: 'LP-EURe',
          balance: formatAmount(lpBalance, lpToken.decimals),
          raw: lpBalance.toString(),
          address: lpToken.address
        }
      };
    } catch (error) {
      logger.error('Failed to get Gnosis balance', {
        error: error.message,
        address
      });
      throw error;
    }
  }

  /**
   * Get token balance using viem v2 readContract
   * @param {string} address - Wallet address
   * @param {string} tokenAddress - Token contract address
   * @param {number} chainId - Chain ID
   * @returns {bigint} Token balance
   */
  async getTokenBalanceViem(address, tokenAddress, chainId) {
    try {
      const client = chainId === 137 ? this.polygonClient : this.gnosisClient;
      
      const balance = await client.readContract({
        address: tokenAddress,
        abi: [
          {
            name: 'balanceOf',
            type: 'function',
            stateMutability: 'view',
            inputs: [{ name: 'account', type: 'address' }],
            outputs: [{ type: 'uint256' }]
          }
        ],
        functionName: 'balanceOf',
        args: [address]
      });
      
      return balance;
    } catch (error) {
      logger.error('Failed to get token balance', {
        error: error.message,
        address,
        tokenAddress,
        chainId
      });
      return 0n;
    }
  }

  /**
   * Update wallet balances in MongoDB
   * @param {Object} wallet - Wallet document
   * @param {Object} polygonBalance - Polygon balance data
   * @param {Object} gnosisBalance - Gnosis balance data
   */
  async updateWalletBalances(wallet, polygonBalance, gnosisBalance) {
    try {
      // Update Polygon balances
      await wallet.updateBalance(137, 'native', 'MATIC', polygonBalance.native.raw);
      await wallet.updateBalance(137, polygonBalance.eure.address, 'EURe', polygonBalance.eure.raw);
      
      // Update Gnosis balances
      await wallet.updateBalance(100, 'native', 'xDAI', gnosisBalance.native.raw);
      await wallet.updateBalance(100, gnosisBalance.lpToken.address, 'LP-EURe', gnosisBalance.lpToken.raw);
    } catch (error) {
      logger.error('Failed to update wallet balances in MongoDB', {
        error: error.message,
        address: wallet.address
      });
    }
  }

  /**
   * Deposit EURe for LP tokens using viem v2 with MongoDB persistence
   * @param {string} amount - Amount to deposit
   * @param {number} slippage - Slippage tolerance (default: 0.5%)
   * @param {string} userAddress - User's wallet address
   * @returns {Object} Transaction result with MongoDB tracking
   */
  async depositWithViem(amount, slippage = 0.5, userAddress = null) {
    const address = userAddress || this.account.address;
    const farmingPair = getFarmingPair();
    const eureToken = farmingPair.deposit.token;
    
    // Create transaction record in MongoDB
    const transaction = new Transaction({
      internalId: Transaction.generateInternalId(),
      userAddress: address,
      type: 'deposit',
      amount: parseAmount(amount, eureToken.decimals).toString(),
      tokenAddress: eureToken.address,
      tokenSymbol: 'EURe',
      fromChain: 137, // Polygon
      toChain: 100,   // Gnosis
      slippage: slippage,
      status: 'pending'
    });
    
    await transaction.save();
    
    try {
      logger.info('Starting deposit with viem v2', {
        transactionId: transaction.internalId,
        amount,
        slippage,
        userAddress: address
      });

      // 1. Approve EURe token spending using viem v2
      const amountWei = parseUnits(amount.toString(), eureToken.decimals);
      const ensoRouterAddress = process.env.ENSO_ROUTER_ADDRESS || '0x1234567890123456789012345678901234567890';
      
      // Check current allowance
      const currentAllowance = await this.polygonClient.readContract({
        address: eureToken.address,
        abi: [
          {
            name: 'allowance',
            type: 'function',
            stateMutability: 'view',
            inputs: [
              { name: 'owner', type: 'address' },
              { name: 'spender', type: 'address' }
            ],
            outputs: [{ type: 'uint256' }]
          }
        ],
        functionName: 'allowance',
        args: [address, ensoRouterAddress]
      });
      
      if (currentAllowance < amountWei) {
        const approveHash = await this.polygonWalletClient.writeContract({
          address: eureToken.address,
          abi: [
            {
              name: 'approve',
              type: 'function',
              stateMutability: 'nonpayable',
              inputs: [
                { name: 'spender', type: 'address' },
                { name: 'amount', type: 'uint256' }
              ],
              outputs: [{ type: 'bool' }]
            }
          ],
          functionName: 'approve',
          args: [ensoRouterAddress, amountWei]
        });
        
        // Wait for approval transaction
        await this.polygonClient.waitForTransactionReceipt({ hash: approveHash });
      }
      
      // 2. Execute deposit transaction using viem v2
      const depositHash = await this.polygonWalletClient.sendTransaction({
        to: ensoRouterAddress,
        data: '0x', // Placeholder for actual Enso SDK integration
        value: 0n,
        gas: 300000n
      });
      
      // Update transaction with hash
      transaction.txHash = depositHash;
      transaction.status = 'confirmed';
      await transaction.save();
      
      // 3. Wait for confirmation and update MongoDB
      const receipt = await this.polygonClient.waitForTransactionReceipt({ 
        hash: depositHash 
      });
      
      await transaction.markCompleted(depositHash, receipt.gasUsed, receipt.effectiveGasPrice);
      
      // Update wallet stats
      const wallet = await Wallet.findOrCreateWallet(address);
      await wallet.updateTransactionStats('deposit', receipt.gasUsed);
      
      return {
        transactionId: transaction.internalId,
        txHash: depositHash,
        amount,
        slippage,
        userAddress: address,
        status: 'completed',
        gasUsed: receipt.gasUsed.toString(),
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      logger.error('Deposit with viem v2 failed:', error);
      await transaction.markFailed(error);
      throw new Error(`Deposit failed: ${error.message}`);
    }
  }

  /**
   * Withdraw LP tokens for EURe using viem v2 with MongoDB persistence
   * @param {string} amount - Amount to withdraw
   * @param {number} slippage - Slippage tolerance (default: 0.5%)
   * @param {string} userAddress - User's wallet address
   * @returns {Object} Transaction result with MongoDB tracking
   */
  async withdrawWithViem(amount, slippage = 0.5, userAddress = null) {
    const address = userAddress || this.account.address;
    const farmingPair = getFarmingPair();
    const lpToken = farmingPair.reward.token;
    
    // Create transaction record in MongoDB
    const transaction = new Transaction({
      internalId: Transaction.generateInternalId(),
      userAddress: address,
      type: 'withdraw',
      amount: parseAmount(amount, lpToken.decimals).toString(),
      tokenAddress: lpToken.address,
      tokenSymbol: 'LP-EURe',
      fromChain: 100, // Gnosis
      toChain: 137,   // Polygon
      slippage: slippage,
      status: 'pending'
    });
    
    await transaction.save();
    
    try {
      logger.info('Starting withdraw with viem v2', {
        transactionId: transaction.internalId,
        amount,
        slippage,
        userAddress: address
      });

      // 1. Approve LP token spending using viem v2
      const amountWei = parseUnits(amount.toString(), lpToken.decimals);
      const ensoRouterAddress = process.env.ENSO_ROUTER_ADDRESS || '0x1234567890123456789012345678901234567890';
      
      // Check current allowance
      const currentAllowance = await this.gnosisClient.readContract({
        address: lpToken.address,
        abi: [
          {
            name: 'allowance',
            type: 'function',
            stateMutability: 'view',
            inputs: [
              { name: 'owner', type: 'address' },
              { name: 'spender', type: 'address' }
            ],
            outputs: [{ type: 'uint256' }]
          }
        ],
        functionName: 'allowance',
        args: [address, ensoRouterAddress]
      });
      
      if (currentAllowance < amountWei) {
        const approveHash = await this.gnosisWalletClient.writeContract({
          address: lpToken.address,
          abi: [
            {
              name: 'approve',
              type: 'function',
              stateMutability: 'nonpayable',
              inputs: [
                { name: 'spender', type: 'address' },
                { name: 'amount', type: 'uint256' }
              ],
              outputs: [{ type: 'bool' }]
            }
          ],
          functionName: 'approve',
          args: [ensoRouterAddress, amountWei]
        });
        
        // Wait for approval transaction
        await this.gnosisClient.waitForTransactionReceipt({ hash: approveHash });
      }
      
      // 2. Execute withdraw transaction using viem v2
      const withdrawHash = await this.gnosisWalletClient.sendTransaction({
        to: ensoRouterAddress,
        data: '0x', // Placeholder for actual Enso SDK integration
        value: 0n,
        gas: 300000n
      });
      
      // Update transaction with hash
      transaction.txHash = withdrawHash;
      transaction.status = 'confirmed';
      await transaction.save();
      
      // 3. Wait for confirmation and update MongoDB
      const receipt = await this.gnosisClient.waitForTransactionReceipt({ 
        hash: withdrawHash 
      });
      
      await transaction.markCompleted(withdrawHash, receipt.gasUsed, receipt.effectiveGasPrice);
      
      // Update wallet stats
      const wallet = await Wallet.findOrCreateWallet(address);
      await wallet.updateTransactionStats('withdraw', receipt.gasUsed);
      
      return {
        transactionId: transaction.internalId,
        txHash: withdrawHash,
        amount,
        slippage,
        userAddress: address,
        status: 'completed',
        gasUsed: receipt.gasUsed.toString(),
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      logger.error('Withdraw with viem v2 failed:', error);
      await transaction.markFailed(error);
      throw new Error(`Withdraw failed: ${error.message}`);
    }
  }

  /**
   * Auto-compound available earnings
   * @param {string} userAddress - User's wallet address
   * @returns {Object} Compound result or null if no earnings
   */
  async autoCompound(userAddress = null) {
    const address = userAddress || this.account.address;
    
    try {
      const earnings = await this.getEarnings(address);
      
      if (earnings && parseFloat(earnings) > 0.01) { // Minimum threshold
        logger.info('Auto-compounding earnings', {
          userAddress: address,
          earnings
        });
        
        return await this.depositWithMonitoring(earnings.toString(), 0.5, address);
      } else {
        logger.info('No earnings to compound', {
          userAddress: address,
          earnings
        });
        
        return {
          message: 'No earnings available to compound',
          earnings: earnings || '0',
          userAddress: address,
          timestamp: new Date().toISOString()
        };
      }
    } catch (error) {
      logger.error('Auto-compound failed', {
        error: error.message,
        userAddress: address
      });
      throw error;
    }
  }

  /**
   * Get available earnings for compounding
   * @param {string} address - User's wallet address
   * @returns {string} Available earnings amount
   */
  async getEarnings(address) {
    try {
      // Simulate earnings calculation
      // In a real implementation, this would query the LP contract for rewards
      const balance = await this.getGnosisBalance(address);
      const lpAmount = parseFloat(balance.lpToken.balance);
      
      // Simulate 1% earnings on LP tokens
      const earnings = lpAmount * 0.01;
      
      return earnings.toFixed(6);
    } catch (error) {
      logger.error('Failed to get earnings', {
        error: error.message,
        address
      });
      return '0';
    }
  }

  /**
   * Simulate deposit operation (placeholder for Enso SDK)
   * @param {string} amount - Amount to deposit
   * @param {number} slippage - Slippage tolerance
   * @param {string} address - User address
   * @returns {string} Transaction hash
   */
  async simulateDeposit(amount, slippage, address) {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Generate mock transaction hash
    const txHash = '0x' + Array.from({length: 64}, () => 
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
    
    logger.info('Simulated deposit transaction', {
      txHash,
      amount,
      slippage,
      address
    });
    
    return txHash;
  }

  /**
   * Simulate withdraw operation (placeholder for Enso SDK)
   * @param {string} amount - Amount to withdraw
   * @param {number} slippage - Slippage tolerance
   * @param {string} address - User address
   * @returns {string} Transaction hash
   */
  async simulateWithdraw(amount, slippage, address) {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Generate mock transaction hash
    const txHash = '0x' + Array.from({length: 64}, () => 
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
    
    logger.info('Simulated withdraw transaction', {
      txHash,
      amount,
      slippage,
      address
    });
    
    return txHash;
  }

  /**
   * Monitor cross-chain transaction status
   * @param {string} txHash - Transaction hash
   * @param {string} txId - Internal transaction ID
   * @returns {Object} Monitoring result
   */
  async monitorCrossChainTransaction(txHash, txId) {
    logger.info('Starting cross-chain transaction monitoring', {
      txHash,
      txId
    });

    try {
      // Simulate monitoring with retries
      const result = await retryWithBackoff(async () => {
        // Simulate checking transaction status
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Random success/failure for demonstration
        const success = Math.random() > 0.1; // 90% success rate
        
        if (!success) {
          throw new Error('Transaction still pending');
        }
        
        return {
          status: 'completed',
          confirmations: 12,
          gasUsed: '21000',
          blockNumber: Math.floor(Math.random() * 1000000) + 40000000
        };
      }, 3, 2000);

      logger.info('Cross-chain transaction completed', {
        txHash,
        txId,
        result
      });

      return result;
    } catch (error) {
      logger.error('Cross-chain transaction monitoring failed', {
        txHash,
        txId,
        error: error.message
      });
      
      return {
        status: 'failed',
        error: error.message
      };
    }
  }

  /**
   * Estimate gas costs for operations
   * @param {string} operation - Type of operation (deposit, withdraw, compound)
   * @param {string} amount - Amount for the operation
   * @returns {Object} Gas estimation
   */
  async estimateGas(operation, amount) {
    try {
      // Simulate gas estimation
      const baseGas = {
        deposit: 150000,
        withdraw: 120000,
        compound: 200000
      };

      const estimatedGas = baseGas[operation] || 100000;
      const gasPrice = await this.polygonProvider.getFeeData();
      
      const estimatedCost = ethers.formatEther(
        BigInt(estimatedGas) * gasPrice.gasPrice
      );

      return {
        operation,
        amount,
        estimatedGas,
        gasPrice: gasPrice.gasPrice.toString(),
        estimatedCost,
        currency: 'MATIC',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Gas estimation failed', {
        error: error.message,
        operation,
        amount
      });
      throw error;
    }
  }

  /**
   * Get Polygon balances using viem for enhanced functionality
   * @returns {Object} Polygon balances with viem integration
   */
  async getPolygonBalanceViem() {
    const EURE_TOKEN = '0x18ec0A6E18E5bc3784fDd3a3634b31245ab704F6';
    
    try {
      // Get native MATIC balance using viem
      const maticBalance = await this.polygonClient.getBalance({
        address: this.polygonWallet.address
      });
      
      // Get EURe token balance using ethers.js contract
      const eureContract = new ethers.Contract(
        EURE_TOKEN,
        ['function balanceOf(address) view returns (uint256)'],
        this.polygonProvider
      );
      
      const eureBalance = await eureContract.balanceOf(this.polygonWallet.address);
      
      return {
        matic: ethers.formatEther(maticBalance.toString()),
        eure: ethers.formatEther(eureBalance.toString()),
        address: this.polygonWallet.address
      };
    } catch (error) {
      logger.error('Failed to get Polygon balance with viem', {
        error: error.message,
        address: this.polygonWallet.address
      });
      throw error;
    }
  }

  /**
   * Get Gnosis balances using viem for enhanced functionality
   * @returns {Object} Gnosis balances with viem integration
   */
  async getGnosisBalanceViem() {
    const LP_TOKEN = '0xedbc7449a9b594ca4e053d9737ec5dc4cbccbfb2';
    
    try {
      // Get native xDAI balance using viem
      const xdaiBalance = await this.gnosisClient.getBalance({
        address: this.gnosisWallet.address
      });
      
      // Get LP token balance using ethers.js contract
      const lpContract = new ethers.Contract(
        LP_TOKEN,
        ['function balanceOf(address) view returns (uint256)'],
        this.gnosisProvider
      );
      
      const lpBalance = await lpContract.balanceOf(this.gnosisWallet.address);
      
      return {
        xdai: ethers.formatEther(xdaiBalance.toString()),
        lp: ethers.formatEther(lpBalance.toString()),
        address: this.gnosisWallet.address
      };
    } catch (error) {
      logger.error('Failed to get Gnosis balance with viem', {
        error: error.message,
        address: this.gnosisWallet.address
      });
      throw error;
    }
  }

  /**
   * Deposit EURe for LP tokens using ethers.js + viem integration
   * @param {string} amount - Amount to deposit
   * @returns {Object} Transaction result
   */
  async depositWithEthersViem(amount) {
    const EURE_TOKEN = '0x18ec0A6E18E5bc3784fDd3a3634b31245ab704F6';
    
    try {
      // 1. Approve EURe token spending using ethers.js
      const eureContract = new ethers.Contract(
        EURE_TOKEN,
        [
          'function approve(address spender, uint256 amount) returns (bool)',
          'function allowance(address owner, address spender) view returns (uint256)'
        ],
        this.polygonWallet
      );
      
      const amountWei = ethers.parseEther(amount.toString());
      
      // Check current allowance
      const currentAllowance = await eureContract.allowance(
        this.polygonWallet.address,
        process.env.ENSO_ROUTER_ADDRESS || '0x1234567890123456789012345678901234567890'
      );
      
      if (currentAllowance < amountWei) {
        const approveTx = await eureContract.approve(
          process.env.ENSO_ROUTER_ADDRESS || '0x1234567890123456789012345678901234567890',
          amountWei
        );
        await approveTx.wait();
      }
      
      // 2. Simulate Enso deposit transaction (placeholder for actual Enso SDK integration)
      const depositData = {
        to: process.env.ENSO_ROUTER_ADDRESS || '0x1234567890123456789012345678901234567890',
        data: '0x',
        value: 0n,
        gasLimit: 300000
      };
      
      // 3. Execute transaction using viem wallet client
      const txHash = await this.polygonWalletClient.sendTransaction({
        to: depositData.to,
        data: depositData.data,
        value: depositData.value,
        gas: BigInt(depositData.gasLimit)
      });
      
  /**
   * Get transaction history from MongoDB
   * @param {string} userAddress - User's wallet address
   * @param {Object} options - Query options
   * @returns {Array} Transaction history
   */
  async getTransactionHistory(userAddress, options = {}) {
    try {
      const transactions = await Transaction.findByUser(userAddress, options);
      return transactions.map(tx => tx.toSafeObject());
    } catch (error) {
      logger.error('Failed to get transaction history', {
        error: error.message,
        userAddress
      });
      throw error;
    }
  }

  /**
   * Get pending transactions for monitoring
   * @returns {Array} Pending transactions
   */
  async getPendingTransactions() {
    try {
      return await Transaction.findPendingTransactions();
    } catch (error) {
      logger.error('Failed to get pending transactions', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Monitor cross-chain transaction using viem v2
   * @param {string} txHash - Transaction hash
   * @param {string} operation - Operation type (deposit/withdraw)
   * @returns {Object} Monitoring result
   */
  async monitorCrossChainTransactionViem(txHash, operation) {
    logger.info(`Starting cross-chain monitoring for ${operation}`, { txHash });
    
    try {
      // Determine which client to use based on operation
      const client = operation === 'deposit' ? this.polygonClient : this.gnosisClient;
      
      // Wait for transaction confirmation
      const receipt = await client.waitForTransactionReceipt({ 
        hash: txHash,
        timeout: 300000 // 5 minutes
      });
      
      logger.info(`Transaction ${operation} confirmed`, {
        txHash,
        gasUsed: receipt.gasUsed.toString(),
        status: receipt.status
      });
      
      return {
        txHash,
        status: receipt.status === 'success' ? 'completed' : 'failed',
        gasUsed: receipt.gasUsed.toString(),
        blockNumber: receipt.blockNumber,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      logger.error(`Cross-chain monitoring failed for ${operation}`, {
        txHash,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Estimate gas for operations using viem v2
   * @param {string} operation - Operation type (deposit/withdraw)
   * @param {string} amount - Amount for the operation
   * @returns {Object} Gas estimation
   */
  async estimateGasViem(operation, amount) {
    try {
      const farmingPair = getFarmingPair();
      const ensoRouterAddress = process.env.ENSO_ROUTER_ADDRESS || '0x1234567890123456789012345678901234567890';
      
      let client, tokenAddress, decimals;
      
      if (operation === 'deposit') {
        client = this.polygonClient;
        tokenAddress = farmingPair.deposit.token.address;
        decimals = farmingPair.deposit.token.decimals;
      } else {
        client = this.gnosisClient;
        tokenAddress = farmingPair.reward.token.address;
        decimals = farmingPair.reward.token.decimals;
      }
      
      // Estimate gas for the transaction
      const gasEstimate = await client.estimateGas({
        account: this.account,
        to: ensoRouterAddress,
        data: '0x', // Placeholder for actual Enso SDK integration
        value: 0n
      });
      
      // Get current gas price
      const gasPrice = await client.getGasPrice();
      
      // Calculate estimated cost
      const estimatedCost = formatUnits(gasEstimate * gasPrice, 18);
      
      return {
        gasLimit: gasEstimate.toString(),
        gasPrice: gasPrice.toString(),
        estimatedCost,
        estimatedCostWei: (gasEstimate * gasPrice).toString()
      };
      
    } catch (error) {
      logger.error('Gas estimation failed', {
        operation,
        amount,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Auto-compound available earnings
   * @param {string} userAddress - User's wallet address
   * @returns {Object} Compound result or null if no earnings
   */
  async autoCompound(userAddress = null) {
    const address = userAddress || this.account.address;
    
    try {
      const balances = await this.getBalances(address);
      const lpBalance = parseFloat(balances.gnosis.lpToken.balance);
      
      if (lpBalance > 0.01) { // Minimum threshold
        logger.info('Auto-compounding earnings', {
          userAddress: address,
          lpBalance
        });
        
        return await this.withdrawWithViem(lpBalance.toString(), 0.5, address);
      } else {
        logger.info('No earnings to compound', {
          userAddress: address,
          lpBalance
        });
        return null;
      }
    } catch (error) {
      logger.error('Auto-compound failed', {
        userAddress: address,
        error: error.message
      });
      throw error;
    }
  }
}

  /**
   * Withdraw LP tokens for EURe using ethers.js + viem integration
   * @param {string} amount - Amount to withdraw
   * @returns {Object} Transaction result
   */
  async withdrawWithEthersViem(amount) {
    const LP_TOKEN = '0xedbc7449a9b594ca4e053d9737ec5dc4cbccbfb2';
    
    try {
      // 1. Approve LP token spending using ethers.js
      const lpContract = new ethers.Contract(
        LP_TOKEN,
        [
          'function approve(address spender, uint256 amount) returns (bool)',
          'function allowance(address owner, address spender) view returns (uint256)'
        ],
        this.gnosisWallet
      );
      
      const amountWei = ethers.parseEther(amount.toString());
      
      // Check current allowance
      const currentAllowance = await lpContract.allowance(
        this.gnosisWallet.address,
        process.env.ENSO_ROUTER_ADDRESS || '0x1234567890123456789012345678901234567890'
      );
      
      if (currentAllowance < amountWei) {
        const approveTx = await lpContract.approve(
          process.env.ENSO_ROUTER_ADDRESS || '0x1234567890123456789012345678901234567890',
          amountWei
        );
        await approveTx.wait();
      }
      
      // 2. Simulate Enso withdrawal transaction (placeholder for actual Enso SDK integration)
      const withdrawData = {
        to: process.env.ENSO_ROUTER_ADDRESS || '0x1234567890123456789012345678901234567890',
        data: '0x',
        value: 0n,
        gasLimit: 300000
      };
      
      // 3. Execute transaction using viem wallet client
      const txHash = await this.gnosisWalletClient.sendTransaction({
        to: withdrawData.to,
        data: withdrawData.data,
        value: withdrawData.value,
        gas: BigInt(withdrawData.gasLimit)
      });
      
      // 4. Monitor cross-chain transaction
      return this.monitorCrossChainTransactionViem(txHash, 'withdraw');
      
    } catch (error) {
      logger.error('Withdrawal with ethers+viem failed:', error);
      throw new Error(`Withdrawal failed: ${error.message}`);
    }
  }

  /**
   * Monitor cross-chain transaction using viem
   * @param {string} txHash - Transaction hash
   * @param {string} operation - Operation type (deposit/withdraw)
   * @returns {Object} Monitoring result
   */
  async monitorCrossChainTransactionViem(txHash, operation) {
    const transactionId = `${operation}_${Date.now()}`;
    
    try {
      // Monitor source chain transaction
      const sourceChain = operation === 'deposit' ? this.polygonClient : this.gnosisClient;
      
      const receipt = await sourceChain.waitForTransactionReceipt({
        hash: txHash,
        timeout: 300000 // 5 minutes
      });
      
      if (receipt.status === 'success') {
        // Simulate destination chain monitoring
        logger.info('Cross-chain transaction monitoring started', {
          transactionId,
          operation,
          sourceHash: txHash,
          status: receipt.status
        });
        
        return {
          transactionId,
          sourceHash: txHash,
          status: 'completed',
          operation,
          receipt: {
            blockNumber: receipt.blockNumber.toString(),
            gasUsed: receipt.gasUsed.toString(),
            status: receipt.status
          }
        };
      } else {
        throw new Error('Source transaction failed');
      }
      
    } catch (error) {
      logger.error('Transaction monitoring failed:', error);
      throw error;
    }
  }

  /**
   * Estimate gas for operations using viem
   * @param {string} operation - Operation type (deposit/withdraw)
   * @param {string} amount - Amount for the operation
   * @returns {Object} Gas estimation with viem
   */
  async estimateGasViem(operation, amount) {
    try {
      const client = operation === 'deposit' ? this.polygonWalletClient : this.gnosisWalletClient;
      
      // Simulate transaction data (placeholder for actual Enso routes)
      const routeData = {
        to: process.env.ENSO_ROUTER_ADDRESS || '0x1234567890123456789012345678901234567890',
        data: '0x',
        value: 0n
      };
      
      // Estimate gas using viem
      const gasEstimate = await client.estimateGas({
        to: routeData.to,
        data: routeData.data,
        value: routeData.value
      });
      
      // Get current gas price
      const gasPrice = await client.getGasPrice();
      
      return {
        gasLimit: gasEstimate.toString(),
        gasPrice: gasPrice.toString(),
        estimatedCost: ethers.formatEther((gasEstimate * gasPrice).toString()),
        operation,
        amount,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      logger.error('Gas estimation with viem failed:', error);
      throw error;
    }
  }

  /**
   * Cache management methods
   */
  getCachedData(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    return null;
  }

  setCachedData(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  clearCache() {
    this.cache.clear();
  }
}

module.exports = EnsoYieldFarming;