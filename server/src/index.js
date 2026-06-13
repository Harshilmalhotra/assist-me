const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const config = require('./config');

// Import routes
const authRoutes = require('./routes/auth');
const sessionRoutes = require('./routes/sessions');
const chatRoutes = require('./routes/chat');
const recordingRoutes = require('./routes/recordings');
const adminRoutes = require('./routes/admin');
const metricsRoutes = require('./routes/metrics');

// Import socket setup
const setupSocket = require('./socket');

// Import mediasoup worker startup
const { startWorkers } = require('./media/worker');

const app = express();
const httpServer = http.createServer(app);

// Middleware
app.use(helmet({ crossOriginEmbedderPolicy: false }));
app.use(cors({
  origin: (origin, callback) => {
    // Allow all origins for local hackathon development
    callback(null, true);
  },
  credentials: true,
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded and recorded files statically
app.use('/uploads', express.static(path.resolve(config.storage.uploadDir)));
app.use('/recordings', express.static(path.resolve(config.storage.recordingDir)));

// Serve Client SPA bundle if built
app.use(express.static(path.join(__dirname, '../public')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/recordings', recordingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/metrics', metricsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Fallback to React Router in SPA production mode
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'), (err) => {
    if (err) {
      res.status(404).send('Not Found');
    }
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || 'Internal server error',
  });
});

// Start everything
async function start() {
  try {
    // Start mediasoup workers first
    await startWorkers();
    console.log('mediasoup workers started');

    // Set up Socket.IO
    setupSocket(httpServer);

    // Start HTTP server
    httpServer.listen(config.port, '0.0.0.0', () => {
      console.log(`Server running on port ${config.port}`);
    });
  } catch (err) {
    console.error('Startup failed:', err);
    process.exit(1);
  }
}

start();
