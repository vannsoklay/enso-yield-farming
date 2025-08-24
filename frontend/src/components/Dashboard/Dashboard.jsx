import React, { useState, useEffect } from 'react'
import { 
  ArrowDownRight, 
  ArrowUpLeft, 
  RotateCcw, 
  AlertCircle, 
  TrendingUp,
  Settings,
  Info,
  Wallet
} from 'lucide-react'
import toast from 'react-hot-toast'

// Components
import BalanceCard from '../Balance/BalanceCard'
import DepositForm from '../Forms/DepositForm'
import WithdrawForm from '../Forms/WithdrawForm'
import CompoundButton from '../Forms/CompoundButton'
import LoadingSpinner from '../Common/LoadingSpinner'

// Hooks
import useBalances from '../../hooks/useBalances'
import useSocket from '../../hooks/useSocket'

// Utils
import { APP_CONFIG } from '../../utils/constants'

// Styles
import './Dashboard.css'

/**
 * Main dashboard component for the Enso Yield Farming application
 * @returns {JSX.Element} Dashboard component
 */
const Dashboard = () => {
  const [userAddress, setUserAddress] = useState('0x742d35Cc4700C2532237A43F4C1b05a4c8FE1B5C') // Mock address
  const [activeTab, setActiveTab] = useState('deposit')
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Hooks
  const { socket, connected } = useSocket()
  const {
    balances,
    loading,
    error,
    lastUpdate,
    autoRefresh,
    totalUsdValue,
    refreshBalances,
    toggleAutoRefresh,
    hasBalances,
    isEmpty
  } = useBalances(userAddress, {
    enableRealtime: true,
    showToasts: true
  })

  // Subscribe to real-time updates
  useEffect(() => {
    if (connected && userAddress && socket) {
      socket.subscribe.toBalances(userAddress)
      socket.subscribe.toTransactions(userAddress)

      // Listen for notifications
      const unsubscribeNotifications = socket.on.userNotification((notification) => {
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

      return unsubscribeNotifications
    }
  }, [connected, userAddress, socket])

  const handleTabChange = (tab) => {
    setActiveTab(tab)
  }

  const handleWalletConnect = () => {
    // Mock wallet connection
    const mockAddress = '0x' + Math.random().toString(16).substr(2, 40)
    setUserAddress(mockAddress)
    toast.success('Wallet connected successfully!')
  }

  const renderActionTab = () => {
    const commonProps = {
      userAddress,
      balances,
      onSuccess: () => {
        // Refresh balances after successful transaction
        setTimeout(() => {
          refreshBalances()
        }, 2000)
      }
    }

    switch (activeTab) {
      case 'deposit':
        return <DepositForm {...commonProps} />
      case 'withdraw':
        return <WithdrawForm {...commonProps} />
      case 'compound':
        return <CompoundButton {...commonProps} />
      default:
        return <DepositForm {...commonProps} />
    }
  }

  if (loading && !hasBalances) {
    return (
      <div className="dashboard-loading">
        <LoadingSpinner size="large" message="Loading your dashboard..." />
      </div>
    )
  }

  return (
    <div className="dashboard">
      {/* Dashboard Header */}
      <div className="dashboard-header">
        <div className="header-content">
          <div className="header-title">
            <h1>Yield Farming Dashboard</h1>
            <p className="header-subtitle">
              Cross-chain farming between Polygon and Gnosis
            </p>
          </div>
          
          <div className="header-actions">
            <div className="connection-status">
              <div className={`status-indicator ${connected ? 'connected' : 'disconnected'}`} />
              <span className="status-text">
                {connected ? 'Real-time' : 'Offline'}
              </span>
            </div>
            
            <button 
              className="settings-button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              title="Toggle advanced settings"
            >
              <Settings size={18} />
            </button>
          </div>
        </div>

        {/* Portfolio Summary */}
        <div className="portfolio-summary">
          <div className="summary-card">
            <div className="summary-icon">
              <TrendingUp size={24} />
            </div>
            <div className="summary-content">
              <div className="summary-label">Total Portfolio Value</div>
              <div className="summary-value">${totalUsdValue.toFixed(2)}</div>
            </div>
          </div>
          
          <div className="summary-stats">
            <div className="stat-item">
              <span className="stat-label">24h Change</span>
              <span className="stat-value text-success">+2.34%</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">APY</span>
              <span className="stat-value">~8.5%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="error-banner">
          <AlertCircle size={20} />
          <span>Failed to load data: {error}</span>
          <button onClick={refreshBalances} className="retry-button">
            Retry
          </button>
        </div>
      )}

      {/* Wallet Connection */}
      {!userAddress && (
        <div className="wallet-connect">
          <div className="connect-card">
            <Wallet size={48} className="connect-icon" />
            <h2>Connect Your Wallet</h2>
            <p>Connect your wallet to start yield farming</p>
            <button onClick={handleWalletConnect} className="btn btn-primary btn-lg">
              Connect Wallet
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      {userAddress && (
        <div className="dashboard-content">
          {/* Balance Section */}
          <div className="balance-section">
            <div className="section-header">
              <h2 className="section-title">Your Balances</h2>
              <div className="section-actions">
                <button 
                  className={`auto-refresh-toggle ${autoRefresh ? 'active' : ''}`}
                  onClick={toggleAutoRefresh}
                  title={`Auto-refresh: ${autoRefresh ? 'ON' : 'OFF'}`}
                >
                  <RotateCcw size={16} />
                  Auto-refresh
                </button>
              </div>
            </div>

            <div className="balance-grid">
              <BalanceCard
                title="Polygon"
                balances={balances?.polygon}
                loading={loading}
                onRefresh={refreshBalances}
                lastUpdate={lastUpdate}
              />
              <BalanceCard
                title="Gnosis"
                balances={balances?.gnosis}
                loading={loading}
                onRefresh={refreshBalances}
                lastUpdate={lastUpdate}
              />
            </div>

            {/* Empty State */}
            {isEmpty && !loading && (
              <div className="empty-balances">
                <Info size={32} className="empty-icon" />
                <h3>No Tokens Found</h3>
                <p>Start by depositing EURe tokens to begin yield farming</p>
              </div>
            )}
          </div>

          {/* Actions Section */}
          <div className="actions-section">
            <div className="section-header">
              <h2 className="section-title">Actions</h2>
            </div>

            <div className="actions-content">
              {/* Action Tabs */}
              <div className="action-tabs">
                <button 
                  className={`tab-button ${activeTab === 'deposit' ? 'active' : ''}`}
                  onClick={() => handleTabChange('deposit')}
                >
                  <ArrowDownRight size={18} />
                  Deposit
                </button>
                <button 
                  className={`tab-button ${activeTab === 'withdraw' ? 'active' : ''}`}
                  onClick={() => handleTabChange('withdraw')}
                >
                  <ArrowUpLeft size={18} />
                  Withdraw
                </button>
                <button 
                  className={`tab-button ${activeTab === 'compound' ? 'active' : ''}`}
                  onClick={() => handleTabChange('compound')}
                >
                  <RotateCcw size={18} />
                  Compound
                </button>
              </div>

              {/* Action Content */}
              <div className="action-content">
                {renderActionTab()}
              </div>
            </div>
          </div>

          {/* Advanced Settings */}
          {showAdvanced && (
            <div className="advanced-section">
              <div className="section-header">
                <h2 className="section-title">Advanced Settings</h2>
              </div>
              
              <div className="advanced-content">
                <div className="setting-item">
                  <label className="setting-label">
                    Refresh Interval
                  </label>
                  <select className="setting-select">
                    <option value="30000">30 seconds</option>
                    <option value="60000">1 minute</option>
                    <option value="300000">5 minutes</option>
                  </select>
                </div>
                
                <div className="setting-item">
                  <label className="setting-label">
                    Default Slippage
                  </label>
                  <select className="setting-select">
                    <option value="0.1">0.1%</option>
                    <option value="0.5">0.5%</option>
                    <option value="1.0">1.0%</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default Dashboard