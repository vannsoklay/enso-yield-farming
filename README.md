# Enso Yield Farming Application

A comprehensive full-stack application for Enso SDK integration that enables cross-chain yield farming between Polygon and Gnosis chains.

## Features

- **Cross-Chain Yield Farming**: Seamlessly farm yield across Polygon and Gnosis chains
- **Real-Time Updates**: Live balance and transaction monitoring via WebSocket
- **Modern Stack**: Express.js backend with React + Vite frontend
- **Enso SDK Integration**: Leverages Enso's cross-chain capabilities
- **Security**: Rate limiting, input validation, and secure API endpoints
- **Production Ready**: Docker deployment with comprehensive error handling

## Quick Start

### Prerequisites

- Node.js 18+ and npm 8+
- Docker and Docker Compose (for production deployment)
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

## Project Structure

```
enso-yield-farming/
├── backend/                     # Express.js API server
│   ├── src/
│   │   ├── controllers/         # API endpoint controllers
│   │   ├── services/           # Business logic services
│   │   ├── routes/             # API route definitions
│   │   ├── middleware/         # Security and validation
│   │   ├── config/             # Configuration files
│   │   └── utils/              # Helper utilities
│   └── server.js               # Entry point
├── frontend/                   # React + Vite application
│   ├── src/
│   │   ├── components/         # React components
│   │   ├── hooks/              # Custom React hooks
│   │   ├── services/           # API and socket services
│   │   └── utils/              # Frontend utilities
│   └── index.html              # Entry HTML
├── docker-compose.yml          # Docker deployment
└── package.json               # Root package configuration
```

## API Endpoints

### Health & Status
- `GET /api/health` - Health check
- `GET /api/status` - System status

### Balance Management
- `GET /api/balances` - Get all balances
- `GET /api/balances/:chain` - Get chain-specific balances

### Farming Operations
- `POST /api/deposit` - Deposit EURe for LP tokens
- `POST /api/withdraw` - Withdraw LP tokens for EURe
- `POST /api/compound` - Auto-compound earnings
- `POST /api/estimate` - Estimate gas costs

### Transaction Management
- `GET /api/transactions` - Get transaction history
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
- **ethers.js** - Blockchain interactions
- **Joi** - Input validation
- **Winston** - Logging

### Frontend
- **React 18** - User interface library
- **Vite** - Build tool and development server
- **Socket.io-client** - Real-time updates
- **React Hooks** - State management
- **CSS3** - Responsive styling

### Infrastructure
- **Docker** - Containerization
- **Nginx** - Reverse proxy and load balancing
- **Redis** - Caching and session storage

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

---

Built with ❤️ using the Enso SDK for seamless cross-chain yield farming.