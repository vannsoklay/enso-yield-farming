import React from 'react'
import { TrendingUp, TrendingDown, Wallet, DollarSign, RefreshCw } from 'lucide-react'
import { formatCurrency, formatUSD, formatPercentage, formatTimeAgo, getChangeColor } from '../../utils/formatters'
import { CHAINS } from '../../utils/constants'
import LoadingSpinner, { SkeletonLoader } from '../Common/LoadingSpinner'
import './BalanceCard.css'

/**
 * Balance card component for displaying chain-specific balances
 * @param {Object} props - Component props
 * @param {string} props.title - Card title (chain name)
 * @param {Object} props.balances - Balance data
 * @param {boolean} props.loading - Loading state
 * @param {Function} props.onRefresh - Refresh callback
 * @param {boolean} props.isStale - Whether data is stale
 * @param {string} props.lastUpdate - Last update timestamp
 * @returns {JSX.Element} BalanceCard component
 */
const BalanceCard = ({ 
  title, 
  balances, 
  loading = false, 
  onRefresh, 
  isStale = false,
  lastUpdate 
}) => {
  const chainConfig = CHAINS[title.toUpperCase()]
  
  const renderTokenBalance = (token, isNative = false) => {
    if (!token) return null

    const { balance, symbol, raw } = token
    const numericBalance = parseFloat(balance || '0')
    const isZero = numericBalance === 0

    return (
      <div className={`token-balance ${isZero ? 'token-balance--zero' : ''}`}>
        <div className="token-info">
          <div className="token-header">
            <span className="token-symbol">{symbol}</span>
            {isNative && <span className="token-badge">Native</span>}
          </div>
          <div className="token-amount">
            {formatCurrency(balance, '', 6)}
          </div>
        </div>
        
        <div className="token-value">
          {/* Mock USD value calculation */}
          <span className="usd-value">
            {formatUSD(numericBalance * (symbol === 'EURe' ? 1.08 : symbol === 'LP-EURe' ? 1.12 : symbol === 'MATIC' ? 0.85 : 1.0))}
          </span>
          
          {/* Mock percentage change */}
          <span className={`percentage-change ${getChangeColor(isZero ? 0 : Math.random() * 10 - 5)}`}>
            {isZero ? (
              <span className="no-change">—</span>
            ) : (
              <>
                {Math.random() > 0.5 ? (
                  <TrendingUp size={12} />
                ) : (
                  <TrendingDown size={12} />
                )}
                {formatPercentage(Math.random() * 10 - 5)}
              </>
            )}
          </span>
        </div>
      </div>
    )
  }

  const getTotalValue = () => {
    if (!balances) return 0

    let total = 0
    Object.values(balances).forEach(token => {
      if (token?.balance) {
        const amount = parseFloat(token.balance)
        const multiplier = token.symbol === 'EURe' ? 1.08 : 
                          token.symbol === 'LP-EURe' ? 1.12 : 
                          token.symbol === 'MATIC' ? 0.85 : 1.0
        total += amount * multiplier
      }
    })
    
    return total
  }

  if (loading) {
    return (
      <div className="balance-card balance-card--loading">
        <div className="card-header">
          <SkeletonLoader height="24px" width="120px" />
          <SkeletonLoader height="20px" width="80px" />
        </div>
        <div className="card-content">
          <SkeletonLoader height="32px" className="mb-3" />
          <div className="balance-list">
            <SkeletonLoader height="60px" className="mb-2" />
            <SkeletonLoader height="60px" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`balance-card ${isStale ? 'balance-card--stale' : ''}`}>
      <div className="card-header">
        <div className="chain-info">
          <div className="chain-title">
            {chainConfig && (
              <span 
                className="chain-icon"
                style={{ color: chainConfig.color }}
              >
                {chainConfig.icon}
              </span>
            )}
            <h3 className="card-title">{title}</h3>
          </div>
          {chainConfig && (
            <span className="chain-symbol">{chainConfig.symbol}</span>
          )}
        </div>
        
        <div className="card-actions">
          {onRefresh && (
            <button 
              className="refresh-button"
              onClick={onRefresh}
              disabled={loading}
              title="Refresh balances"
            >
              <RefreshCw size={16} className={loading ? 'spinning' : ''} />
            </button>
          )}
        </div>
      </div>

      <div className="card-content">
        {/* Total Value */}
        <div className="total-value">
          <div className="total-label">
            <DollarSign size={16} />
            <span>Total Value</span>
          </div>
          <div className="total-amount">
            {formatUSD(getTotalValue())}
          </div>
        </div>

        {/* Token Balances */}
        <div className="balance-list">
          {balances ? (
            <>
              {balances.native && renderTokenBalance(balances.native, true)}
              {balances.eure && renderTokenBalance(balances.eure)}
              {balances.lpToken && renderTokenBalance(balances.lpToken)}
            </>
          ) : (
            <div className="empty-state">
              <Wallet size={32} className="empty-icon" />
              <p className="empty-message">No balance data available</p>
            </div>
          )}
        </div>

        {/* Last Update */}
        {lastUpdate && (
          <div className="update-info">
            <span className="update-text">
              Last updated: {formatTimeAgo(lastUpdate)}
            </span>
            {isStale && (
              <span className="stale-indicator">
                Data may be outdated
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default BalanceCard