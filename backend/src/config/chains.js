// Chain configurations for supported networks
const CHAINS = {
  POLYGON: {
    chainId: 137,
    name: 'Polygon',
    rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
    blockExplorer: 'https://polygonscan.com',
    nativeCurrency: {
      symbol: 'MATIC',
      decimals: 18
    }
  },
  GNOSIS: {
    chainId: 100,
    name: 'Gnosis',
    rpcUrl: process.env.GNOSIS_RPC_URL || 'https://rpc.gnosischain.com',
    blockExplorer: 'https://gnosisscan.io',
    nativeCurrency: {
      symbol: 'xDAI',
      decimals: 18
    }
  }
};

// Get chain configuration by chain ID
const getChainConfig = (chainId) => {
  const chain = Object.values(CHAINS).find(c => c.chainId === chainId);
  if (!chain) {
    throw new Error(`Unsupported chain ID: ${chainId}`);
  }
  return chain;
};

// Get chain configuration by name
const getChainByName = (name) => {
  const chainName = name.toUpperCase();
  if (!CHAINS[chainName]) {
    throw new Error(`Unsupported chain name: ${name}`);
  }
  return CHAINS[chainName];
};

// Get all supported chain IDs
const getSupportedChainIds = () => {
  return Object.values(CHAINS).map(chain => chain.chainId);
};

// Check if chain ID is supported
const isChainSupported = (chainId) => {
  return getSupportedChainIds().includes(chainId);
};

// Get RPC URL for chain
const getRpcUrl = (chainId) => {
  const chain = getChainConfig(chainId);
  return chain.rpcUrl;
};

// Get block explorer URL for transaction
const getTransactionUrl = (chainId, txHash) => {
  const chain = getChainConfig(chainId);
  return `${chain.blockExplorer}/tx/${txHash}`;
};

// Get block explorer URL for address
const getAddressUrl = (chainId, address) => {
  const chain = getChainConfig(chainId);
  return `${chain.blockExplorer}/address/${address}`;
};

module.exports = {
  CHAINS,
  getChainConfig,
  getChainByName,
  getSupportedChainIds,
  isChainSupported,
  getRpcUrl,
  getTransactionUrl,
  getAddressUrl
};