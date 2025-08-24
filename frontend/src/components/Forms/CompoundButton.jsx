import React, { useState, useEffect } from 'react'
import { RotateCcw, Zap, Info, AlertTriangle, TrendingUp } from 'lucide-react'
import toast from 'react-hot-toast'

import { useApiSubmit, useApiData } from '../../hooks/useApi'
import { api } from '../../services/api'
import { InlineSpinner } from '../Common/LoadingSpinner'
import { 
  formatCurrency, 
  formatUSD,
  formatPercentage 
} from '../../utils/formatters'
import './Forms.css'

/**
 * Compound button component for auto-compounding earnings
 * @param {Object} props - Component props
 * @param {string} props.userAddress - User's wallet address
 * @param {Object} props.balances - Current balances
 * @param {Function} props.onSuccess - Success callback
 * @returns {JSX.Element} CompoundButton component
 */
const CompoundButton = ({ userAddress, balances, onSuccess }) => {
  const [showDetails, setShowDetails] = useState(false)
  const [gasEstimate, setGasEstimate] = useState(null)
  const [estimating, setEstimating] = useState(false)

  // Fetch earnings data
  const {
    data: earningsData,
    loading: loadingEarnings,
    refetch: refetchEarnings
  } = useApiData(
    () => userAddress ? api.getEarnings(userAddress) : Promise.resolve(null),
    [userAddress],
    { immediate: !!userAddress, cacheTime: 30000 }
  )

  // API submit hook for compounding
  const { submit, submitting, submitError, submitSuccess } = useApiSubmit(
    (data) => api.compound(data.userAddress, data.slippage),
    {
      onSuccess: (result) => {
        toast.success(SUCCESS_MESSAGES.COMPOUND_INITIATED)
        refetchEarnings()
        if (onSuccess) onSuccess(result)
      },
      onError: (error) => {
        toast.error(`Auto-compound failed: ${error.message}`)
      }
    }
  )

  const earnings = earningsData?.data?.availableEarnings || '0'
  const canCompound = earningsData?.data?.canCompound || false
  const hasEarnings = parseFloat(earnings) > 0

  // Estimate gas costs for compounding
  useEffect(() => {
    const estimateGas = async () => {
      if (hasEarnings && userAddress) {
        setEstimating(true)
        try {
          const estimate = await api.estimateGas('compound', earnings, userAddress)
          setGasEstimate(estimate.data)
        } catch (error) {
          console.error('Gas estimation failed:', error)
          setGasEstimate(null)
        } finally {
          setEstimating(false)
        }
      } else {
        setGasEstimate(null)
      }
    }

    if (showDetails) {
      estimateGas()
    }
  }, [hasEarnings, userAddress, earnings, showDetails])

  const handleCompound = async () => {
    if (!userAddress) {
      toast.error('Please connect your wallet first')
      return
    }

    if (!canCompound) {
      toast.error('No earnings available to compound')
      return
    }

    try {
      await submit({
        userAddress,
        slippage: 0.5 // Default slippage for auto-compound
      })
    } catch (error) {
      // Error is already handled by the hook
    }
  }

  // Calculate estimated APY (mock calculation)
  const estimatedAPY = hasEarnings ? 8.5 + Math.random() * 2 : 0

  return (
    <div className="compound-button-container">
      <div className="form-header">
        <div className="form-title">
          <RotateCcw size={20} />
          <h3>Auto-Compound</h3>
        </div>
        <p className="form-description">
          Automatically reinvest your earnings to maximize yield
        </p>
      </div>

      <div className="compound-content">
        {/* Earnings Display */}
        <div className="earnings-display">
          <div className="earnings-header">
            <TrendingUp size={20} className="earnings-icon" />
            <span className="earnings-label">Available Earnings</span>
          </div>
          
          <div className="earnings-amount">
            {loadingEarnings ? (
              <InlineSpinner size="medium" />
            ) : (
              <>
                <span className="amount">{formatCurrency(earnings, 'LP-EURe')}</span>
                {hasEarnings && (
                  <span className="usd-value">
                    ≈ {formatUSD(parseFloat(earnings) * 1.12)}
                  </span>
                )}
              </>
            )}
          </div>

          {hasEarnings && (
            <div className="earnings-stats">
              <div className="stat-item">
                <span className="stat-label">Current APY</span>
                <span className="stat-value">{formatPercentage(estimatedAPY)}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Daily Earnings</span>
                <span className="stat-value">
                  {formatCurrency((parseFloat(earnings) / 30).toFixed(6), 'LP-EURe')}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Compound Actions */}
        <div className="compound-actions">
          {/* Details Toggle */}
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="details-toggle"
            disabled={!hasEarnings}
          >
            {showDetails ? 'Hide Details' : 'Show Details'}
            <span className={`toggle-icon ${showDetails ? 'expanded' : ''}`}>
              ▼
            </span>
          </button>

          {/* Compound Button */}
          <button
            onClick={handleCompound}
            disabled={!canCompound || submitting || loadingEarnings}
            className={`compound-button ${submitSuccess ? 'success' : ''} ${!canCompound ? 'disabled' : ''}`}
          >
            {submitting ? (
              <>
                <InlineSpinner size="small" color="white" />
                Compounding...
              </>
            ) : submitSuccess ? (
              <>
                ✓ Compound Initiated
              </>
            ) : (
              <>
                <RotateCcw size={18} />
                {canCompound ? 'Compound Earnings' : 'No Earnings Available'}
              </>
            )}
          </button>
        </div>

        {/* Details Section */}
        {showDetails && hasEarnings && (
          <div className="compound-details">
            <div className="details-grid">
              <div className="detail-item">
                <span className="detail-label">Compound Amount:</span>
                <span className="detail-value">{formatCurrency(earnings, 'LP-EURe')}</span>
              </div>
              
              <div className="detail-item">
                <span className="detail-label">Estimated Output:</span>
                <span className="detail-value">
                  {formatCurrency((parseFloat(earnings) * 1.02).toFixed(6), 'LP-EURe')}
                </span>
              </div>
              
              <div className="detail-item">
                <span className="detail-label">Slippage Tolerance:</span>
                <span className="detail-value">0.5%</span>
              </div>

              {gasEstimate && (
                <>
                  <div className="detail-item">
                    <span className="detail-label">Est. Gas Cost:</span>
                    <span className="detail-value">
                      {formatCurrency(gasEstimate.estimatedCost, 'xDAI')}
                    </span>
                  </div>
                </>
              )}
            </div>

            {estimating && (
              <div className="estimating">
                <InlineSpinner size="small" />
                <span>Calculating gas costs...</span>
              </div>
            )}

            {gasEstimate && (
              <div className="gas-estimate">
                <div className="estimate-header">
                  <Zap size={16} />
                  <span>Transaction Details</span>
                </div>
                <div className="estimate-details">
                  <div className="estimate-item">
                    <span>Estimated Gas:</span>
                    <span>{gasEstimate.estimatedGas} units</span>
                  </div>
                  <div className="estimate-item">
                    <span>Network Fee:</span>
                    <span>{formatCurrency(gasEstimate.estimatedCost, 'xDAI')}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Submit Error */}
        {submitError && (
          <div className="submit-error">
            <AlertTriangle size={16} />
            <span>{submitError}</span>
          </div>
        )}

        {/* Info Banners */}
        {hasEarnings ? (
          <div className="info-banner">
            <Info size={16} />
            <div className="info-content">
              <strong>Auto-compound benefits:</strong> Reinvesting your earnings automatically maximizes your yield through compound interest. Your LP tokens will grow faster over time.
            </div>
          </div>
        ) : (
          <div className="info-banner">
            <Info size={16} />
            <div className="info-content">
              <strong>No earnings yet:</strong> Make a deposit and wait for earnings to accumulate. Earnings are typically available after 24-48 hours of providing liquidity.
            </div>
          </div>
        )}

        {/* Compound Schedule Info */}
        <div className="schedule-info">
          <h4>Automatic Compounding</h4>
          <p>
            You can manually compound at any time, or enable automatic compounding to maximize your returns. 
            Automatic compounding will reinvest your earnings daily when they exceed the minimum threshold.
          </p>
          
          <div className="schedule-settings">
            <label className="checkbox-label">
              <input type="checkbox" defaultChecked={false} />
              <span className="checkbox-text">
                Enable automatic daily compounding (Coming Soon)
              </span>
            </label>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CompoundButton