import React, { useState, useEffect } from 'react'
import { ArrowUpLeft, Zap, Info, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'

import { useApiSubmit } from '../../hooks/useApi'
import { api } from '../../services/api'
import { InlineSpinner } from '../Common/LoadingSpinner'
import { 
  validateAmount, 
  validateSlippage, 
  formatCurrency, 
  formatUSD 
} from '../../utils/formatters'
import './Forms.css'

/**
 * Withdraw form component for converting LP tokens back to EURe
 * @param {Object} props - Component props
 * @param {string} props.userAddress - User's wallet address
 * @param {Object} props.balances - Current balances
 * @param {Function} props.onSuccess - Success callback
 * @returns {JSX.Element} WithdrawForm component
 */
const WithdrawForm = ({ userAddress, balances, onSuccess }) => {
  const [amount, setAmount] = useState('')
  const [slippage, setSlippage] = useState(0.5)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [gasEstimate, setGasEstimate] = useState(null)
  const [estimating, setEstimating] = useState(false)

  // Form validation state
  const [amountError, setAmountError] = useState('')
  const [slippageError, setSlippageError] = useState('')

  // API submit hook
  const { submit, submitting, submitError, submitSuccess } = useApiSubmit(
    (data) => api.withdraw(data.amount, data.userAddress, data.slippage),
    {
      onSuccess: (result) => {
        toast.success(SUCCESS_MESSAGES.WITHDRAW_INITIATED)
        setAmount('')
        if (onSuccess) onSuccess(result)
      },
      onError: (error) => {
        toast.error(`Withdrawal failed: ${error.message}`)
      }
    }
  )

  // Get available LP token balance
  const availableBalance = balances?.gnosis?.lpToken?.balance || '0'
  const hasBalance = parseFloat(availableBalance) > 0

  // Validate amount input
  useEffect(() => {
    if (amount) {
      const validation = validateAmount(amount)
      if (!validation.isValid) {
        setAmountError(validation.error)
      } else {
        // Check if amount exceeds balance
        const numAmount = parseFloat(amount)
        const numBalance = parseFloat(availableBalance)
        
        if (numAmount > numBalance) {
          setAmountError(`Insufficient balance. Available: ${formatCurrency(availableBalance, 'LP-EURe')}`)
        } else {
          setAmountError('')
        }
      }
    } else {
      setAmountError('')
    }
  }, [amount, availableBalance])

  // Validate slippage input
  useEffect(() => {
    const validation = validateSlippage(slippage)
    if (!validation.isValid) {
      setSlippageError(validation.error)
    } else {
      setSlippageError('')
    }
  }, [slippage])

  // Estimate gas costs when amount changes
  useEffect(() => {
    const estimateGas = async () => {
      if (amount && !amountError && userAddress) {
        setEstimating(true)
        try {
          const estimate = await api.estimateGas('withdraw', amount, userAddress)
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

    const timeoutId = setTimeout(estimateGas, 500)
    return () => clearTimeout(timeoutId)
  }, [amount, amountError, userAddress])

  const handleAmountChange = (e) => {
    const value = e.target.value
    // Only allow numbers and one decimal point
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setAmount(value)
    }
  }

  const handleMaxClick = () => {
    if (hasBalance) {
      setAmount(availableBalance)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!userAddress) {
      toast.error('Please connect your wallet first')
      return
    }

    if (amountError || slippageError || !amount) {
      toast.error('Please fix the form errors before submitting')
      return
    }

    try {
      await submit({
        amount,
        userAddress,
        slippage
      })
    } catch (error) {
      // Error is already handled by the hook
    }
  }

  const isFormValid = amount && !amountError && !slippageError && !submitting

  // Calculate estimated EURe output (mock calculation)
  const estimatedOutput = amount ? (parseFloat(amount) * 0.98).toFixed(6) : '0'

  return (
    <div className="withdraw-form">
      <div className="form-header">
        <div className="form-title">
          <ArrowUpLeft size={20} />
          <h3>Withdraw to EURe</h3>
        </div>
        <p className="form-description">
          Withdraw LP tokens from Gnosis to receive EURe on Polygon
        </p>
      </div>

      <form onSubmit={handleSubmit} className="form">
        {/* Amount Input */}
        <div className="form-group">
          <label className="form-label">
            Amount (LP-EURe)
            <span className="balance-info">
              Balance: {formatCurrency(availableBalance, 'LP-EURe')}
            </span>
          </label>
          
          <div className="amount-input-container">
            <input
              type="text"
              value={amount}
              onChange={handleAmountChange}
              placeholder="0.0"
              className={`form-input amount-input ${amountError ? 'error' : ''}`}
              disabled={submitting}
            />
            
            <div className="input-actions">
              <button
                type="button"
                onClick={handleMaxClick}
                className="max-button"
                disabled={!hasBalance || submitting}
              >
                MAX
              </button>
            </div>
          </div>
          
          {amountError && (
            <div className="form-error">
              <AlertTriangle size={14} />
              {amountError}
            </div>
          )}
          
          {amount && !amountError && (
            <div className="form-help">
              You'll receive ≈ {formatCurrency(estimatedOutput, 'EURe')} ({formatUSD(parseFloat(estimatedOutput) * 1.08)})
            </div>
          )}
        </div>

        {/* Show estimated output */}
        {amount && !amountError && (
          <div className="output-estimation">
            <div className="estimation-header">
              <span>Estimated Output</span>
            </div>
            <div className="estimation-content">
              <div className="output-token">
                <span className="token-symbol">EURe</span>
                <span className="token-amount">{formatCurrency(estimatedOutput, '', 6)}</span>
              </div>
              <div className="output-details">
                <span className="output-usd">{formatUSD(parseFloat(estimatedOutput) * 1.08)}</span>
                <span className="output-network">on Polygon</span>
              </div>
            </div>
          </div>
        )}

        {/* Advanced Settings */}
        <div className="advanced-toggle">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="toggle-button"
          >
            Advanced Settings
            <span className={`toggle-icon ${showAdvanced ? 'expanded' : ''}`}>
              ▼
            </span>
          </button>
        </div>

        {showAdvanced && (
          <div className="advanced-settings">
            <div className="form-group">
              <label className="form-label">
                Slippage Tolerance
                <Info size={14} className="info-icon" title="Maximum price change you're willing to accept" />
              </label>
              
              <div className="slippage-options">
                {SLIPPAGE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setSlippage(option.value)}
                    className={`slippage-button ${slippage === option.value ? 'active' : ''}`}
                    title={option.description}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              
              {slippageError && (
                <div className="form-error">
                  <AlertTriangle size={14} />
                  {slippageError}
                </div>
              )}
            </div>

            {/* Gas Estimation */}
            {gasEstimate && (
              <div className="gas-estimate">
                <div className="estimate-header">
                  <Zap size={16} />
                  <span>Gas Estimation</span>
                </div>
                <div className="estimate-details">
                  <div className="estimate-item">
                    <span>Estimated Gas:</span>
                    <span>{gasEstimate.estimatedGas} units</span>
                  </div>
                  <div className="estimate-item">
                    <span>Estimated Cost:</span>
                    <span>{formatCurrency(gasEstimate.estimatedCost, 'xDAI')}</span>
                  </div>
                </div>
              </div>
            )}

            {estimating && (
              <div className="estimating">
                <InlineSpinner size="small" />
                <span>Estimating gas costs...</span>
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

        {/* Submit Button */}
        <button
          type="submit"
          disabled={!isFormValid}
          className={`submit-button ${submitSuccess ? 'success' : ''}`}
        >
          {submitting ? (
            <>
              <InlineSpinner size="small" color="white" />
              Processing Withdrawal...
            </>
          ) : submitSuccess ? (
            <>
              ✓ Withdrawal Initiated
            </>
          ) : (
            <>
              <ArrowUpLeft size={18} />
              Withdraw to EURe
            </>
          )}
        </button>

        {/* Info Banner */}
        <div className="info-banner">
          <Info size={16} />
          <div className="info-content">
            <strong>Cross-chain withdrawal:</strong> Your LP tokens will be processed on Gnosis and you'll receive EURe on Polygon. This typically takes 2-5 minutes.
          </div>
        </div>

        {/* No Balance Warning */}
        {!hasBalance && (
          <div className="warning-banner">
            <AlertTriangle size={16} />
            <div className="warning-content">
              You don't have any LP tokens to withdraw. Make a deposit first to start earning yield.
            </div>
          </div>
        )}
      </form>
    </div>
  )
}

export default WithdrawForm