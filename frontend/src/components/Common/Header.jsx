// Simple stub implementation to prevent import errors
import React from 'react';

const Header = ({ connected, apiHealth }) => {
  return (
    <header style={{ padding: '1rem', borderBottom: '1px solid #ccc' }}>
      <h1>Enso Yield Farming</h1>
      <div style={{ fontSize: '0.8rem', color: '#666' }}>
        WebSocket: {connected ? 'Connected' : 'Disconnected'} | 
        API: {apiHealth || 'Unknown'}
      </div>
    </header>
  );
};

export default Header;