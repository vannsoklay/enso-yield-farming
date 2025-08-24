import { useState, useEffect, useCallback, useRef } from 'react'
import { useApiData } from './useApi'
import useSocket from './useSocket'
import { api } from '../services/api'
import { APP_CONFIG } from '../utils/constants'
import toast from 'react-hot-toast'

/**
 * Custom hook for managing balance data with real-time updates
 * @param {string} userAddress - User's wallet address
 * @param {Object} options - Hook options
 * @returns {Object} Balance state and utilities
 */
const useBalances = (userAddress, options = {}) => {
  const [balances, setBalances] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  
  const {
    enableRealtime = true,
    refreshInterval = APP_CONFIG.refreshInterval,
    showToasts = true
  } = options

  const socket = useSocket()
  const refreshIntervalRef = useRef(null)
  const mountedRef = useRef(true)

  // Fetch balances from API
  const fetchBalances = useCallback(async (showLoading = true) => {
    if (!userAddress) return null

    if (showLoading) setLoading(true)
    setError(null)

    try {
      const result = await api.getBalances(userAddress)
      
      if (!mountedRef.current) return null

      setBalances(result.data)
      setLastUpdate(new Date().toISOString())
      return result.data
    } catch (err) {
      if (!mountedRef.current) return null
      
      setError(err.message)
      if (showToasts) {
        toast.error(`Failed to load balances: ${err.message}`)
      }
      throw err
    } finally {
      if (mountedRef.current && showLoading) {
        setLoading(false)
      }
    }
  }, [userAddress, showToasts])

  // Refresh balances and clear cache
  const refreshBalances = useCallback(async () => {
    if (!userAddress) return

    try {
      const result = await api.refreshBalances(userAddress)
      if (result.data) {
        setBalances(result.data)
        setLastUpdate(new Date().toISOString())
      }
      
      if (showToasts) {
        toast.success('Balances refreshed successfully')
      }
      
      return result.data
    } catch (err) {
      if (showToasts) {
        toast.error(`Failed to refresh balances: ${err.message}`)
      }
      throw err
    }
  }, [userAddress, showToasts])

  // Get balance for specific chain
  const getChainBalance = useCallback(async (chain) => {
    if (!userAddress) return null

    try {
      const result = await api.getBalancesByChain(chain, userAddress)
      return result.data
    } catch (err) {
      if (showToasts) {
        toast.error(`Failed to load ${chain} balance: ${err.message}`)
      }
      throw err
    }
  }, [userAddress, showToasts])

  // Get balance history
  const getBalanceHistory = useCallback(async (days = 7) => {
    if (!userAddress) return null

    try {
      const result = await api.getBalanceHistory(userAddress, days)
      return result.data
    } catch (err) {
      if (showToasts) {
        toast.error(`Failed to load balance history: ${err.message}`)
      }
      throw err
    }
  }, [userAddress, showToasts])

  // Setup real-time balance updates
  useEffect(() => {
    if (!enableRealtime || !socket.connected || !userAddress) return

    // Subscribe to balance updates
    socket.subscribe.toBalances(userAddress)

    // Listen for balance updates
    const unsubscribe = socket.on.balanceUpdate((data) => {
      if (data.userId === userAddress && mountedRef.current) {
        setBalances(data.balances)
        setLastUpdate(new Date().toISOString())
        
        if (showToasts) {
          toast.success('Balances updated', { duration: 2000 })
        }
      }
    })

    return unsubscribe
  }, [enableRealtime, socket.connected, userAddress, socket, showToasts])

  // Setup auto-refresh
  useEffect(() => {
    if (!autoRefresh || !userAddress || !refreshInterval) return

    const startAutoRefresh = () => {
      refreshIntervalRef.current = setInterval(() => {
        fetchBalances(false) // Don't show loading for auto-refresh
      }, refreshInterval)
    }

    startAutoRefresh()

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current)
      }
    }
  }, [autoRefresh, userAddress, refreshInterval, fetchBalances])

  // Initial fetch
  useEffect(() => {
    if (userAddress) {
      fetchBalances(true)
    } else {
      setBalances(null)
      setError(null)
      setLastUpdate(null)
    }
  }, [userAddress, fetchBalances])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current)
      }
    }
  }, [])

  // Calculate total USD value
  const getTotalUsdValue = useCallback(() => {
    if (!balances) return 0

    let total = 0
    
    // Add Polygon values
    if (balances.polygon) {
      // Mock USD calculation (in real app, you'd fetch exchange rates)
      const eureUsd = parseFloat(balances.polygon.eure?.balance || 0) * 1.08 // EUR to USD
      const maticUsd = parseFloat(balances.polygon.native?.balance || 0) * 0.85 // MATIC to USD
      total += eureUsd + maticUsd
    }

    // Add Gnosis values
    if (balances.gnosis) {
      const lpUsd = parseFloat(balances.gnosis.lpToken?.balance || 0) * 1.12 // LP token to USD
      const xdaiUsd = parseFloat(balances.gnosis.native?.balance || 0) * 1.0 // xDAI to USD
      total += lpUsd + xdaiUsd
    }

    return total
  }, [balances])

  // Get individual token balances
  const getTokenBalance = useCallback((chain, token) => {
    if (!balances || !balances[chain]) return '0'

    const chainBalances = balances[chain]
    
    switch (token) {
      case 'eure':
        return chainBalances.eure?.balance || '0'
      case 'native':
        return chainBalances.native?.balance || '0'
      case 'lpToken':
        return chainBalances.lpToken?.balance || '0'
      default:
        return '0'
    }
  }, [balances])

  // Check if user has sufficient balance for amount
  const hasSufficientBalance = useCallback((chain, token, amount) => {
    const balance = parseFloat(getTokenBalance(chain, token))
    const required = parseFloat(amount)
    return balance >= required
  }, [getTokenBalance])

  // Toggle auto-refresh
  const toggleAutoRefresh = useCallback(() => {
    setAutoRefresh(prev => !prev)
  }, [])

  return {
    // Data
    balances,
    loading,
    error,
    lastUpdate,
    autoRefresh,
    
    // Computed values
    totalUsdValue: getTotalUsdValue(),
    
    // Methods
    fetchBalances,
    refreshBalances,
    getChainBalance,
    getBalanceHistory,
    getTokenBalance,
    hasSufficientBalance,
    toggleAutoRefresh,
    
    // Utilities
    isLoading: loading,
    hasError: !!error,
    hasBalances: !!balances,
    isEmpty: !balances || (
      (!balances.polygon || 
       (parseFloat(balances.polygon.eure?.balance || 0) === 0 && 
        parseFloat(balances.polygon.native?.balance || 0) === 0)) &&
      (!balances.gnosis || 
       (parseFloat(balances.gnosis.lpToken?.balance || 0) === 0 && 
        parseFloat(balances.gnosis.native?.balance || 0) === 0))
    )
  }
}

export default useBalances