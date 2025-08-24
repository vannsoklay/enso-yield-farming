import { useState, useEffect, useRef } from 'react'
import socketService from '../services/socket'

/**
 * Custom hook for managing WebSocket connection
 * @returns {Object} Socket connection state and methods
 */
const useSocket = () => {
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState(null)
  const [lastPong, setLastPong] = useState(null)
  const socketRef = useRef(null)
  const pingIntervalRef = useRef(null)

  useEffect(() => {
    let mounted = true

    const initializeSocket = async () => {
      if (connecting) return

      setConnecting(true)
      setError(null)

      try {
        const socket = await socketService.connect()
        
        if (!mounted) return

        socketRef.current = socket
        setConnected(true)
        setConnecting(false)

        // Set up event listeners
        const unsubscribers = [
          socketService.onConnectionStatus((status) => {
            if (!mounted) return
            setConnected(status.connected)
            
            if (!status.connected && status.reason) {
              console.log('Connection lost:', status.reason)
            }
            
            if (status.reconnected) {
              console.log('Successfully reconnected')
            }
            
            if (status.failed) {
              setError('Connection failed after multiple attempts')
            }
          }),

          socketService.on('socket_error', (err) => {
            if (!mounted) return
            console.error('Socket error:', err)
            setError(err.message || 'Socket connection error')
          }),

          socketService.onPong((data) => {
            if (!mounted) return
            setLastPong(data.timestamp)
          })
        ]

        // Start ping interval for connection health
        pingIntervalRef.current = setInterval(() => {
          if (socketService.isConnected()) {
            socketService.ping()
          }
        }, 30000) // Ping every 30 seconds

        // Cleanup function
        return () => {
          unsubscribers.forEach(unsub => unsub())
          if (pingIntervalRef.current) {
            clearInterval(pingIntervalRef.current)
          }
        }

      } catch (err) {
        if (!mounted) return
        console.error('Failed to connect to WebSocket:', err)
        setError(err.message)
        setConnecting(false)
      }
    }

    initializeSocket()

    return () => {
      mounted = false
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current)
      }
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current)
      }
      socketService.cleanup()
    }
  }, [])

  const reconnect = async () => {
    setError(null)
    setConnecting(true)
    
    try {
      socketService.disconnect()
      await socketService.connect()
      setConnected(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setConnecting(false)
    }
  }

  const disconnect = () => {
    socketService.disconnect()
    setConnected(false)
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current)
    }
  }

  const subscribe = {
    toBalances: (userId) => socketService.subscribeToBalances(userId),
    toTransactions: (userId) => socketService.subscribeToTransactions(userId)
  }

  const on = {
    balanceUpdate: (callback) => socketService.onBalanceUpdate(callback),
    transactionUpdate: (callback) => socketService.onTransactionUpdate(callback),
    userNotification: (callback) => socketService.onUserNotification(callback),
    systemNotification: (callback) => socketService.onSystemNotification(callback),
    subscribed: (callback) => socketService.onSubscribed(callback),
    authenticated: (callback) => socketService.onAuthenticated(callback),
    authError: (callback) => socketService.onAuthError(callback)
  }

  const getStats = () => socketService.getConnectionStats()

  return {
    socket: socketRef.current,
    connected,
    connecting,
    error,
    lastPong,
    reconnect,
    disconnect,
    subscribe,
    on,
    getStats,
    authenticate: socketService.authenticate.bind(socketService),
    ping: socketService.ping.bind(socketService)
  }
}

export default useSocket