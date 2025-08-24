// Web3Context.jsx - Enhanced Web3 integration with ethers.js + viem
import React, { createContext, useContext, useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { createPublicClient, createWalletClient, http } from 'viem';
import { polygon, gnosis } from 'viem/chains';

const Web3Context = createContext();

export const useWeb3 = () => {
  const context = useContext(Web3Context);
  if (!context) {
    throw new Error('useWeb3 must be used within Web3Provider');
  }
  return context;
};

export const Web3Provider = ({ children }) => {
  const [account, setAccount] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [clients, setClients] = useState({});
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    initializeWeb3();
    
    // Listen for account changes
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);
    }

    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, []);

  const handleAccountsChanged = (accounts) => {
    if (accounts.length === 0) {
      // User disconnected
      setAccount(null);
      setProvider(null);
      setSigner(null);
    } else {
      setAccount(accounts[0]);
      initializeWeb3();
    }
  };

  const handleChainChanged = (newChainId) => {
    setChainId(parseInt(newChainId, 16));
    initializeWeb3();
  };

  const initializeWeb3 = async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        // Initialize ethers provider
        const web3Provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await web3Provider.listAccounts();
        
        if (accounts.length > 0) {
          const web3Signer = await web3Provider.getSigner();
          const address = await web3Signer.getAddress();
          const network = await web3Provider.getNetwork();

          setProvider(web3Provider);
          setSigner(web3Signer);
          setAccount(address);
          setChainId(Number(network.chainId));
        }

        // Initialize viem clients
        const polygonClient = createPublicClient({
          chain: polygon,
          transport: http()
        });

        const gnosisClient = createPublicClient({
          chain: gnosis,
          transport: http()
        });

        setClients({
          polygon: polygonClient,
          gnosis: gnosisClient
        });

      } catch (error) {
        console.error('Web3 initialization failed:', error);
      }
    }
  };

  const connectWallet = async () => {
    setIsConnecting(true);
    try {
      if (typeof window.ethereum === 'undefined') {
        throw new Error('MetaMask is not installed');
      }
      
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      await initializeWeb3();
    } catch (error) {
      console.error('Wallet connection failed:', error);
      throw error;
    } finally {
      setIsConnecting(false);
    }
  };

  const switchToPolygon = async () => {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x89' }], // Polygon
      });
    } catch (error) {
      if (error.code === 4902) {
        // Chain not added to MetaMask
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: '0x89',
            chainName: 'Polygon',
            nativeCurrency: {
              name: 'MATIC',
              symbol: 'MATIC',
              decimals: 18
            },
            rpcUrls: ['https://polygon-rpc.com/'],
            blockExplorerUrls: ['https://polygonscan.com/']
          }]
        });
      } else {
        console.error('Chain switch failed:', error);
        throw error;
      }
    }
  };

  const switchToGnosis = async () => {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x64' }], // Gnosis
      });
    } catch (error) {
      if (error.code === 4902) {
        // Chain not added to MetaMask
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: '0x64',
            chainName: 'Gnosis',
            nativeCurrency: {
              name: 'xDAI',
              symbol: 'xDAI',
              decimals: 18
            },
            rpcUrls: ['https://rpc.gnosischain.com'],
            blockExplorerUrls: ['https://gnosisscan.io/']
          }]
        });
      } else {
        console.error('Chain switch failed:', error);
        throw error;
      }
    }
  };

  const disconnect = async () => {
    setAccount(null);
    setProvider(null);
    setSigner(null);
    setChainId(null);
  };

  const value = {
    account,
    chainId,
    provider,
    signer,
    clients,
    isConnecting,
    connectWallet,
    disconnect,
    switchToPolygon,
    switchToGnosis,
    isConnected: !!account,
    isPolygon: chainId === 137,
    isGnosis: chainId === 100
  };

  return (
    <Web3Context.Provider value={value}>
      {children}
    </Web3Context.Provider>
  );
};