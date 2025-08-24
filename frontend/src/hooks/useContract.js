// useContract.js - Custom hook for contract interactions with ethers.js + viem
import { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { useWeb3 } from '../context/Web3Context';

export const useContract = (address, abi, chainId) => {
  const { provider, signer, clients, chainId: currentChainId } = useWeb3();
  const [contract, setContract] = useState(null);
  const [readOnlyContract, setReadOnlyContract] = useState(null);
  const [isCorrectChain, setIsCorrectChain] = useState(false);

  useEffect(() => {
    if (provider && signer && address && abi) {
      try {
        // Create contract instance with signer for write operations
        const contractWithSigner = new ethers.Contract(address, abi, signer);
        setContract(contractWithSigner);

        // Create read-only contract instance
        const readContract = new ethers.Contract(address, abi, provider);
        setReadOnlyContract(readContract);

        // Check if we're on the correct chain
        setIsCorrectChain(!chainId || currentChainId === chainId);
      } catch (error) {
        console.error('Error creating contract:', error);
        setContract(null);
        setReadOnlyContract(null);
        setIsCorrectChain(false);
      }
    } else {
      setContract(null);
      setReadOnlyContract(null);
      setIsCorrectChain(false);
    }
  }, [provider, signer, address, abi, chainId, currentChainId]);

  return { 
    contract: isCorrectChain ? contract : null, 
    readOnlyContract: isCorrectChain ? readOnlyContract : null,
    isCorrectChain
  };
};

export default useContract;