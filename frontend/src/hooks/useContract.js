// useContract.js - Custom hook for contract interactions with viem v2
import { useEffect, useState, useCallback } from 'react';
import { useWeb3 } from '../context/Web3Context';

export const useContract = (address, abi, chainId) => {
  const { publicClient, walletClient, clients, chainId: currentChainId } = useWeb3();
  const [isCorrectChain, setIsCorrectChain] = useState(false);

  useEffect(() => {
    // Check if we're on the correct chain
    setIsCorrectChain(!chainId || currentChainId === chainId);
  }, [chainId, currentChainId]);

  const readContract = useCallback(async (functionName, args = []) => {
    if (!address || !abi || !isCorrectChain) {
      throw new Error('Contract not available or incorrect chain');
    }

    const client = chainId ? 
      (chainId === 137 ? clients.polygon : clients.gnosis) : 
      publicClient;

    if (!client) {
      throw new Error('Public client not available');
    }

    return await client.readContract({
      address,
      abi,
      functionName,
      args
    });
  }, [address, abi, chainId, isCorrectChain, clients, publicClient]);

  const writeContract = useCallback(async (functionName, args = [], options = {}) => {
    if (!address || !abi || !isCorrectChain || !walletClient) {
      throw new Error('Contract not available, incorrect chain, or wallet not connected');
    }

    const hash = await walletClient.writeContract({
      address,
      abi,
      functionName,
      args,
      ...options
    });

    return hash;
  }, [address, abi, isCorrectChain, walletClient]);

  const estimateGas = useCallback(async (functionName, args = [], options = {}) => {
    if (!address || !abi || !isCorrectChain) {
      throw new Error('Contract not available or incorrect chain');
    }

    const client = chainId ? 
      (chainId === 137 ? clients.polygon : clients.gnosis) : 
      publicClient;

    if (!client) {
      throw new Error('Public client not available');
    }

    return await client.estimateContractGas({
      address,
      abi,
      functionName,
      args,
      ...options
    });
  }, [address, abi, chainId, isCorrectChain, clients, publicClient]);

  return { 
    readContract,
    writeContract,
    estimateGas,
    isCorrectChain,
    address,
    abi
  };
};

export default useContract;