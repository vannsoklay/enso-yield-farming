// useContract.js - Custom hook for contract interactions with viem v2
import { useCallback } from 'react';
import { readContract, writeContract } from 'viem/actions';
import { useWeb3 } from '../context/Web3Context';

export const useContract = (address, abi, chainId) => {
  const { walletClient, publicClients, chainId: currentChainId } = useWeb3();
  
  const isCorrectChain = !chainId || currentChainId === chainId;
  const client = chainId === 137 ? publicClients.polygon : publicClients.gnosis;

  const read = useCallback(async (functionName, args = []) => {
    if (!client || !address || !abi || !isCorrectChain) {
      throw new Error('Contract read not available');
    }

    return await readContract(client, {
      address,
      abi,
      functionName,
      args
    });
  }, [client, address, abi, isCorrectChain]);

  const write = useCallback(async (functionName, args = [], options = {}) => {
    if (!walletClient || !address || !abi || !isCorrectChain) {
      throw new Error('Contract write not available');
    }

    return await writeContract(walletClient, {
      address,
      abi,
      functionName,
      args,
      ...options
    });
  }, [walletClient, address, abi, isCorrectChain]);

  return { 
    read,
    write,
    isCorrectChain,
    client: isCorrectChain ? client : null
  };
};

export default useContract;