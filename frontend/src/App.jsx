import React, { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import toast from 'react-hot-toast'

// Components
import Header from './components/Common/Header'
import Dashboard from './components/Dashboard/Dashboard'
import LoadingSpinner from './components/Common/LoadingSpinner'

// Hooks
import useSocket from './hooks/useSocket'
import useApi from './hooks/useApi'

// Utils
import { APP_CONFIG } from './utils/constants'

function App() {
  const [isLoading, setIsLoading] = useState(true)
  const [apiHealth, setApiHealth] = useState(null)
  const { socket, connected: socketConnected } = useSocket()
  const { apiService } = useApi()

  // Check API health on startup
  useEffect(() => {
    const checkApiHealth = async () => {
      try {
        const health = await apiService.getHealth()
        setApiHealth(health)
        
        if (health.status === 'healthy') {
          toast.success('Connected to Enso Yield Farming API')
        } else {
          toast.error('API health check failed')
        }
      } catch (error) {
        console.error('API health check failed:', error)
        setApiHealth({ status: 'unhealthy', error: error.message })
        toast.error('Failed to connect to API')
      } finally {
        setIsLoading(false)
      }
    }

    checkApiHealth()
  }, [apiService])

  // Socket connection status notifications
  useEffect(() => {
    if (socket) {
      socket.on('connect', () => {
        toast.success('Real-time connection established')
      })

      socket.on('disconnect', (reason) => {
        if (reason === 'io server disconnect') {
          toast.error('Server disconnected. Attempting to reconnect...')
        }
      })

      socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error)
        toast.error('Real-time connection failed')
      })

      // Listen for system notifications
      socket.on('system:notification', (notification) => {
        const { type, title, message } = notification
        
        switch (type) {
          case 'success':
            toast.success(`${title}: ${message}`)
            break
          case 'error':
            toast.error(`${title}: ${message}`)
            break
          case 'warning':
            toast(`${title}: ${message}`, { icon: '⚠️' })
            break
          default:
            toast(`${title}: ${message}`)
        }
      })

      return () => {
        socket.off('connect')
        socket.off('disconnect')
        socket.off('connect_error')
        socket.off('system:notification')
      }
    }
  }, [socket])

  // Show loading screen while checking API health
  if (isLoading) {
    return (
      <div className="app-loading">
        <LoadingSpinner size="large" />
        <p className="loading-text">Connecting to Enso Yield Farming...</p>
      </div>
    )
  }

  // Show error screen if API is unhealthy
  if (apiHealth?.status === 'unhealthy') {
    return (
      <div className="app-error">
        <div className="error-container">
          <h1>Service Unavailable</h1>
          <p>The Enso Yield Farming service is currently unavailable.</p>
          <p className="error-details">{apiHealth.error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="retry-button"
          >
            Retry Connection
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <Header 
        connected={socketConnected} 
        apiHealth={apiHealth?.status} 
      />
      
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      
      {/* Global notifications area */}
      <div id="notifications" />
      
      {/* Development info */}
      {import.meta.env.DEV && (
        <div className="dev-info">
          <div className="dev-status">
            <span className={`status-indicator ${socketConnected ? 'connected' : 'disconnected'}`} />
            WebSocket: {socketConnected ? 'Connected' : 'Disconnected'}
          </div>
          <div className="dev-status">
            API: {apiHealth?.status || 'Unknown'}
          </div>
          <div className="dev-config">
            Environment: {import.meta.env.MODE}
          </div>
        </div>
      )}
    </div>
  )
}

export default App