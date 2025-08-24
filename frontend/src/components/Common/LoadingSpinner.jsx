// Simple stub implementation to prevent import errors
import React from 'react';

const LoadingSpinner = ({ size = 'medium' }) => {
  const sizeMap = {
    small: '20px',
    medium: '40px',
    large: '60px'
  };
  
  return (
    <div style={{ 
      display: 'inline-block',
      width: sizeMap[size],
      height: sizeMap[size],
      border: '3px solid #f3f3f3',
      borderTop: '3px solid #3498db',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite'
    }}>
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
};

export default LoadingSpinner;