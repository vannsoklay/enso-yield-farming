import React from 'react'
import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from 'lucide-react'
import './NotificationToast.css'

/**
 * Notification toast component for displaying alerts and messages
 * @param {Object} props - Component props
 * @param {string} props.type - Toast type ('success', 'error', 'warning', 'info')
 * @param {string} props.title - Toast title
 * @param {string} props.message - Toast message
 * @param {Function} props.onClose - Close callback
 * @param {boolean} props.autoClose - Auto close after timeout
 * @param {number} props.duration - Auto close duration in ms
 * @returns {JSX.Element} NotificationToast component
 */
const NotificationToast = ({ 
  type = 'info', 
  title, 
  message, 
  onClose, 
  autoClose = true, 
  duration = 4000 
}) => {
  React.useEffect(() => {
    if (autoClose && onClose) {
      const timer = setTimeout(onClose, duration)
      return () => clearTimeout(timer)
    }
  }, [autoClose, duration, onClose])

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle size={20} />
      case 'error':
        return <AlertCircle size={20} />
      case 'warning':
        return <AlertTriangle size={20} />
      default:
        return <Info size={20} />
    }
  }

  return (
    <div className={`notification-toast notification-toast--${type}`}>
      <div className="toast-icon">
        {getIcon()}
      </div>
      
      <div className="toast-content">
        {title && <div className="toast-title">{title}</div>}
        <div className="toast-message">{message}</div>
      </div>
      
      {onClose && (
        <button className="toast-close" onClick={onClose}>
          <X size={16} />
        </button>
      )}
    </div>
  )
}

export default NotificationToast