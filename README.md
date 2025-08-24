# Enso Yield Farming Application

A comprehensive full-stack application for Enso SDK integration that enables cross-chain yield farming between Polygon and Gnosis chains. **Now migrated to viem v2 with MongoDB persistence.**

## Recent Migration (Breaking Changes)

### Viem v2 Migration
This application has been migrated from ethers.js to viem v2 for enhanced blockchain interactions:

**⚠️ Breaking Changes:**
- **Amounts are now handled as `bigint`** instead of ethers `BigNumber`. Use `parseUnits`/`formatUnits` from viem and pass `BigInt` values to transactions.
- **Frontend wallet connection changed** - no longer uses ethers signers. Update custom UI logic if it relied on ethers providers/signers.
- **Different API signatures** for contract interactions using viem's `readContract`/`writeContract`.

### MongoDB Persistence
Added MongoDB integration for transaction and wallet state persistence:
- Transaction history and status tracking
- Wallet balance caching and updates
- Cross-chain operation monitoring

## Features

- **Cross-Chain Yield Farming**: Seamlessly farm yield across Polygon and Gnosis chains
- **Real-Time Updates**: Live balance and transaction monitoring via WebSocket
- **Modern Stack**: Express.js backend with React + Vite frontend
- **Viem v2 Integration**: Enhanced blockchain interactions with type safety
- **MongoDB Persistence**: Transaction history and wallet state tracking
- **Enso SDK Integration**: Leverages Enso's cross-chain capabilities
- **Security**: Rate limiting, input validation, and secure API endpoints
- **Production Ready**: Docker deployment with comprehensive error handling

## Quick Start

### Prerequisites

- Node.js 18+ and npm 8+
- Docker and Docker Compose (for production deployment)
- MongoDB instance (local or hosted)
- Enso API key
- Private key for wallet operations

### Development Setup

1. **Clone and install dependencies:**
   ```bash
   git clone <repository-url>
   cd enso-yield-farming
   npm run install:all
   ```

2. **Configure environment variables:**
   ```bash
   # Backend configuration
   cp backend/.env.example backend/.env
   # Edit backend/.env with your values
   
   # Required environment variables:
   MONGODB_URI=mongodb://localhost:27017/enso-yield-farming
   PRIVATE_KEY=your_private_key_here_do_not_commit
   ENSO_ROUTER_ADDRESS=0x1234567890123456789012345678901234567890
   POLYGON_RPC_URL=https://polygon-rpc.com
   GNOSIS_RPC_URL=https://rpc.gnosischain.com

   # Frontend configuration  
   cp frontend/.env.example frontend/.env
   # Edit frontend/.env with your values
   ```

3. **Start development servers:**
   ```bash
   npm run dev
   ```

   This will start:
   - Backend API server on http://localhost:3001
   - Frontend React app on http://localhost:3000

### Production Deployment

```bash
# Build and start with Docker
docker-compose up -d

# Or build frontend and start backend
npm run build
npm start
```

## Migration Guide

### For Developers

#### Backend Changes (ethers → viem v2)
```javascript
// OLD (ethers)
const provider = new ethers.JsonRpcProvider(rpcUrl);
const balance = await provider.getBalance(address);
const formatted = ethers.formatEther(balance);

// NEW (viem v2)
const client = createPublicClient({ 
  transport: http(rpcUrl) 
});
const balance = await client.getBalance({ address });
const formatted = formatUnits(balance, 18);
```

#### Frontend Changes
```javascript
// OLD (ethers)
const { provider, signer } = useWeb3();
const contract = new ethers.Contract(address, abi, signer);

// NEW (viem v2)
const { walletClient, publicClient } = useWeb3();
const { writeContract, readContract } = useContract(address, abi);
```

#### Amount Handling
```javascript
// OLD (ethers BigNumber)
const amount = ethers.parseEther("1.0");
const formatted = ethers.formatEther(amount);

// NEW (viem bigint)
const amount = parseUnits("1.0", 18);
const formatted = formatUnits(amount, 18);
```

## Project Structure

```
enso-yield-farming/
├── backend/                     # Express.js API server
│   ├── src/
│   │   ├── controllers/         # API endpoint controllers
│   │   ├── services/           # Business logic services (viem v2)
│   │   ├── models/             # MongoDB models (NEW)
│   │   ├── db/                 # MongoDB connection (NEW)
│   │   ├── routes/             # API route definitions
│   │   ├── middleware/         # Security and validation
│   │   ├── config/             # Configuration files
│   │   └── utils/              # Helper utilities (viem v2)
│   └── server.js               # Entry point
├── frontend/                   # React + Vite application
│   ├── src/
│   │   ├── components/         # React components
│   │   ├── hooks/              # Custom React hooks (viem v2)
│   │   ├── context/            # Web3 context (viem v2)
│   │   ├── services/           # API and socket services
│   │   └── utils/              # Frontend utilities
│   └── index.html              # Entry HTML
├── docker-compose.yml          # Docker deployment
└── package.json               # Root package configuration
```

## API Endpoints

### Health & Status
- `GET /api/health` - Health check (includes MongoDB status)
- `GET /api/status` - System status

### Balance Management
- `GET /api/balances` - Get all balances (with MongoDB caching)
- `GET /api/balances/:chain` - Get chain-specific balances

### Farming Operations (viem v2)
- `POST /api/deposit` - Deposit EURe for LP tokens
- `POST /api/withdraw` - Withdraw LP tokens for EURe
- `POST /api/compound` - Auto-compound earnings
- `POST /api/estimate` - Estimate gas costs

### Transaction Management (MongoDB)
- `GET /api/transactions` - Get transaction history from MongoDB
- `GET /api/transactions/:id` - Get specific transaction
- `POST /api/transactions/retry` - Retry failed transaction

## Cross-Chain Operations

### Supported Chains
- **Polygon**: EURe token deposits (0x18ec0A6E18E5bc3784fDd3a3634b31245ab704F6)
- **Gnosis**: LP token rewards (0xedbc7449a9b594ca4e053d9737ec5dc4cbccbfb2)

### Workflow
1. **Deposit**: Send EURe on Polygon → Receive LP tokens on Gnosis
2. **Withdraw**: Send LP tokens on Gnosis → Receive EURe on Polygon  
3. **Compound**: Automatically reinvest earnings for optimal yield

## Technology Stack

### Backend
- **Express.js** - Web application framework
- **Socket.io** - Real-time communication
- **Enso SDK** - Cross-chain operations
- **viem v2** - Blockchain interactions (NEW)
- **MongoDB + Mongoose** - Data persistence (NEW)
- **Joi** - Input validation
- **Winston** - Logging

### Frontend
- **React 18** - User interface library
- **Vite** - Build tool and development server
- **Socket.io-client** - Real-time updates
- **viem v2** - Blockchain interactions (NEW)
- **React Hooks** - State management
- **CSS3** - Responsive styling

### Infrastructure
- **Docker** - Containerization
- **MongoDB** - Database (NEW)
- **Nginx** - Reverse proxy and load balancing

## Security Notes

**⚠️ Important Security Reminders:**
- Never commit private keys to version control
- Rotate any private keys that may have been exposed
- Use environment variables for all sensitive configuration
- Validate all user inputs before processing
- Use appropriate gas limits and slippage protection

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support and questions:
- Create an issue in this repository
- Contact the development team
- Check the [Enso SDK documentation](https://docs.enso.finance/)
- Review [viem documentation](https://viem.sh/) for blockchain interaction details

---

Built with ❤️ using viem v2 and the Enso SDK for seamless cross-chain yield farming.