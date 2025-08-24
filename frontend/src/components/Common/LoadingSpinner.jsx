import React from 'react'
import './LoadingSpinner.css'

/**
 * Loading spinner component with different sizes and styles
 * @param {Object} props - Component props
 * @param {string} props.size - Size of spinner ('small', 'medium', 'large')
 * @param {string} props.color - Color theme ('primary', 'secondary', 'white')
 * @param {string} props.message - Optional loading message
 * @param {boolean} props.overlay - Show as overlay
 * @param {string} props.className - Additional CSS classes
 * @returns {JSX.Element} LoadingSpinner component
 */
const LoadingSpinner = ({ 
  size = 'medium', 
  color = 'primary', 
  message = '', 
  overlay = false,
  className = ''
}) => {
  const spinnerClasses = [
    'loading-spinner',
    `loading-spinner--${size}`,
    `loading-spinner--${color}`,
    className
  ].filter(Boolean).join(' ')

  const containerClasses = [
    'loading-container',
    overlay && 'loading-container--overlay'
  ].filter(Boolean).join(' ')

  if (overlay) {
    return (
      <div className={containerClasses}>
        <div className="loading-content">
          <div className={spinnerClasses}>
            <div className="spinner-ring">
              <div></div>
              <div></div>
              <div></div>
              <div></div>
            </div>
          </div>
          {message && <p className="loading-message">{message}</p>}
        </div>
      </div>
    )
  }

  return (
    <div className={containerClasses}>
      <div className={spinnerClasses}>
        <div className="spinner-ring">
          <div></div>
          <div></div>
          <div></div>
          <div></div>
        </div>
      </div>
      {message && <p className="loading-message">{message}</p>}
    </div>
  )
}

/**
 * Inline loading spinner for buttons
 */
export const InlineSpinner = ({ size = 'small', color = 'white' }) => (
  <div className={`inline-spinner inline-spinner--${size} inline-spinner--${color}`}>
    <div className="spinner-dots">
      <div></div>
      <div></div>
      <div></div>
    </div>
  </div>
)

/**
 * Skeleton loader for content placeholders
 */
export const SkeletonLoader = ({ width = '100%', height = '20px', className = '' }) => (
  <div 
    className={`skeleton-loader ${className}`}
    style={{ width, height }}
  />
)

/**
 * Card skeleton loader
 */
export const CardSkeleton = ({ lines = 3 }) => (
  <div className="card-skeleton">
    <SkeletonLoader height="24px" className="mb-3" />
    {Array.from({ length: lines }).map((_, index) => (
      <SkeletonLoader 
        key={index}
        height="16px" 
        width={`${Math.random() * 30 + 60}%`}
        className="mb-2"
      />
    ))}
  </div>
)

export default LoadingSpinner