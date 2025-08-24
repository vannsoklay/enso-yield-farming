// Simple database configuration for SQLite
// In production, consider using PostgreSQL or MongoDB

const path = require('path');

const DATABASE_CONFIG = {
  // SQLite configuration
  sqlite: {
    filename: process.env.DATABASE_URL?.replace('sqlite:', '') || './data.db',
    options: {
      // Enable WAL mode for better performance
      journalMode: 'WAL',
      synchronous: 'NORMAL',
      cacheSize: 1000,
      busyTimeout: 5000
    }
  },
  
  // Table schemas
  schemas: {
    transactions: `
      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        user_address TEXT NOT NULL,
        type TEXT NOT NULL,
        amount TEXT NOT NULL,
        token_address TEXT NOT NULL,
        from_chain INTEGER NOT NULL,
        to_chain INTEGER NOT NULL,
        tx_hash TEXT,
        enso_tx_id TEXT,
        status TEXT DEFAULT 'pending',
        gas_used TEXT,
        gas_price TEXT,
        slippage REAL,
        error_message TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `,
    
    balances: `
      CREATE TABLE IF NOT EXISTS balances (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_address TEXT NOT NULL,
        token_address TEXT NOT NULL,
        chain_id INTEGER NOT NULL,
        balance TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_address, token_address, chain_id)
      )
    `,
    
    user_sessions: `
      CREATE TABLE IF NOT EXISTS user_sessions (
        session_id TEXT PRIMARY KEY,
        user_address TEXT NOT NULL,
        socket_id TEXT,
        last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `
  }
};

// Initialize database tables
const initializeDatabase = async (db) => {
  try {
    // Create tables if they don't exist
    for (const [tableName, schema] of Object.entries(DATABASE_CONFIG.schemas)) {
      await db.exec(schema);
    }
    
    console.log('✅ Database tables initialized successfully');
    return true;
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
};

// Get database file path
const getDatabasePath = () => {
  const dbPath = DATABASE_CONFIG.sqlite.filename;
  
  // Ensure absolute path
  if (path.isAbsolute(dbPath)) {
    return dbPath;
  }
  
  return path.join(process.cwd(), dbPath);
};

// Database connection options
const getConnectionOptions = () => {
  return {
    filename: getDatabasePath(),
    ...DATABASE_CONFIG.sqlite.options
  };
};

module.exports = {
  DATABASE_CONFIG,
  initializeDatabase,
  getDatabasePath,
  getConnectionOptions
};