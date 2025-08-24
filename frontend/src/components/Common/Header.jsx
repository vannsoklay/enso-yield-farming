import React from 'react'
import { Wifi, WifiOff, Activity, AlertTriangle } from 'lucide-react'
import { APP_CONFIG } from '../../utils/constants'
import './Header.css'

/**
 * Application header with connection status and branding
 * @param {Object} props - Component props
 * @param {boolean} props.connected - WebSocket connection status
 * @param {string} props.apiHealth - API health status
 * @returns {JSX.Element} Header component
 */
const Header = ({ connected = false, apiHealth = 'unknown' }) => {
  const getHealthIcon = () => {
    switch (apiHealth) {
      case 'healthy':
        return <Activity className="status-icon status-icon--healthy" size={16} />
      case 'unhealthy':
        return <AlertTriangle className="status-icon status-icon--error" size={16} />
      default:
        return <Activity className="status-icon status-icon--unknown" size={16} />
    }
  }

  const getConnectionIcon = () => {
    return connected ? (
      <Wifi className="status-icon status-icon--connected" size={16} />
    ) : (
      <WifiOff className="status-icon status-icon--disconnected" size={16} />
    )
  }

  const getHealthStatus = () => {
    switch (apiHealth) {
      case 'healthy':
        return 'Operational'
      case 'unhealthy':
        return 'Service Issues'
      default:
        return 'Checking...'
    }
  }

  return (
    <header className="header">
      <div className="header-content">
        {/* Logo and Title */}
        <div className="header-brand">
          <div className="brand-logo">
            <div className="logo-icon">
              <span className="logo-symbol">⬢</span>
              <span className="logo-symbol logo-symbol--accent">◆</span>
            </div>
          </div>
          <div className="brand-text">
            <h1 className="brand-title">{APP_CONFIG.name}</h1>
            <p className="brand-subtitle">Cross-chain Yield Farming</p>
          </div>
        </div>

        {/* Chain Indicators */}
        <div className="chain-indicators">
          <div className="chain-indicator">
            <span className="chain-icon">⬢</span>
            <span className="chain-name">Polygon</span>
          </div>
          <div className="chain-connector">
            <div className="connector-line"></div>
            <div className="connector-arrow">→</div>
          </div>
          <div className="chain-indicator">
            <span className="chain-icon">◆</span>
            <span className="chain-name">Gnosis</span>
          </div>
        </div>

        {/* Status Indicators */}
        <div className="header-status">
          <div className="status-group">
            <div className="status-item">
              {getHealthIcon()}
              <span className="status-text">
                API: {getHealthStatus()}
              </span>
            </div>
            
            <div className="status-item">
              {getConnectionIcon()}
              <span className="status-text">
                WebSocket: {connected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>

          {/* Version Badge */}
          <div className="version-badge">
            v{APP_CONFIG.version}
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className={`status-bar ${!connected || apiHealth !== 'healthy' ? 'status-bar--warning' : ''}`}>
        {!connected && (
          <div className="status-message">
            <WifiOff size={14} />
            <span>Real-time updates unavailable - reconnecting...</span>
          </div>
        )}
        
        {connected && apiHealth === 'unhealthy' && (
          <div className="status-message">
            <AlertTriangle size={14} />
            <span>Service experiencing issues - some features may be limited</span>
          </div>
        )}
        
        {connected && apiHealth === 'healthy' && (
          <div className="status-message status-message--success">
            <Activity size={14} />
            <span>All systems operational</span>
          </div>
        )}
      </div>
    </header>
  )
}

export default Header