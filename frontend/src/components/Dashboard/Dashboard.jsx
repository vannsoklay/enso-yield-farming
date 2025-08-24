// Enhanced Dashboard with Web3 integration
import React from 'react';
import { useWeb3 } from '../../context/Web3Context';
import useTokenBalance from '../../hooks/useTokenBalance';

const Dashboard = () => {
  const { 
    account, 
    chainId, 
    isConnected, 
    isConnecting, 
    connectWallet, 
    switchToPolygon, 
    switchToGnosis,
    isPolygon,
    isGnosis
  } = useWeb3();

  // Token balances
  const { balance: maticBalance, loading: maticLoading } = useTokenBalance('native', 137);
  const { balance: xdaiBalance, loading: xdaiLoading } = useTokenBalance('native', 100);
  const { balance: eureBalance, loading: eureLoading } = useTokenBalance(
    '0x18ec0A6E18E5bc3784fDd3a3634b31245ab704F6', // EURe on Polygon
    137
  );

  return (
    <div style={{ padding: '2rem' }}>
      <h2>Dashboard</h2>
      
      {/* Web3 Connection Status */}
      <div style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '8px' }}>
        <h3>Web3 Status</h3>
        {!isConnected ? (
          <div>
            <p>Connect your wallet to get started</p>
            <button 
              onClick={connectWallet} 
              disabled={isConnecting}
              style={{ 
                padding: '0.5rem 1rem', 
                backgroundColor: '#3498db', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px',
                cursor: isConnecting ? 'not-allowed' : 'pointer'
              }}
            >
              {isConnecting ? 'Connecting...' : 'Connect Wallet'}
            </button>
          </div>
        ) : (
          <div>
            <p><strong>Account:</strong> {account}</p>
            <p><strong>Chain ID:</strong> {chainId}</p>
            <p><strong>Network:</strong> {isPolygon ? 'Polygon' : isGnosis ? 'Gnosis' : 'Other'}</p>
            
            <div style={{ marginTop: '1rem' }}>
              <button 
                onClick={switchToPolygon}
                disabled={isPolygon}
                style={{ 
                  marginRight: '0.5rem',
                  padding: '0.5rem 1rem', 
                  backgroundColor: isPolygon ? '#2ecc71' : '#3498db', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '4px'
                }}
              >
                {isPolygon ? '✓ Polygon' : 'Switch to Polygon'}
              </button>
              <button 
                onClick={switchToGnosis}
                disabled={isGnosis}
                style={{ 
                  padding: '0.5rem 1rem', 
                  backgroundColor: isGnosis ? '#2ecc71' : '#3498db', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '4px'
                }}
              >
                {isGnosis ? '✓ Gnosis' : 'Switch to Gnosis'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Balances */}
      {isConnected && (
        <div style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '8px' }}>
          <h3>Token Balances</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div style={{ padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
              <h4>MATIC (Polygon)</h4>
              <p>{maticLoading ? 'Loading...' : `${parseFloat(maticBalance).toFixed(4)} MATIC`}</p>
            </div>
            
            <div style={{ padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
              <h4>EURe (Polygon)</h4>
              <p>{eureLoading ? 'Loading...' : `${parseFloat(eureBalance).toFixed(4)} EURe`}</p>
            </div>
            
            <div style={{ padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
              <h4>xDAI (Gnosis)</h4>
              <p>{xdaiLoading ? 'Loading...' : `${parseFloat(xdaiBalance).toFixed(4)} xDAI`}</p>
            </div>
          </div>
        </div>
      )}

      {/* Yield Farming Actions */}
      {isConnected && (
        <div style={{ padding: '1rem', border: '1px solid #ddd', borderRadius: '8px' }}>
          <h3>Yield Farming</h3>
          <p>Deposit EURe on Polygon to earn yield on Gnosis Chain</p>
          
          <div style={{ marginTop: '1rem' }}>
            <button 
              style={{ 
                marginRight: '0.5rem',
                padding: '0.5rem 1rem', 
                backgroundColor: '#e74c3c', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px'
              }}
            >
              Deposit EURe
            </button>
            <button 
              style={{ 
                padding: '0.5rem 1rem', 
                backgroundColor: '#f39c12', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px'
              }}
            >
              Withdraw LP
            </button>
          </div>
          
          <p style={{ fontSize: '0.8rem', color: '#666', marginTop: '1rem' }}>
            * Functionality will be implemented with Enso SDK integration
          </p>
        </div>
      )}
    </div>
  );
};

export default Dashboard;