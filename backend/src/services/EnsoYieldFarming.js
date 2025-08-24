const { createPublicClient, createWalletClient, http, formatUnits, parseUnits } = require('viem');
const { readContract, writeContract } = require('viem/actions');
const { polygon, gnosis } = require('viem/chains');
const { privateKeyToAccount } = require('viem/accounts');
const logger = require('../utils/logger');
const { retryWithBackoff, generateTxId, formatAmount, parseAmount } = require('../utils/helpers');
const { getChainConfig, getRpcUrl } = require('../config/chains');
const { getFarmingPair, getTokenByAddress } = require('../config/tokens');

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
      walletAddress: this.wallet.address,
      polygonRpc: getRpcUrl(137),
      gnosisRpc: getRpcUrl(100)
    });
  }

  /**
   * Get balances from both chains using viem v2
   * @param {string} userAddress - User's wallet address
   * @returns {Object} Balances from both chains
   */
  async getBalances(userAddress = null) {
    const address = userAddress || this.account.address;
    const cacheKey = `balances_${address}`;
    
    // Check cache first
    const cached = this.getCachedData(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const [polygonBalance, gnosisBalance] = await Promise.all([
        this.getPolygonBalanceViem(),
        this.getGnosisBalanceViem()
      ]);

      const balances = {
        polygon: polygonBalance,
        gnosis: gnosisBalance,
        timestamp: new Date().toISOString()
      };

      // Cache the result
      this.setCachedData(cacheKey, balances);
      
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
   * Get Polygon balances (EURe and MATIC)
   * @param {string} address - Wallet address
   * @returns {Object} Polygon balances
   */
  async getPolygonBalance(address) {
    try {
      const farmingPair = getFarmingPair();
      const eureToken = farmingPair.deposit.token;
      
      // Get native MATIC balance
      const nativeBalance = await this.polygonProvider.getBalance(address);
      
      // Get EURe token balance
      const eureBalance = await this.getTokenBalance(
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
   * Get Gnosis balances (xDAI and LP tokens)
   * @param {string} address - Wallet address
   * @returns {Object} Gnosis balances
   */
  async getGnosisBalance(address) {
    try {
      const farmingPair = getFarmingPair();
      const lpToken = farmingPair.reward.token;
      
      // Get native xDAI balance
      const nativeBalance = await this.gnosisProvider.getBalance(address);
      
      // Get LP token balance
      const lpBalance = await this.getTokenBalance(
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
   * Get token balance using ERC20 contract
   * @param {string} address - Wallet address
   * @param {string} tokenAddress - Token contract address
   * @param {number} chainId - Chain ID
   * @returns {bigint} Token balance
   */
  async getTokenBalance(address, tokenAddress, chainId) {
    try {
      const client = chainId === 137 ? this.polygonClient : this.gnosisClient;
      
      // ERC20 ABI for balanceOf function
      const erc20Abi = [{
        name: 'balanceOf',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'owner', type: 'address' }],
        outputs: [{ type: 'uint256' }]
      }];
      
      return await readContract(client, {
        address: tokenAddress,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [address]
      });
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
   * Deposit EURe for LP tokens with monitoring
   * @param {string} amount - Amount to deposit
   * @param {number} slippage - Slippage tolerance (default: 0.5%)
   * @param {string} userAddress - User's wallet address
   * @returns {Object} Transaction result with monitoring
   */
  async depositWithMonitoring(amount, slippage = 0.5, userAddress = null) {
    const txId = generateTxId();
    const address = userAddress || this.account.address;
    
    logger.info('Starting deposit with monitoring', {
      txId,
      amount,
      slippage,
      userAddress: address
    });

    try {
      // Simulate Enso SDK deposit operation
      const txHash = await this.simulateDeposit(amount, slippage, address);
      
      // Start monitoring the cross-chain transaction
      const monitoringResult = await this.monitorCrossChainTransaction(txHash, txId);
      
      return {
        txId,
        txHash,
        amount,
        slippage,
        userAddress: address,
        status: 'initiated',
        monitoring: monitoringResult,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Deposit failed', {
        txId,
        error: error.message,
        amount,
        userAddress: address
      });
      throw error;
    }
  }

  /**
   * Withdraw LP tokens for EURe with monitoring
   * @param {string} amount - Amount to withdraw
   * @param {number} slippage - Slippage tolerance (default: 0.5%)
   * @param {string} userAddress - User's wallet address
   * @returns {Object} Transaction result with monitoring
   */
  async withdrawWithMonitoring(amount, slippage = 0.5, userAddress = null) {
    const txId = generateTxId();
    const address = userAddress || this.account.address;
    
    logger.info('Starting withdraw with monitoring', {
      txId,
      amount,
      slippage,
      userAddress: address
    });

    try {
      // Simulate Enso SDK withdraw operation
      const txHash = await this.simulateWithdraw(amount, slippage, address);
      
      // Start monitoring the cross-chain transaction
      const monitoringResult = await this.monitorCrossChainTransaction(txHash, txId);
      
      return {
        txId,
        txHash,
        amount,
        slippage,
        userAddress: address,
        status: 'initiated',
        monitoring: monitoringResult,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Withdraw failed', {
        txId,
        error: error.message,
        amount,
        userAddress: address
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
      // Get current gas price from polygon client
      const gasPrice = await this.polygonClient.getGasPrice();
      
      const estimatedCost = formatUnits(
        BigInt(estimatedGas) * gasPrice, 18
      );

      return {
        operation,
        amount,
        estimatedGas,
        gasPrice: gasPrice.toString(),
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
        address: this.account.address
      });
      
      // Get EURe token balance using viem
      const eureBalance = await readContract(this.polygonClient, {
        address: EURE_TOKEN,
        abi: [{
          name: 'balanceOf',
          type: 'function',
          stateMutability: 'view',
          inputs: [{ name: 'account', type: 'address' }],
          outputs: [{ type: 'uint256' }]
        }],
        functionName: 'balanceOf',
        args: [this.account.address]
      });
      
      return {
        matic: formatUnits(maticBalance, 18),
        eure: formatUnits(eureBalance, 18),
        address: this.account.address
      };
    } catch (error) {
      logger.error('Failed to get Polygon balance with viem', {
        error: error.message,
        address: this.account.address
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
        address: this.account.address
      });
      
      // Get LP token balance using viem
      const lpBalance = await readContract(this.gnosisClient, {
        address: LP_TOKEN,
        abi: [{
          name: 'balanceOf',
          type: 'function',
          stateMutability: 'view',
          inputs: [{ name: 'account', type: 'address' }],
          outputs: [{ type: 'uint256' }]
        }],
        functionName: 'balanceOf',
        args: [this.account.address]
      });
      
      return {
        xdai: formatUnits(xdaiBalance, 18),
        lp: formatUnits(lpBalance, 18),
        address: this.account.address
      };
    } catch (error) {
      logger.error('Failed to get Gnosis balance with viem', {
        error: error.message,
        address: this.account.address
      });
      throw error;
    }
  }

  /**
   * Deposit EURe for LP tokens using viem v2
   * @param {string} amount - Amount to deposit
   * @returns {Object} Transaction result
   */
  async depositWithEthersViem(amount) {
    const EURE_TOKEN = '0x18ec0A6E18E5bc3784fDd3a3634b31245ab704F6';
    const ERC20_ABI = [
      {
        name: 'approve',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
          { name: 'spender', type: 'address' },
          { name: 'amount', type: 'uint256' }
        ],
        outputs: [{ type: 'bool' }]
      },
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
    ];
    
    try {
      const amountWei = parseUnits(amount.toString(), 18);
      const routerAddress = process.env.ENSO_ROUTER_ADDRESS || '0x1234567890123456789012345678901234567890';
      
      // 1. Check current allowance using viem
      const currentAllowance = await readContract(this.polygonClient, {
        address: EURE_TOKEN,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [this.account.address, routerAddress]
      });
      
      if (currentAllowance < amountWei) {
        // 2. Approve EURe token spending using viem
        const approveTxHash = await writeContract(this.polygonWalletClient, {
          address: EURE_TOKEN,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [routerAddress, amountWei]
        });
        
        // Wait for approval confirmation (simplified)
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      
      // 3. Simulate Enso deposit transaction
      const depositData = {
        to: routerAddress,
        data: '0x',
        value: 0n,
        gas: 300000n
      };
      
      // 4. Execute transaction using viem wallet client
      const txHash = await this.polygonWalletClient.sendTransaction(depositData);
      
      // 5. Monitor cross-chain transaction
      return this.monitorCrossChainTransactionViem(txHash, 'deposit');
      
    } catch (error) {
      logger.error('Deposit with viem failed:', error);
      throw new Error(`Deposit failed: ${error.message}`);
    }
  }

  /**
   * Withdraw LP tokens for EURe using viem v2
   * @param {string} amount - Amount to withdraw
   * @returns {Object} Transaction result
   */
  async withdrawWithEthersViem(amount) {
    const LP_TOKEN = '0xedbc7449a9b594ca4e053d9737ec5dc4cbccbfb2';
    const ERC20_ABI = [
      {
        name: 'approve',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
          { name: 'spender', type: 'address' },
          { name: 'amount', type: 'uint256' }
        ],
        outputs: [{ type: 'bool' }]
      },
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
    ];
    
    try {
      const amountWei = parseUnits(amount.toString(), 18);
      const routerAddress = process.env.ENSO_ROUTER_ADDRESS || '0x1234567890123456789012345678901234567890';
      
      // 1. Check current allowance using viem
      const currentAllowance = await readContract(this.gnosisClient, {
        address: LP_TOKEN,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [this.account.address, routerAddress]
      });
      
      if (currentAllowance < amountWei) {
        // 2. Approve LP token spending using viem
        const approveTxHash = await writeContract(this.gnosisWalletClient, {
          address: LP_TOKEN,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [routerAddress, amountWei]
        });
        
        // Wait for approval confirmation (simplified)
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      
      // 3. Simulate Enso withdrawal transaction
      const withdrawData = {
        to: routerAddress,
        data: '0x',
        value: 0n,
        gas: 300000n
      };
      
      // 4. Execute transaction using viem wallet client
      const txHash = await this.gnosisWalletClient.sendTransaction(withdrawData);
      
      // 5. Monitor cross-chain transaction
      return this.monitorCrossChainTransactionViem(txHash, 'withdraw');
      
    } catch (error) {
      logger.error('Withdraw with viem failed:', error);
      throw new Error(`Withdraw failed: ${error.message}`);
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
        estimatedCost: formatUnits((gasEstimate * gasPrice), 18),
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