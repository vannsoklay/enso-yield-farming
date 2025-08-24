// useContract.js - Custom hook for contract interactions with viem v2
import { useEffect, useState } from 'react';
import { readContract, writeContract } from 'viem/actions';
import { useWeb3 } from '../context/Web3Context';

export const useContract = (address, abi, chainId) => {
  const { walletClient, clients, chainId: currentChainId } = useWeb3();
  const [isCorrectChain, setIsCorrectChain] = useState(false);

  useEffect(() => {
    setIsCorrectChain(!chainId || currentChainId === chainId);
  }, [chainId, currentChainId]);

  const readContractMethod = async (functionName, args = []) => {
    if (!address || !abi || !isCorrectChain) {
      throw new Error('Contract not available or wrong chain');
    }

    const client = chainId === 137 ? clients.polygon : clients.gnosis;
    if (!client) {
      throw new Error('Client not available for the specified chain');
    }

    return await readContract(client, {
      address,
      abi,
      functionName,
      args
    });
  };

  const writeContractMethod = async (functionName, args = [], options = {}) => {
    if (!address || !abi || !isCorrectChain || !walletClient) {
      throw new Error('Contract not available, wrong chain, or wallet not connected');
    }

    return await writeContract(walletClient, {
      address,
      abi,
      functionName,
      args,
      ...options
    });
  };

  return { 
    readContract: readContractMethod, 
    writeContract: writeContractMethod,
    isCorrectChain
  };
};

export default useContract;