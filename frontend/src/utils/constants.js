// Application configuration constants
export const APP_CONFIG = {
  name: import.meta.env.VITE_APP_NAME || 'Enso Yield Farming',
  version: import.meta.env.VITE_APP_VERSION || '1.0.0',
  apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:3001',
  socketUrl: import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001',
  defaultSlippage: parseFloat(import.meta.env.VITE_DEFAULT_SLIPPAGE) || 0.5,
  refreshInterval: 30000, // 30 seconds
  maxRetries: 3,
  retryDelay: 1000,
}

// Supported chains configuration
export const CHAINS = {
  POLYGON: {
    id: 137,
    name: 'Polygon',
    symbol: 'MATIC',
    rpcUrl: 'https://polygon-rpc.com',
    blockExplorer: 'https://polygonscan.com',
    color: '#8247e5',
    icon: '⬢'
  },
  GNOSIS: {
    id: 100,
    name: 'Gnosis',
    symbol: 'xDAI', 
    rpcUrl: 'https://rpc.gnosischain.com',
    blockExplorer: 'https://gnosisscan.io',
    color: '#00d4aa',
    icon: '◆'
  }
}

// Token configurations
export const TOKENS = {
  POLYGON_EURE: {
    address: '0x18ec0A6E18E5bc3784fDd3a3634b31245ab704F6',
    symbol: 'EURe',
    name: 'Monerium EUR emoney',
    decimals: 18,
    chainId: 137,
    isStable: true
  },
  GNOSIS_LP: {
    address: '0xedbc7449a9b594ca4e053d9737ec5dc4cbccbfb2',
    symbol: 'LP-EURe',
    name: 'EURe Liquidity Provider Token',
    decimals: 18,
    chainId: 100,
    isLP: true
  }
}

// Transaction types
export const TRANSACTION_TYPES = {
  DEPOSIT: 'deposit',
  WITHDRAW: 'withdraw',
  COMPOUND: 'compound'
}

// Transaction statuses
export const TRANSACTION_STATUS = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  TIMEOUT: 'timeout'
}

// Slippage options for forms
export const SLIPPAGE_OPTIONS = [
  { value: 0.1, label: '0.1%', description: 'Low slippage, may fail in volatile conditions' },
  { value: 0.5, label: '0.5%', description: 'Recommended for most transactions' },
  { value: 1.0, label: '1.0%', description: 'Higher slippage tolerance' },
  { value: 2.0, label: '2.0%', description: 'High slippage, use with caution' }
]

// API endpoints
export const API_ENDPOINTS = {
  // Health
  HEALTH: '/health',
  STATUS: '/api/status',
  
  // Balances
  BALANCES: '/api/balances',
  BALANCES_REFRESH: '/api/balances/refresh',
  BALANCES_HISTORY: '/api/balances/history',
  
  // Farming
  DEPOSIT: '/api/deposit',
  WITHDRAW: '/api/withdraw',
  COMPOUND: '/api/compound',
  ESTIMATE: '/api/estimate',
  EARNINGS: '/api/earnings',
  
  // Transactions
  TRANSACTIONS: '/api/transactions',
  TRANSACTIONS_RETRY: '/api/transactions/retry',
  TRANSACTIONS_CANCEL: '/api/transactions/cancel',
  TRANSACTIONS_STATS: '/api/transactions/stats',
  
  // Monitoring
  MONITORING_STATS: '/api/monitoring/stats',
  WEBSOCKET_STATS: '/api/websocket/stats'
}

// WebSocket event types
export const SOCKET_EVENTS = {
  // Connection
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  CONNECTED: 'connected',
  
  // Authentication
  AUTHENTICATE: 'authenticate',
  AUTHENTICATED: 'authenticated',
  AUTH_ERROR: 'auth_error',
  
  // Subscriptions
  SUBSCRIBE_BALANCES: 'subscribe:balances',
  SUBSCRIBE_TRANSACTIONS: 'subscribe:transactions',
  SUBSCRIBED: 'subscribed',
  
  // Updates
  BALANCE_UPDATE: 'balance:update',
  TRANSACTION_UPDATE: 'transaction:update',
  
  // Notifications
  USER_NOTIFICATION: 'user:notification',
  SYSTEM_NOTIFICATION: 'system:notification',
  
  // Health
  PING: 'ping',
  PONG: 'pong'
}

// Notification types
export const NOTIFICATION_TYPES = {
  SUCCESS: 'success',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info'
}

// Form validation rules
export const VALIDATION_RULES = {
  AMOUNT: {
    MIN: 0.01,
    MAX: 1000000,
    REGEX: /^\d+(\.\d{1,18})?$/
  },
  SLIPPAGE: {
    MIN: 0.1,
    MAX: 10.0
  },
  ADDRESS: {
    REGEX: /^0x[a-fA-F0-9]{40}$/
  }
}

// Error messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error. Please check your connection.',
  API_ERROR: 'API request failed. Please try again.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  INSUFFICIENT_BALANCE: 'Insufficient balance for this transaction.',
  TRANSACTION_FAILED: 'Transaction failed. Please try again.',
  CONNECTION_LOST: 'Connection lost. Attempting to reconnect...',
  UNKNOWN_ERROR: 'An unexpected error occurred.'
}

// Success messages
export const SUCCESS_MESSAGES = {
  DEPOSIT_INITIATED: 'Deposit initiated successfully',
  WITHDRAW_INITIATED: 'Withdrawal initiated successfully',
  COMPOUND_INITIATED: 'Auto-compound initiated successfully',
  TRANSACTION_COMPLETED: 'Transaction completed successfully',
  BALANCES_REFRESHED: 'Balances refreshed successfully',
  CONNECTION_ESTABLISHED: 'Connection established successfully'
}

// Loading messages
export const LOADING_MESSAGES = {
  CONNECTING: 'Connecting to Enso Yield Farming...',
  LOADING_BALANCES: 'Loading balances...',
  PROCESSING_TRANSACTION: 'Processing transaction...',
  REFRESHING_DATA: 'Refreshing data...',
  ESTIMATING_GAS: 'Estimating gas costs...'
}

// Feature flags
export const FEATURES = {
  ANALYTICS: import.meta.env.VITE_ENABLE_ANALYTICS === 'true',
  DEBUG: import.meta.env.VITE_ENABLE_DEBUG === 'true' || import.meta.env.DEV,
  AUTO_REFRESH: true,
  COMPOUND_AUTO: true,
  GAS_ESTIMATION: true
}

// Theme configuration
export const THEME = {
  mode: import.meta.env.VITE_THEME || 'dark',
  colors: {
    primary: '#6366f1',
    secondary: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b',
    info: '#3b82f6'
  }
}

// Chart colors for analytics
export const CHART_COLORS = [
  '#6366f1', // Primary
  '#10b981', // Secondary
  '#f59e0b', // Warning
  '#ef4444', // Error
  '#3b82f6', // Info
  '#8b5cf6', // Purple
  '#f97316', // Orange
  '#06b6d4', // Cyan
  '#84cc16', // Lime
  '#ec4899'  // Pink
]

// Animation durations
export const ANIMATIONS = {
  FAST: 150,
  NORMAL: 250,
  SLOW: 350,
  PAGE_TRANSITION: 300
}

// Breakpoints for responsive design
export const BREAKPOINTS = {
  SM: '640px',
  MD: '768px',
  LG: '1024px',
  XL: '1280px',
  '2XL': '1536px'
}

// Local storage keys
export const STORAGE_KEYS = {
  USER_PREFERENCES: 'enso_user_preferences',
  TRANSACTION_HISTORY: 'enso_transaction_history',
  BALANCE_CACHE: 'enso_balance_cache',
  LAST_WALLET_ADDRESS: 'enso_last_wallet_address'
}

// Default user preferences
export const DEFAULT_PREFERENCES = {
  defaultSlippage: APP_CONFIG.defaultSlippage,
  autoRefresh: true,
  notifications: true,
  theme: THEME.mode,
  language: 'en'
}

export default {
  APP_CONFIG,
  CHAINS,
  TOKENS,
  TRANSACTION_TYPES,
  TRANSACTION_STATUS,
  SLIPPAGE_OPTIONS,
  API_ENDPOINTS,
  SOCKET_EVENTS,
  NOTIFICATION_TYPES,
  VALIDATION_RULES,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  LOADING_MESSAGES,
  FEATURES,
  THEME,
  CHART_COLORS,
  ANIMATIONS,
  BREAKPOINTS,
  STORAGE_KEYS,
  DEFAULT_PREFERENCES
}