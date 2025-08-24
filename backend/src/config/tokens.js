// Token configurations for supported networks
const TOKENS = {
  // Polygon tokens
  POLYGON: {
    EURe: {
      address: '0x18ec0A6E18E5bc3784fDd3a3634b31245ab704F6',
      symbol: 'EURe',
      name: 'Monerium EUR emoney',
      decimals: 18,
      chainId: 137,
      isStable: true,
      coingeckoId: 'monerium-eur-money'
    },
    MATIC: {
      address: '0x0000000000000000000000000000000000000000',
      symbol: 'MATIC',
      name: 'Polygon',
      decimals: 18,
      chainId: 137,
      isNative: true,
      coingeckoId: 'matic-network'
    }
  },
  
  // Gnosis tokens
  GNOSIS: {
    LP_TOKEN: {
      address: '0xedbc7449a9b594ca4e053d9737ec5dc4cbccbfb2',
      symbol: 'LP-EURe',
      name: 'EURe Liquidity Provider Token',
      decimals: 18,
      chainId: 100,
      isLP: true
    },
    xDAI: {
      address: '0x0000000000000000000000000000000000000000',
      symbol: 'xDAI',
      name: 'xDAI',
      decimals: 18,
      chainId: 100,
      isNative: true,
      isStable: true,
      coingeckoId: 'xdai'
    }
  }
};

// Get token configuration by address and chain ID
const getTokenByAddress = (address, chainId) => {
  const chainKey = chainId === 137 ? 'POLYGON' : 'GNOSIS';
  const tokens = TOKENS[chainKey];
  
  if (!tokens) {
    throw new Error(`No tokens configured for chain ID: ${chainId}`);
  }
  
  const token = Object.values(tokens).find(t => 
    t.address.toLowerCase() === address.toLowerCase()
  );
  
  if (!token) {
    throw new Error(`Token not found: ${address} on chain ${chainId}`);
  }
  
  return token;
};

// Get token configuration by symbol and chain ID
const getTokenBySymbol = (symbol, chainId) => {
  const chainKey = chainId === 137 ? 'POLYGON' : 'GNOSIS';
  const tokens = TOKENS[chainKey];
  
  if (!tokens) {
    throw new Error(`No tokens configured for chain ID: ${chainId}`);
  }
  
  const token = Object.values(tokens).find(t => 
    t.symbol.toLowerCase() === symbol.toLowerCase()
  );
  
  if (!token) {
    throw new Error(`Token not found: ${symbol} on chain ${chainId}`);
  }
  
  return token;
};

// Get all tokens for a specific chain
const getTokensByChain = (chainId) => {
  const chainKey = chainId === 137 ? 'POLYGON' : 'GNOSIS';
  const tokens = TOKENS[chainKey];
  
  if (!tokens) {
    throw new Error(`No tokens configured for chain ID: ${chainId}`);
  }
  
  return Object.values(tokens);
};

// Get farming pair configuration
const getFarmingPair = () => {
  return {
    deposit: {
      token: TOKENS.POLYGON.EURe,
      chain: 137
    },
    reward: {
      token: TOKENS.GNOSIS.LP_TOKEN,
      chain: 100
    }
  };
};

// Check if address is a supported token
const isSupportedToken = (address, chainId) => {
  try {
    getTokenByAddress(address, chainId);
    return true;
  } catch (error) {
    return false;
  }
};

// Get token price configuration (for external price feeds)
const getTokenPriceConfig = (symbol) => {
  const allTokens = [
    ...Object.values(TOKENS.POLYGON),
    ...Object.values(TOKENS.GNOSIS)
  ];
  
  const token = allTokens.find(t => t.symbol.toLowerCase() === symbol.toLowerCase());
  
  if (!token || !token.coingeckoId) {
    return null;
  }
  
  return {
    coingeckoId: token.coingeckoId,
    symbol: token.symbol,
    isStable: token.isStable || false
  };
};

module.exports = {
  TOKENS,
  getTokenByAddress,
  getTokenBySymbol,
  getTokensByChain,
  getFarmingPair,
  isSupportedToken,
  getTokenPriceConfig
};