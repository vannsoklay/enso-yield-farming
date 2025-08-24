// useTokenBalance.js - Enhanced balance hook with viem v2 integration
import { useEffect, useState, useCallback } from 'react';
import { readContract, getBalance } from 'viem/actions';
import { formatUnits } from 'viem';
import { useWeb3 } from '../context/Web3Context';

export const useTokenBalance = (tokenAddress, chainId) => {
  const { account, clients, chainId: currentChainId } = useWeb3();
  const [balance, setBalance] = useState('0');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchBalance = useCallback(async () => {
    if (!account || !tokenAddress || !clients || (chainId && currentChainId !== chainId)) {
      setBalance('0');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const client = chainId === 137 ? clients.polygon : clients.gnosis;
      
      if (!client) {
        throw new Error('Client not available for the specified chain');
      }
      
      if (tokenAddress === 'native') {
        // Get native token balance using viem client
        const balance = await getBalance(client, {
          address: account
        });
        setBalance(formatUnits(balance, 18));
      } else {
        // Get ERC20 token balance using viem
        try {
          const balance = await readContract(client, {
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
            args: [account]
          });
          setBalance(formatUnits(balance, 18));
        } catch (contractError) {
          // Fallback: might not be a standard ERC20 token
          console.warn('Failed to read contract balance:', contractError);
          setBalance('0');
        }
      }
    } catch (error) {
      console.error('Balance fetch failed:', error);
      setError(error.message);
      setBalance('0');
    } finally {
      setLoading(false);
    }
  }, [account, tokenAddress, chainId, currentChainId, clients]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  return { 
    balance, 
    loading, 
    error,
    refetch: fetchBalance 
  };
};

export default useTokenBalance;