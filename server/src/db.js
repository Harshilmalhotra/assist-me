const { Pool } = require('pg');
const config = require('./config');

const pool = new Pool(config.db);

pool.on('error', (err) => {
  console.error('PostgreSQL pool error:', err);
});

// Test connection on startup
pool.query('SELECT 1').then(() => {
  console.log('PostgreSQL connected successfully');
}).catch(err => {
  console.error('PostgreSQL connection failed:', err.message);
  process.exit(1);
});

module.exports = pool;
