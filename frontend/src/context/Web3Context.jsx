// Web3Context.jsx - Viem v2 Web3 integration
import React, { createContext, useContext, useEffect, useState } from 'react';
import { createPublicClient, createWalletClient, custom, http } from 'viem';
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
  const [publicClient, setPublicClient] = useState(null);
  const [walletClient, setWalletClient] = useState(null);
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
      setPublicClient(null);
      setWalletClient(null);
      setClients({});
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
        // Get accounts using viem approach
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        
        if (accounts.length > 0) {
          const currentAccount = accounts[0];
          const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' });
          const currentChainId = parseInt(chainIdHex, 16);

          setAccount(currentAccount);
          setChainId(currentChainId);

          // Create wallet client with browser transport
          const currentWalletClient = createWalletClient({
            transport: custom(window.ethereum)
          });
          
          // Create public client for current chain
          let currentPublicClient;
          if (currentChainId === 137) {
            currentPublicClient = createPublicClient({
              chain: polygon,
              transport: custom(window.ethereum)
            });
          } else if (currentChainId === 100) {
            currentPublicClient = createPublicClient({
              chain: gnosis,
              transport: custom(window.ethereum)
            });
          } else {
            // Default to polygon for unsupported chains
            currentPublicClient = createPublicClient({
              chain: polygon,
              transport: http()
            });
          }

          setWalletClient(currentWalletClient);
          setPublicClient(currentPublicClient);
        }

        // Initialize dedicated clients for each chain
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

  const getNetwork = () => {
    return chainId;
  };

  const getAddress = () => {
    return account;
  };

  const switchChain = async (targetChainId) => {
    if (targetChainId === 137) {
      await switchToPolygon();
    } else if (targetChainId === 100) {
      await switchToGnosis();
    } else {
      throw new Error(`Unsupported chain ID: ${targetChainId}`);
    }
  };

  const disconnect = async () => {
    setAccount(null);
    setPublicClient(null);
    setWalletClient(null);
    setChainId(null);
    setClients({});
  };

  const value = {
    account,
    chainId,
    publicClient,
    walletClient,
    clients,
    isConnecting,
    connectWallet,
    disconnect,
    switchToPolygon,
    switchToGnosis,
    switchChain,
    getNetwork,
    getAddress,
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