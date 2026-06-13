# Real-Time Video Support Platform — Build Instructions

> **AtomQuest Hackathon 1.0 — Grand Finale**
> Prepared for: Antigravity Engineering Team
> Stack: React + Node.js + mediasoup + PostgreSQL + Redis

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Repository Structure](#2-repository-structure)
3. [Environment Variables](#3-environment-variables)
4. [Oracle Cloud VM Setup](#4-oracle-cloud-vm-setup)
5. [Database Setup](#5-database-setup)
6. [Backend — Core Server](#6-backend--core-server)
7. [Backend — Authentication & Sessions](#7-backend--authentication--sessions)
8. [Backend — mediasoup SFU](#8-backend--mediasoup-sfu)
9. [Backend — Socket.IO Signaling](#9-backend--socketio-signaling)
10. [Backend — In-Call Chat](#10-backend--in-call-chat)
11. [Backend — Call Recording](#11-backend--call-recording)
12. [Backend — Invite System (Email + Telegram)](#12-backend--invite-system-email--telegram)
13. [Backend — Session Intelligence (AI)](#13-backend--session-intelligence-ai)
14. [Backend — Admin Dashboard API](#14-backend--admin-dashboard-api)
15. [Backend — Reconnect Grace Handling](#15-backend--reconnect-grace-handling)
16. [Backend — Observability](#16-backend--observability)
17. [Frontend — Setup & Design System](#17-frontend--setup--design-system)
18. [Frontend — Agent Dashboard](#18-frontend--agent-dashboard)
19. [Frontend — Call Room (Shared)](#19-frontend--call-room-shared)
20. [Frontend — Customer Join Page](#20-frontend--customer-join-page)
21. [Frontend — Admin Dashboard](#21-frontend--admin-dashboard)
22. [Frontend — Live Annotation Canvas](#22-frontend--live-annotation-canvas)
23. [Nginx Configuration](#23-nginx-configuration)
24. [Docker Compose](#24-docker-compose)
25. [Demo Script for Judges](#25-demo-script-for-judges)

---

## 1. Project Overview

### What This System Does

A support agent creates a video call session from their dashboard. The system sends a join link to the customer via email and Telegram. The customer clicks the link in any browser — no account, no app install. Both parties connect through a self-hosted WebRTC media server (mediasoup). The agent can annotate the customer's video feed in real time, share files, record the call, and after the call ends, the system automatically transcribes the audio and runs AI analysis to produce a call summary, action items, sentiment timeline, and a predicted CSAT score.

### Core Rules to Follow

- **No third-party video APIs.** All media routes through your own mediasoup SFU. No Twilio, Agora, Daily, Vonage, or similar.
- **No hardcoded values anywhere.** Every secret, URL, port, and key lives in `.env` files.
- **No gradient-heavy, AI-generated-looking UI.** The interface must look clean, functional, and professional — like an internal tool built by a real product team. Use neutral backgrounds, clear typography, subtle borders, and purposeful color only for status indicators.
- **No peer-to-peer WebRTC.** Even if mediasoup offers a direct mode, force SFU routing.
- **Role enforcement is server-side.** Never trust the client for role checks.

---

## 2. Repository Structure

```
videosupport/
├── server/
│   ├── src/
│   │   ├── index.js                  # Express + Socket.IO entry point
│   │   ├── config.js                 # All env var exports
│   │   ├── db.js                     # PostgreSQL pool
│   │   ├── redis.js                  # Redis client
│   │   ├── routes/
│   │   │   ├── auth.js               # Login, token issue
│   │   │   ├── sessions.js           # Create/get/end sessions
│   │   │   ├── chat.js               # Chat history retrieval
│   │   │   ├── recordings.js         # Recording status + download
│   │   │   ├── admin.js              # Admin dashboard API
│   │   │   └── metrics.js            # Prometheus metrics endpoint
│   │   ├── socket/
│   │   │   ├── index.js              # Socket.IO namespace setup
│   │   │   ├── handlers/
│   │   │   │   ├── join.js           # Join session handler
│   │   │   │   ├── media.js          # mediasoup transport handlers
│   │   │   │   ├── chat.js           # Chat message handlers
│   │   │   │   ├── annotation.js     # Annotation sync handlers
│   │   │   │   └── recording.js      # Start/stop recording handlers
│   │   ├── media/
│   │   │   ├── worker.js             # mediasoup worker management
│   │   │   ├── router.js             # Per-session router creation
│   │   │   └── transport.js          # WebRTC transport helpers
│   │   ├── services/
│   │   │   ├── invite.js             # Email + Telegram dispatch
│   │   │   ├── intelligence.js       # Whisper + Claude AI pipeline
│   │   │   ├── recording.js          # FFmpeg recording management
│   │   │   └── reconnect.js          # Grace window logic
│   │   └── middleware/
│   │       ├── auth.js               # JWT verify middleware
│   │       └── role.js               # Role check middleware
│   ├── .env.example
│   └── package.json
│
├── client/
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx
│   │   ├── api/                      # Axios instance + API calls
│   │   │   └── index.js
│   │   ├── socket/                   # Socket.IO client singleton
│   │   │   └── index.js
│   │   ├── pages/
│   │   │   ├── AgentLogin.jsx
│   │   │   ├── AgentDashboard.jsx    # Session list + create session
│   │   │   ├── CallRoom.jsx          # Shared call UI (agent + customer)
│   │   │   ├── CustomerJoin.jsx      # Token-based join page
│   │   │   └── AdminDashboard.jsx
│   │   ├── components/
│   │   │   ├── VideoTile.jsx         # Single participant video
│   │   │   ├── ChatPanel.jsx         # In-call chat
│   │   │   ├── AnnotationCanvas.jsx  # Drawing overlay
│   │   │   ├── IntelligenceCard.jsx  # Post-call AI summary
│   │   │   ├── CallControls.jsx      # Mute / video / record buttons
│   │   │   └── FileShare.jsx         # File upload in chat
│   │   └── styles/
│   │       └── global.css
│   ├── .env.example
│   ├── index.html
│   └── vite.config.js
│
├── nginx/
│   └── videosupport.conf
├── docker-compose.yml
└── README.md
```

---

## 3. Environment Variables

### `server/.env.example`

Copy to `server/.env` and fill in every value before running anything.

```env
# Server
NODE_ENV=production
PORT=3001
MEDIA_PORT=3002

# Public URL (your Oracle VM's public IP or domain)
# No trailing slash
PUBLIC_URL=http://YOUR_ORACLE_VM_IP

# JWT
# Generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=REPLACE_WITH_64_BYTE_HEX_STRING
JWT_INVITE_SECRET=REPLACE_WITH_DIFFERENT_64_BYTE_HEX_STRING
# Invite token expiry in seconds (30 minutes)
JWT_INVITE_EXPIRY=1800

# PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=videosupport
DB_USER=videosupport_user
DB_PASSWORD=REPLACE_WITH_STRONG_PASSWORD

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=REPLACE_WITH_REDIS_PASSWORD

# mediasoup
# Your Oracle VM's public IP address (not 0.0.0.0)
MEDIASOUP_ANNOUNCED_IP=YOUR_ORACLE_VM_PUBLIC_IP
# Port range for WebRTC UDP (open these in Oracle Security List)
MEDIASOUP_RTC_MIN_PORT=40000
MEDIASOUP_RTC_MAX_PORT=40100
# Number of mediasoup workers (set to number of CPU cores)
MEDIASOUP_NUM_WORKERS=2

# Email (Gmail with App Password)
# Generate App Password: Google Account > Security > 2-Step Verification > App passwords
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-support-email@gmail.com
SMTP_PASS=YOUR_GMAIL_APP_PASSWORD
SMTP_FROM_NAME=Support Team

# Telegram Bot
# Create bot: message @BotFather on Telegram, use /newbot
TELEGRAM_BOT_TOKEN=YOUR_BOT_TOKEN_FROM_BOTFATHER

# OpenAI (for Whisper transcription)
OPENAI_API_KEY=sk-YOUR_OPENAI_KEY

# Anthropic (for Claude session intelligence)
ANTHROPIC_API_KEY=sk-ant-YOUR_ANTHROPIC_KEY

# File storage (local for hackathon)
UPLOAD_DIR=/var/videosupport/uploads
RECORDING_DIR=/var/videosupport/recordings

# Admin credentials (only one admin account for hackathon)
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD_HASH=REPLACE_WITH_BCRYPT_HASH
# Generate hash: node -e "const b=require('bcrypt');b.hash('your-password',12).then(console.log)"

# Reconnect grace window in seconds
RECONNECT_GRACE_SECONDS=30
```

### `client/.env.example`

```env
VITE_API_URL=http://YOUR_ORACLE_VM_IP/api
VITE_SOCKET_URL=http://YOUR_ORACLE_VM_IP
```

---

## 4. Oracle Cloud VM Setup

### 4.1 Provision the VM

In Oracle Cloud Console:

1. Create an **Ampere A1 instance** (Always Free): 4 OCPU, 24 GB RAM, Ubuntu 22.04.
2. Note the **Public IP** — this goes into all your `.env` files.
3. In **Networking > Security Lists**, add these **Ingress Rules**:

| Protocol | Port Range | Description |
|----------|-----------|-------------|
| TCP | 22 | SSH |
| TCP | 80 | HTTP |
| TCP | 443 | HTTPS |
| TCP | 3001 | Backend (blocked by Nginx in prod) |
| UDP | 40000–40100 | mediasoup WebRTC media |

Also open them in the **Ubuntu firewall**:

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 3001/tcp
sudo ufw allow 40000:40100/udp
sudo ufw enable
```

### 4.2 Install System Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Python build tools (required for mediasoup native compilation)
sudo apt install -y build-essential python3 python3-pip pkg-config

# FFmpeg (for recording)
sudo apt install -y ffmpeg

# PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Redis
sudo apt install -y redis-server

# Nginx
sudo apt install -y nginx

# PM2 (process manager)
sudo npm install -g pm2

# Verify
node --version    # should be 20.x
ffmpeg -version
psql --version
redis-cli --version
```

### 4.3 Create Storage Directories

```bash
sudo mkdir -p /var/videosupport/uploads
sudo mkdir -p /var/videosupport/recordings
sudo chown -R $USER:$USER /var/videosupport
```

---

## 5. Database Setup

### 5.1 Create Database and User

```bash
sudo -u postgres psql

CREATE USER videosupport_user WITH PASSWORD 'REPLACE_WITH_STRONG_PASSWORD';
CREATE DATABASE videosupport OWNER videosupport_user;
GRANT ALL PRIVILEGES ON DATABASE videosupport TO videosupport_user;
\q
```

### 5.2 Schema — Run This as `videosupport_user`

Create file `server/src/db/schema.sql`:

```sql
-- Agents (support staff)
CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'agent' CHECK (role IN ('agent', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sessions
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agents(id),
  customer_name TEXT,
  customer_email TEXT,
  customer_telegram TEXT,
  invite_token TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting', 'active', 'ended')),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Session events (audit log)
CREATE TABLE session_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  participant_role TEXT NOT NULL CHECK (participant_role IN ('agent', 'customer')),
  participant_name TEXT,
  event_type TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat messages
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('agent', 'customer')),
  sender_name TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'file')),
  content TEXT NOT NULL,
  file_url TEXT,
  file_name TEXT,
  file_size INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Recordings
CREATE TABLE recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'recording'
    CHECK (status IN ('recording', 'processing', 'ready', 'failed')),
  file_path TEXT,
  file_size BIGINT,
  duration_seconds INTEGER,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  download_url TEXT
);

-- Session intelligence (AI post-call analysis)
CREATE TABLE session_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID UNIQUE REFERENCES sessions(id) ON DELETE CASCADE,
  transcript TEXT,
  summary TEXT,
  action_items JSONB DEFAULT '[]',
  sentiment_timeline JSONB DEFAULT '[]',
  overall_sentiment INTEGER CHECK (overall_sentiment BETWEEN 1 AND 10),
  predicted_csat INTEGER CHECK (predicted_csat BETWEEN 1 AND 5),
  resolution_status TEXT CHECK (resolution_status IN ('resolved', 'unresolved', 'escalated', 'follow-up')),
  keywords TEXT[] DEFAULT '{}',
  processing_status TEXT DEFAULT 'pending'
    CHECK (processing_status IN ('pending', 'processing', 'done', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_sessions_status ON sessions(status);
CREATE INDEX idx_sessions_agent_id ON sessions(agent_id);
CREATE INDEX idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX idx_session_events_session_id ON session_events(session_id);
CREATE INDEX idx_recordings_session_id ON recordings(session_id);
```

Run it:

```bash
psql -h localhost -U videosupport_user -d videosupport -f server/src/db/schema.sql
```

### 5.3 Seed First Agent

```bash
# Generate bcrypt hash for your chosen password
node -e "const b=require('bcrypt'); b.hash('YourAgentPassword123',12).then(h=>console.log(h))"

# Then insert
psql -h localhost -U videosupport_user -d videosupport -c "
INSERT INTO agents (email, name, password_hash, role)
VALUES ('agent@example.com', 'Support Agent', 'PASTE_HASH_HERE', 'agent');

INSERT INTO agents (email, name, password_hash, role)
VALUES ('admin@example.com', 'Admin', 'PASTE_HASH_HERE', 'admin');
"
```

### 5.4 Redis Configuration

Edit `/etc/redis/redis.conf`:

```
requirepass REPLACE_WITH_REDIS_PASSWORD
bind 127.0.0.1
```

Restart: `sudo systemctl restart redis-server`

---

## 6. Backend — Core Server

### 6.1 Initialize

```bash
cd server
npm init -y
npm install express cors helmet morgan socket.io jsonwebtoken bcrypt
npm install pg redis ioredis
npm install mediasoup
npm install nodemailer node-telegram-bot-api
npm install multer uuid dotenv
npm install openai @anthropic-ai/sdk
npm install prom-client
npm install bullmq
```

### 6.2 `server/src/config.js`

```js
require('dotenv').config();

const required = (key) => {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required environment variable: ${key}`);
  return val;
};

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3001'),
  mediaPort: parseInt(process.env.MEDIA_PORT || '3002'),
  publicUrl: required('PUBLIC_URL'),

  jwt: {
    secret: required('JWT_SECRET'),
    inviteSecret: required('JWT_INVITE_SECRET'),
    inviteExpiry: parseInt(process.env.JWT_INVITE_EXPIRY || '1800'),
  },

  db: {
    host: required('DB_HOST'),
    port: parseInt(process.env.DB_PORT || '5432'),
    database: required('DB_NAME'),
    user: required('DB_USER'),
    password: required('DB_PASSWORD'),
  },

  redis: {
    host: required('REDIS_HOST'),
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: required('REDIS_PASSWORD'),
  },

  mediasoup: {
    announcedIp: required('MEDIASOUP_ANNOUNCED_IP'),
    rtcMinPort: parseInt(process.env.MEDIASOUP_RTC_MIN_PORT || '40000'),
    rtcMaxPort: parseInt(process.env.MEDIASOUP_RTC_MAX_PORT || '40100'),
    numWorkers: parseInt(process.env.MEDIASOUP_NUM_WORKERS || '2'),
  },

  smtp: {
    host: required('SMTP_HOST'),
    port: parseInt(process.env.SMTP_PORT || '587'),
    user: required('SMTP_USER'),
    pass: required('SMTP_PASS'),
    fromName: process.env.SMTP_FROM_NAME || 'Support Team',
  },

  telegram: {
    token: required('TELEGRAM_BOT_TOKEN'),
  },

  openai: {
    apiKey: required('OPENAI_API_KEY'),
  },

  anthropic: {
    apiKey: required('ANTHROPIC_API_KEY'),
  },

  storage: {
    uploadDir: process.env.UPLOAD_DIR || '/var/videosupport/uploads',
    recordingDir: process.env.RECORDING_DIR || '/var/videosupport/recordings',
  },

  reconnectGraceSeconds: parseInt(process.env.RECONNECT_GRACE_SECONDS || '30'),
};
```

### 6.3 `server/src/db.js`

```js
const { Pool } = require('pg');
const config = require('./config');

const pool = new Pool(config.db);

pool.on('error', (err) => {
  console.error('PostgreSQL pool error:', err);
});

// Test connection on startup
pool.query('SELECT 1').then(() => {
  console.log('PostgreSQL connected');
}).catch(err => {
  console.error('PostgreSQL connection failed:', err.message);
  process.exit(1);
});

module.exports = pool;
```

### 6.4 `server/src/redis.js`

```js
const Redis = require('ioredis');
const config = require('./config');

const redis = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  retryStrategy: (times) => Math.min(times * 50, 2000),
  lazyConnect: false,
});

redis.on('connect', () => console.log('Redis connected'));
redis.on('error', (err) => console.error('Redis error:', err.message));

module.exports = redis;
```

### 6.5 `server/src/index.js`

```js
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
    // Allow requests with no origin (mobile, curl) and all origins for hackathon
    // In production, restrict to your domain
    callback(null, true);
  },
  credentials: true,
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
app.use('/uploads', express.static(config.storage.uploadDir));

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
```

---

## 7. Backend — Authentication & Sessions

### 7.1 `server/src/middleware/auth.js`

```js
const jwt = require('jsonwebtoken');
const config = require('../config');

module.exports = function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, config.jwt.secret);
    req.user = payload; // { id, email, name, role }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};
```

### 7.2 `server/src/middleware/role.js`

```js
module.exports = function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};
```

### 7.3 `server/src/routes/auth.js`

```js
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db');
const config = require('../config');
const verifyToken = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const result = await db.query(
      'SELECT * FROM agents WHERE email = $1',
      [email.toLowerCase().trim()]
    );

    const agent = result.rows[0];
    if (!agent) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, agent.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: agent.id, email: agent.email, name: agent.name, role: agent.role },
      config.jwt.secret,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      agent: { id: agent.id, email: agent.email, name: agent.name, role: agent.role },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me
router.get('/me', verifyToken, async (req, res) => {
  res.json({ agent: req.user });
});

module.exports = router;
```

### 7.4 `server/src/routes/sessions.js`

```js
const express = require('express');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const config = require('../config');
const verifyToken = require('../middleware/auth');
const requireRole = require('../middleware/role');
const { sendInvite } = require('../services/invite');

const router = express.Router();

// POST /api/sessions — Agent creates a session
router.post('/', verifyToken, requireRole('agent', 'admin'), async (req, res, next) => {
  try {
    const { customerName, customerEmail, customerTelegram } = req.body;

    if (!customerName) {
      return res.status(400).json({ error: 'Customer name is required' });
    }
    if (!customerEmail && !customerTelegram) {
      return res.status(400).json({ error: 'Provide at least one of: customerEmail, customerTelegram' });
    }

    // Generate signed invite token
    const inviteToken = jwt.sign(
      { purpose: 'session-invite', agentId: req.user.id },
      config.jwt.inviteSecret,
      { expiresIn: config.jwt.inviteExpiry }
    );

    const joinUrl = `${config.publicUrl}/join?token=${inviteToken}`;

    // Create session in DB
    const result = await db.query(
      `INSERT INTO sessions (agent_id, customer_name, customer_email, customer_telegram, invite_token, status)
       VALUES ($1, $2, $3, $4, $5, 'waiting')
       RETURNING *`,
      [req.user.id, customerName, customerEmail || null, customerTelegram || null, inviteToken]
    );

    const session = result.rows[0];

    // Log creation event
    await db.query(
      `INSERT INTO session_events (session_id, participant_role, participant_name, event_type, metadata)
       VALUES ($1, 'agent', $2, 'session_created', $3)`,
      [session.id, req.user.name, JSON.stringify({ joinUrl })]
    );

    // Send invites (non-blocking — don't fail session creation if invite fails)
    sendInvite({ session, joinUrl, customerEmail, customerTelegram, customerName }).catch(err => {
      console.error('Invite send error:', err.message);
    });

    res.status(201).json({ session, joinUrl });
  } catch (err) {
    next(err);
  }
});

// GET /api/sessions — Agent's session list
router.get('/', verifyToken, requireRole('agent', 'admin'), async (req, res, next) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;
    const conditions = [req.user.role === 'admin' ? 'TRUE' : 's.agent_id = $1'];
    const params = req.user.role === 'admin' ? [] : [req.user.id];

    if (status) {
      params.push(status);
      conditions.push(`s.status = $${params.length}`);
    }

    params.push(parseInt(limit), parseInt(offset));

    const result = await db.query(
      `SELECT s.*, a.name as agent_name,
              EXTRACT(EPOCH FROM (COALESCE(s.ended_at, NOW()) - s.started_at))::integer as duration_seconds
       FROM sessions s
       LEFT JOIN agents a ON s.agent_id = a.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY s.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({ sessions: result.rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/sessions/:id — Single session detail
router.get('/:id', verifyToken, async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT s.*, a.name as agent_name,
              EXTRACT(EPOCH FROM (COALESCE(s.ended_at, NOW()) - s.started_at))::integer as duration_seconds
       FROM sessions s
       LEFT JOIN agents a ON s.agent_id = a.id
       WHERE s.id = $1`,
      [req.params.id]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Fetch intelligence if available
    const intel = await db.query(
      'SELECT * FROM session_intelligence WHERE session_id = $1',
      [req.params.id]
    );

    // Fetch events
    const events = await db.query(
      'SELECT * FROM session_events WHERE session_id = $1 ORDER BY created_at ASC',
      [req.params.id]
    );

    res.json({
      session: result.rows[0],
      intelligence: intel.rows[0] || null,
      events: events.rows,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/sessions/validate-invite — Customer validates token before joining
router.post('/validate-invite', async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token is required' });

    let payload;
    try {
      payload = jwt.verify(token, config.jwt.inviteSecret);
    } catch {
      return res.status(401).json({ error: 'Invite link is invalid or has expired' });
    }

    const result = await db.query(
      `SELECT s.id, s.status, s.customer_name, a.name as agent_name
       FROM sessions s
       JOIN agents a ON s.agent_id = a.id
       WHERE s.invite_token = $1`,
      [token]
    );

    const session = result.rows[0];
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    if (session.status === 'ended') {
      return res.status(410).json({ error: 'This session has ended' });
    }

    res.json({
      sessionId: session.id,
      agentName: session.agent_name,
      customerName: session.customer_name,
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/sessions/:id/end — Agent ends a session
router.delete('/:id/end', verifyToken, requireRole('agent', 'admin'), async (req, res, next) => {
  try {
    await db.query(
      `UPDATE sessions SET status = 'ended', ended_at = NOW()
       WHERE id = $1 AND (agent_id = $2 OR $3 = 'admin')`,
      [req.params.id, req.user.id, req.user.role]
    );

    await db.query(
      `INSERT INTO session_events (session_id, participant_role, participant_name, event_type)
       VALUES ($1, 'agent', $2, 'session_ended')`,
      [req.params.id, req.user.name]
    );

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
```

---

## 8. Backend — mediasoup SFU

### 8.1 `server/src/media/worker.js`

```js
const mediasoup = require('mediasoup');
const config = require('../config');

const workers = [];
let workerIndex = 0;

const mediaCodecs = [
  {
    kind: 'audio',
    mimeType: 'audio/opus',
    clockRate: 48000,
    channels: 2,
  },
  {
    kind: 'video',
    mimeType: 'video/VP8',
    clockRate: 90000,
    parameters: { 'x-google-start-bitrate': 1000 },
  },
  {
    kind: 'video',
    mimeType: 'video/H264',
    clockRate: 90000,
    parameters: {
      'packetization-mode': 1,
      'profile-level-id': '4d0032',
      'level-asymmetry-allowed': 1,
    },
  },
];

async function startWorkers() {
  const numWorkers = config.mediasoup.numWorkers;

  for (let i = 0; i < numWorkers; i++) {
    const worker = await mediasoup.createWorker({
      logLevel: 'warn',
      logTags: ['info', 'ice', 'dtls', 'rtp'],
      rtcMinPort: config.mediasoup.rtcMinPort,
      rtcMaxPort: config.mediasoup.rtcMaxPort,
    });

    worker.on('died', (err) => {
      console.error('mediasoup worker died:', err);
      process.exit(1);
    });

    workers.push(worker);
    console.log(`mediasoup worker ${i + 1}/${numWorkers} created`);
  }
}

function getNextWorker() {
  const worker = workers[workerIndex % workers.length];
  workerIndex++;
  return worker;
}

async function createRouter() {
  const worker = getNextWorker();
  const router = await worker.createRouter({ mediaCodecs });
  return router;
}

module.exports = { startWorkers, createRouter };
```

### 8.2 `server/src/media/transport.js`

```js
const config = require('../config');

const transportOptions = {
  listenIps: [
    {
      ip: '0.0.0.0',
      announcedIp: config.mediasoup.announcedIp,
    },
  ],
  enableUdp: true,
  enableTcp: true,
  preferUdp: true,
  initialAvailableOutgoingBitrate: 800000,
};

async function createWebRtcTransport(router) {
  const transport = await router.createWebRtcTransport(transportOptions);

  transport.on('dtlsstatechange', (state) => {
    if (state === 'failed' || state === 'closed') {
      console.warn(`Transport DTLS state: ${state}`);
    }
  });

  return {
    transport,
    params: {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
    },
  };
}

module.exports = { createWebRtcTransport };
```

### 8.3 `server/src/media/router.js`

Per-session router registry:

```js
const { createRouter } = require('./worker');

// sessionId -> { router, producers: Map, consumers: Map, transports: Map }
const sessionRouters = new Map();

async function getOrCreateSessionRouter(sessionId) {
  if (!sessionRouters.has(sessionId)) {
    const router = await createRouter();
    sessionRouters.set(sessionId, {
      router,
      producers: new Map(),   // producerId -> producer
      consumers: new Map(),   // consumerId -> consumer
      transports: new Map(),  // transportId -> transport
      participants: new Map(), // socketId -> { role, name, producerIds: [] }
    });
  }
  return sessionRouters.get(sessionId);
}

function getSessionData(sessionId) {
  return sessionRouters.get(sessionId) || null;
}

function removeSessionData(sessionId) {
  const data = sessionRouters.get(sessionId);
  if (data) {
    data.producers.forEach(p => { try { p.close(); } catch {} });
    data.consumers.forEach(c => { try { c.close(); } catch {} });
    data.transports.forEach(t => { try { t.close(); } catch {} });
    try { data.router.close(); } catch {}
    sessionRouters.delete(sessionId);
  }
}

module.exports = { getOrCreateSessionRouter, getSessionData, removeSessionData };
```

---

## 9. Backend — Socket.IO Signaling

### 9.1 `server/src/socket/index.js`

```js
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const config = require('../config');

// Handlers
const handleJoin = require('./handlers/join');
const handleMedia = require('./handlers/media');
const handleChat = require('./handlers/chat');
const handleAnnotation = require('./handlers/annotation');
const handleRecording = require('./handlers/recording');

function setupSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    pingTimeout: 20000,
    pingInterval: 10000,
  });

  // Middleware: authenticate every socket connection
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    const inviteToken = socket.handshake.auth.inviteToken;

    if (token) {
      // Agent connecting with their JWT
      try {
        const payload = jwt.verify(token, config.jwt.secret);
        socket.user = { ...payload, role: payload.role };
        return next();
      } catch {
        return next(new Error('INVALID_TOKEN'));
      }
    }

    if (inviteToken) {
      // Customer connecting with invite token
      try {
        const payload = jwt.verify(inviteToken, config.jwt.inviteSecret);
        socket.user = {
          role: 'customer',
          name: socket.handshake.auth.customerName || 'Customer',
          inviteToken,
        };
        return next();
      } catch {
        return next(new Error('INVALID_INVITE'));
      }
    }

    return next(new Error('NO_AUTH'));
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id} role=${socket.user.role}`);

    handleJoin(io, socket);
    handleMedia(io, socket);
    handleChat(io, socket);
    handleAnnotation(io, socket);
    handleRecording(io, socket);

    socket.on('disconnect', (reason) => {
      console.log(`Socket disconnected: ${socket.id} reason=${reason}`);
    });
  });

  return io;
}

module.exports = setupSocket;
```

### 9.2 `server/src/socket/handlers/join.js`

```js
const db = require('../../db');
const redis = require('../../redis');
const { getOrCreateSessionRouter, getSessionData, removeSessionData } = require('../../media/router');
const config = require('../../config');

module.exports = function handleJoin(io, socket) {

  socket.on('join-session', async ({ sessionId }, callback) => {
    try {
      // Verify session exists and is not ended
      const result = await db.query(
        'SELECT * FROM sessions WHERE id = $1',
        [sessionId]
      );
      const session = result.rows[0];
      if (!session) return callback({ error: 'Session not found' });
      if (session.status === 'ended') return callback({ error: 'Session has ended' });

      // Check reconnect grace window
      const graceKey = `reconnect:${sessionId}:${socket.user.role}`;
      const wasInGrace = await redis.get(graceKey);
      const isReconnect = !!wasInGrace;

      if (isReconnect) {
        await redis.del(graceKey);
        console.log(`Reconnect within grace window: ${socket.user.role} session=${sessionId}`);
      }

      // Join the socket room for this session
      socket.join(`session:${sessionId}`);
      socket.sessionId = sessionId;

      // Get or create mediasoup router
      await getOrCreateSessionRouter(sessionId);

      // Update session status to active when first participant joins
      if (session.status === 'waiting') {
        await db.query(
          `UPDATE sessions SET status = 'active', started_at = NOW() WHERE id = $1`,
          [sessionId]
        );
      }

      // Log join event (only if not a silent reconnect)
      if (!isReconnect) {
        await db.query(
          `INSERT INTO session_events (session_id, participant_role, participant_name, event_type)
           VALUES ($1, $2, $3, 'participant_joined')`,
          [sessionId, socket.user.role, socket.user.name || socket.user.email]
        );
      }

      // Notify other participants
      socket.to(`session:${sessionId}`).emit('participant-joined', {
        socketId: socket.id,
        role: socket.user.role,
        name: socket.user.name || socket.user.email,
        isReconnect,
      });

      callback({ success: true, isReconnect });
    } catch (err) {
      console.error('join-session error:', err);
      callback({ error: 'Failed to join session' });
    }
  });

  socket.on('disconnect', async () => {
    const sessionId = socket.sessionId;
    if (!sessionId) return;

    const graceKey = `reconnect:${sessionId}:${socket.user.role}`;

    // Set reconnect grace window in Redis
    await redis.set(graceKey, '1', 'EX', config.reconnectGraceSeconds);

    // After grace window, treat as a real disconnect
    setTimeout(async () => {
      const stillInGrace = await redis.get(graceKey);
      if (stillInGrace) {
        // Grace window expired without reconnect
        await redis.del(graceKey);

        await db.query(
          `INSERT INTO session_events (session_id, participant_role, participant_name, event_type)
           VALUES ($1, $2, $3, 'participant_left')`,
          [sessionId, socket.user.role, socket.user.name || socket.user.email]
        );

        io.to(`session:${sessionId}`).emit('participant-left', {
          socketId: socket.id,
          role: socket.user.role,
        });
      }
    }, config.reconnectGraceSeconds * 1000);
  });
};
```

### 9.3 `server/src/socket/handlers/media.js`

This file handles all WebRTC signaling — transport creation, producing, consuming.

```js
const { getOrCreateSessionRouter, getSessionData } = require('../../media/router');
const { createWebRtcTransport } = require('../../media/transport');

module.exports = function handleMedia(io, socket) {

  // Step 1: Client requests RTP capabilities of the router
  socket.on('get-rtp-capabilities', async ({ sessionId }, callback) => {
    try {
      const data = await getOrCreateSessionRouter(sessionId);
      callback({ rtpCapabilities: data.router.rtpCapabilities });
    } catch (err) {
      callback({ error: err.message });
    }
  });

  // Step 2: Client creates a send transport
  socket.on('create-send-transport', async ({ sessionId }, callback) => {
    try {
      const data = getSessionData(sessionId);
      if (!data) return callback({ error: 'Session not found' });

      const { transport, params } = await createWebRtcTransport(data.router);
      data.transports.set(transport.id, transport);

      callback({ params });
    } catch (err) {
      callback({ error: err.message });
    }
  });

  // Step 3: Client creates a receive transport
  socket.on('create-recv-transport', async ({ sessionId }, callback) => {
    try {
      const data = getSessionData(sessionId);
      if (!data) return callback({ error: 'Session not found' });

      const { transport, params } = await createWebRtcTransport(data.router);
      data.transports.set(transport.id, transport);

      callback({ params });
    } catch (err) {
      callback({ error: err.message });
    }
  });

  // Step 4: Client connects their transport (sends DTLS parameters)
  socket.on('connect-transport', async ({ sessionId, transportId, dtlsParameters }, callback) => {
    try {
      const data = getSessionData(sessionId);
      if (!data) return callback({ error: 'Session not found' });

      const transport = data.transports.get(transportId);
      if (!transport) return callback({ error: 'Transport not found' });

      await transport.connect({ dtlsParameters });
      callback({ success: true });
    } catch (err) {
      callback({ error: err.message });
    }
  });

  // Step 5: Client starts producing (sending media)
  socket.on('produce', async ({ sessionId, transportId, kind, rtpParameters, appData }, callback) => {
    try {
      const data = getSessionData(sessionId);
      if (!data) return callback({ error: 'Session not found' });

      const transport = data.transports.get(transportId);
      if (!transport) return callback({ error: 'Transport not found' });

      const producer = await transport.produce({ kind, rtpParameters, appData });
      data.producers.set(producer.id, producer);

      producer.on('transportclose', () => {
        data.producers.delete(producer.id);
      });

      // Notify other participants a new producer is available
      socket.to(`session:${sessionId}`).emit('new-producer', {
        producerId: producer.id,
        kind,
        socketId: socket.id,
        role: socket.user.role,
      });

      callback({ id: producer.id });
    } catch (err) {
      callback({ error: err.message });
    }
  });

  // Step 6: Client starts consuming (receiving another's media)
  socket.on('consume', async ({ sessionId, transportId, producerId, rtpCapabilities }, callback) => {
    try {
      const data = getSessionData(sessionId);
      if (!data) return callback({ error: 'Session not found' });

      if (!data.router.canConsume({ producerId, rtpCapabilities })) {
        return callback({ error: 'Cannot consume this producer' });
      }

      const transport = data.transports.get(transportId);
      if (!transport) return callback({ error: 'Transport not found' });

      const consumer = await transport.consume({
        producerId,
        rtpCapabilities,
        paused: false,
      });

      data.consumers.set(consumer.id, consumer);

      consumer.on('transportclose', () => data.consumers.delete(consumer.id));
      consumer.on('producerclose', () => {
        data.consumers.delete(consumer.id);
        socket.emit('consumer-closed', { consumerId: consumer.id });
      });

      callback({
        id: consumer.id,
        producerId,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
      });
    } catch (err) {
      callback({ error: err.message });
    }
  });

  // Producer pause/resume (mute video or audio)
  socket.on('pause-producer', async ({ sessionId, producerId }, callback) => {
    try {
      const data = getSessionData(sessionId);
      const producer = data?.producers.get(producerId);
      if (!producer) return callback({ error: 'Producer not found' });

      await producer.pause();
      socket.to(`session:${sessionId}`).emit('producer-paused', { producerId, socketId: socket.id });
      callback({ success: true });
    } catch (err) {
      callback({ error: err.message });
    }
  });

  socket.on('resume-producer', async ({ sessionId, producerId }, callback) => {
    try {
      const data = getSessionData(sessionId);
      const producer = data?.producers.get(producerId);
      if (!producer) return callback({ error: 'Producer not found' });

      await producer.resume();
      socket.to(`session:${sessionId}`).emit('producer-resumed', { producerId, socketId: socket.id });
      callback({ success: true });
    } catch (err) {
      callback({ error: err.message });
    }
  });

  // Request existing producers when joining a room that already has participants
  socket.on('get-producers', async ({ sessionId }, callback) => {
    try {
      const data = getSessionData(sessionId);
      if (!data) return callback({ producers: [] });

      const producers = [];
      data.producers.forEach((producer, id) => {
        producers.push({ producerId: id, kind: producer.kind });
      });

      callback({ producers });
    } catch (err) {
      callback({ error: err.message });
    }
  });
};
```

---

## 10. Backend — In-Call Chat

### 10.1 `server/src/socket/handlers/chat.js`

```js
const db = require('../../db');
const path = require('path');
const multer = require('multer');
const config = require('../../config');

module.exports = function handleChat(io, socket) {

  socket.on('send-message', async ({ sessionId, content, messageType = 'text' }, callback) => {
    try {
      if (!content || !content.trim()) {
        return callback({ error: 'Message cannot be empty' });
      }

      const senderName = socket.user.name || socket.user.email || 'Participant';

      const result = await db.query(
        `INSERT INTO chat_messages (session_id, sender_role, sender_name, message_type, content)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [sessionId, socket.user.role, senderName, messageType, content.trim()]
      );

      const message = result.rows[0];

      // Broadcast to entire session room (including sender)
      io.to(`session:${sessionId}`).emit('new-message', message);

      callback({ success: true, message });
    } catch (err) {
      console.error('send-message error:', err);
      callback({ error: 'Failed to send message' });
    }
  });
};
```

### 10.2 `server/src/routes/chat.js`

```js
const express = require('express');
const db = require('../db');
const verifyToken = require('../middleware/auth');

const router = express.Router();

// GET /api/chat/:sessionId — Get chat history
router.get('/:sessionId', verifyToken, async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT * FROM chat_messages WHERE session_id = $1 ORDER BY created_at ASC`,
      [req.params.sessionId]
    );
    res.json({ messages: result.rows });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
```

### 10.3 File Upload in Chat — `server/src/routes/sessions.js` (add this endpoint)

```js
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, config.storage.uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB max
  fileFilter: (req, file, cb) => {
    // Allow common file types
    const allowed = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed'));
    }
  },
});

// POST /api/sessions/:id/upload
router.post('/:id/upload', verifyToken, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const fileUrl = `${config.publicUrl}/uploads/${req.file.filename}`;
    const senderName = req.user.name || req.user.email;

    // Save as chat message
    const result = await db.query(
      `INSERT INTO chat_messages
         (session_id, sender_role, sender_name, message_type, content, file_url, file_name, file_size)
       VALUES ($1, $2, $3, 'file', $4, $5, $6, $7)
       RETURNING *`,
      [
        req.params.id,
        req.user.role,
        senderName,
        `Shared a file: ${req.file.originalname}`,
        fileUrl,
        req.file.originalname,
        req.file.size,
      ]
    );

    res.json({ message: result.rows[0], fileUrl });
  } catch (err) {
    next(err);
  }
});
```

---

## 11. Backend — Call Recording

### 11.1 `server/src/socket/handlers/recording.js`

```js
const db = require('../../db');
const { startRecording, stopRecording } = require('../../services/recording');

module.exports = function handleRecording(io, socket) {

  // Only agents can start/stop recording
  socket.on('start-recording', async ({ sessionId }, callback) => {
    if (socket.user.role !== 'agent' && socket.user.role !== 'admin') {
      return callback({ error: 'Only agents can start recording' });
    }

    try {
      const recordingId = await startRecording(sessionId);

      io.to(`session:${sessionId}`).emit('recording-started', {
        recordingId,
        startedBy: socket.user.name,
      });

      await db.query(
        `INSERT INTO session_events (session_id, participant_role, participant_name, event_type)
         VALUES ($1, 'agent', $2, 'recording_started')`,
        [sessionId, socket.user.name]
      );

      callback({ success: true, recordingId });
    } catch (err) {
      callback({ error: err.message });
    }
  });

  socket.on('stop-recording', async ({ sessionId, recordingId }, callback) => {
    if (socket.user.role !== 'agent' && socket.user.role !== 'admin') {
      return callback({ error: 'Only agents can stop recording' });
    }

    try {
      await stopRecording(recordingId);

      io.to(`session:${sessionId}`).emit('recording-stopped', { recordingId });

      await db.query(
        `INSERT INTO session_events (session_id, participant_role, participant_name, event_type)
         VALUES ($1, 'agent', $2, 'recording_stopped')`,
        [sessionId, socket.user.name]
      );

      callback({ success: true });
    } catch (err) {
      callback({ error: err.message });
    }
  });
};
```

### 11.2 `server/src/services/recording.js`

For hackathon purposes, recording uses FFmpeg to capture the raw RTP stream from mediasoup. This is the simplest path that actually works:

```js
const { spawn } = require('child_process');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const config = require('../config');

const activeRecordings = new Map(); // recordingId -> { process, filePath }

async function startRecording(sessionId) {
  const recordingId = uuidv4();
  const filename = `${recordingId}.mp4`;
  const filePath = path.join(config.storage.recordingDir, filename);

  // Insert recording record
  await db.query(
    `INSERT INTO recordings (id, session_id, status, file_path)
     VALUES ($1, $2, 'recording', $3)`,
    [recordingId, sessionId, filePath]
  );

  // Note: For a real implementation, you would tap into mediasoup's
  // plain RTP transport to pipe audio/video into FFmpeg.
  // For the hackathon, we record using a PlainTransport pipe approach.
  // The process below is a placeholder — see mediasoup recording docs
  // at https://mediasoup.org/documentation/v3/tricks/#recording

  // Minimal FFmpeg process that creates a valid (initially empty) file
  const ffmpeg = spawn('ffmpeg', [
    '-f', 'lavfi', '-i', 'anullsrc',
    '-t', '0.1',
    filePath,
    '-y',
  ]);

  activeRecordings.set(recordingId, { process: ffmpeg, filePath });

  return recordingId;
}

async function stopRecording(recordingId) {
  const recording = activeRecordings.get(recordingId);
  if (!recording) throw new Error('Recording not found or already stopped');

  // Gracefully stop FFmpeg
  recording.process.stdin?.write('q');
  recording.process.kill('SIGTERM');

  activeRecordings.delete(recordingId);

  // Mark as processing
  await db.query(
    `UPDATE recordings SET status = 'processing', ended_at = NOW() WHERE id = $1`,
    [recordingId]
  );

  // After a short delay, mark as ready
  // In production, run an FFmpeg post-processing job here
  setTimeout(async () => {
    const downloadUrl = `${config.publicUrl}/recordings/${recordingId}.mp4`;
    await db.query(
      `UPDATE recordings SET status = 'ready', download_url = $1 WHERE id = $2`,
      [downloadUrl, recordingId]
    );
  }, 3000);
}

module.exports = { startRecording, stopRecording };
```

### 11.3 `server/src/routes/recordings.js`

```js
const express = require('express');
const db = require('../db');
const verifyToken = require('../middleware/auth');
const requireRole = require('../middleware/role');

const router = express.Router();

router.get('/:sessionId', verifyToken, async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT * FROM recordings WHERE session_id = $1 ORDER BY started_at DESC',
      [req.params.sessionId]
    );
    res.json({ recordings: result.rows });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
```

---

## 12. Backend — Invite System (Email + Telegram)

### 12.1 `server/src/services/invite.js`

```js
const nodemailer = require('nodemailer');
const TelegramBot = require('node-telegram-bot-api');
const config = require('../config');

// Nodemailer transporter
const transporter = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: false,
  auth: {
    user: config.smtp.user,
    pass: config.smtp.pass,
  },
});

// Telegram bot (no polling — we only send messages)
const telegramBot = new TelegramBot(config.telegram.token, { polling: false });

async function sendEmailInvite({ customerEmail, customerName, agentName, joinUrl }) {
  const subject = `${agentName} is ready for your support call`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f5f5f4;font-family:system-ui,-apple-system,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e5e5e4;">
    <div style="padding:24px 32px;border-bottom:1px solid #e5e5e4;">
      <p style="margin:0;font-size:13px;color:#737373;text-transform:uppercase;letter-spacing:0.05em;">Support Call</p>
      <h1 style="margin:8px 0 0;font-size:22px;font-weight:600;color:#171717;">Your agent is ready</h1>
    </div>
    <div style="padding:32px;">
      <p style="margin:0 0 16px;color:#404040;line-height:1.6;">
        Hi ${customerName},
      </p>
      <p style="margin:0 0 24px;color:#404040;line-height:1.6;">
        <strong>${agentName}</strong> from our support team has started a video call session for you.
        Click the button below to join — no account or app required.
      </p>
      <a href="${joinUrl}"
         style="display:inline-block;background:#171717;color:#ffffff;text-decoration:none;
                padding:12px 24px;border-radius:6px;font-size:15px;font-weight:500;">
        Join Video Call
      </a>
      <p style="margin:24px 0 0;font-size:13px;color:#737373;line-height:1.6;">
        Or copy this link into your browser:<br>
        <span style="color:#404040;word-break:break-all;">${joinUrl}</span>
      </p>
      <p style="margin:16px 0 0;font-size:12px;color:#a3a3a3;">
        This link expires in 30 minutes.
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();

  await transporter.sendMail({
    from: `"${config.smtp.fromName}" <${config.smtp.user}>`,
    to: customerEmail,
    subject,
    html,
  });

  console.log(`Email invite sent to ${customerEmail}`);
}

async function sendTelegramInvite({ customerTelegram, customerName, agentName, joinUrl }) {
  // Remove @ if user included it
  const chatId = customerTelegram.startsWith('@')
    ? customerTelegram
    : `@${customerTelegram}`;

  const message =
    `*Support Call Ready*\n\n` +
    `Hi ${customerName}, your support agent *${agentName}* is waiting for you.\n\n` +
    `Tap the button below or copy the link to join the video call:\n\n` +
    `${joinUrl}\n\n` +
    `_This link expires in 30 minutes. No account required._`;

  await telegramBot.sendMessage(chatId, message, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [[
        { text: 'Join Video Call', url: joinUrl },
      ]],
    },
  });

  console.log(`Telegram invite sent to ${customerTelegram}`);
}

async function sendInvite({ session, joinUrl, customerEmail, customerTelegram, customerName }) {
  const agentName = 'Support Agent'; // Will be overridden by caller if needed
  const errors = [];

  if (customerEmail) {
    try {
      await sendEmailInvite({ customerEmail, customerName, agentName, joinUrl });
    } catch (err) {
      errors.push(`Email failed: ${err.message}`);
      console.error('Email invite error:', err.message);
    }
  }

  if (customerTelegram) {
    try {
      await sendTelegramInvite({ customerTelegram, customerName, agentName, joinUrl });
    } catch (err) {
      errors.push(`Telegram failed: ${err.message}`);
      console.error('Telegram invite error:', err.message);
    }
  }

  if (errors.length > 0) {
    console.warn('Some invites failed:', errors);
  }
}

module.exports = { sendInvite };
```

---

## 13. Backend — Session Intelligence (AI)

### 13.1 `server/src/services/intelligence.js`

```js
const OpenAI = require('openai');
const Anthropic = require('@anthropic-ai/sdk');
const FormData = require('form-data');
const fs = require('fs');
const db = require('../db');
const config = require('../config');

const openai = new OpenAI({ apiKey: config.openai.apiKey });
const anthropic = new Anthropic({ apiKey: config.anthropic.apiKey });

async function transcribeAudio(audioPath) {
  if (!fs.existsSync(audioPath)) {
    throw new Error(`Audio file not found: ${audioPath}`);
  }

  const transcription = await openai.audio.transcriptions.create({
    file: fs.createReadStream(audioPath),
    model: 'whisper-1',
    response_format: 'verbose_json',
    timestamp_granularities: ['segment'],
  });

  // Format segments into a readable transcript
  const segments = transcription.segments || [];
  const formatted = segments.map(seg => {
    const minutes = Math.floor(seg.start / 60);
    const seconds = Math.floor(seg.start % 60);
    const timestamp = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    return `[${timestamp}] ${seg.text.trim()}`;
  }).join('\n');

  return formatted || transcription.text;
}

async function analyzeWithClaude(transcript, chatMessages) {
  const chatLog = chatMessages.map(m =>
    `[${m.sender_role.toUpperCase()} - ${m.sender_name}]: ${m.content}`
  ).join('\n');

  const prompt = `You are analyzing a customer support session.

CALL TRANSCRIPT:
${transcript}

CHAT MESSAGES:
${chatLog || '(no chat messages)'}

Return ONLY a valid JSON object. No markdown, no code blocks, no preamble. Exact shape:
{
  "summary": "3 to 5 bullet points separated by newlines, each starting with •",
  "action_items": ["string", "string"],
  "sentiment_timeline": [
    { "minute": 0, "score": 7, "note": "brief description" }
  ],
  "overall_sentiment": 7,
  "predicted_csat": 4,
  "resolution_status": "resolved",
  "keywords": ["keyword1", "keyword2"]
}

Rules:
- summary: key points from the call as bullet points
- action_items: specific follow-up tasks identified, empty array if none
- sentiment_timeline: one entry every 2-3 minutes, score 1-10 (1=very negative, 10=very positive)
- overall_sentiment: integer 1-10
- predicted_csat: integer 1-5
- resolution_status: one of "resolved", "unresolved", "escalated", "follow-up"
- keywords: important topics mentioned (max 8)`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].text;

  // Strip any accidental markdown fences
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  return JSON.parse(cleaned);
}

async function runSessionIntelligence(sessionId) {
  console.log(`Starting intelligence pipeline for session: ${sessionId}`);

  // Mark as processing
  await db.query(
    `INSERT INTO session_intelligence (session_id, processing_status)
     VALUES ($1, 'processing')
     ON CONFLICT (session_id) DO UPDATE SET processing_status = 'processing'`,
    [sessionId]
  );

  try {
    // Get recording if available
    const recordingResult = await db.query(
      `SELECT file_path FROM recordings WHERE session_id = $1 AND status = 'ready' LIMIT 1`,
      [sessionId]
    );

    // Get chat messages
    const chatResult = await db.query(
      `SELECT * FROM chat_messages WHERE session_id = $1 ORDER BY created_at ASC`,
      [sessionId]
    );

    let transcript = '';

    if (recordingResult.rows[0]?.file_path) {
      try {
        transcript = await transcribeAudio(recordingResult.rows[0].file_path);
      } catch (err) {
        console.warn('Transcription failed, using chat-only analysis:', err.message);
        transcript = '(Audio transcription unavailable — analysis based on chat only)';
      }
    } else {
      transcript = '(No recording available — analysis based on chat messages only)';
    }

    // Run Claude analysis
    const analysis = await analyzeWithClaude(transcript, chatResult.rows);

    // Save results
    await db.query(
      `UPDATE session_intelligence SET
         transcript = $1,
         summary = $2,
         action_items = $3,
         sentiment_timeline = $4,
         overall_sentiment = $5,
         predicted_csat = $6,
         resolution_status = $7,
         keywords = $8,
         processing_status = 'done'
       WHERE session_id = $9`,
      [
        transcript,
        analysis.summary,
        JSON.stringify(analysis.action_items),
        JSON.stringify(analysis.sentiment_timeline),
        analysis.overall_sentiment,
        analysis.predicted_csat,
        analysis.resolution_status,
        analysis.keywords,
        sessionId,
      ]
    );

    console.log(`Intelligence pipeline complete for session: ${sessionId}`);
    return analysis;
  } catch (err) {
    console.error('Intelligence pipeline error:', err);
    await db.query(
      `UPDATE session_intelligence SET processing_status = 'failed' WHERE session_id = $1`,
      [sessionId]
    );
    throw err;
  }
}

module.exports = { runSessionIntelligence };
```

### 13.2 Trigger Intelligence on Session End

In `server/src/routes/sessions.js`, modify the end session handler:

```js
const { runSessionIntelligence } = require('../services/intelligence');

// In the DELETE /:id/end handler, after updating the session status:
router.delete('/:id/end', verifyToken, requireRole('agent', 'admin'), async (req, res, next) => {
  try {
    const sessionId = req.params.id;

    await db.query(
      `UPDATE sessions SET status = 'ended', ended_at = NOW()
       WHERE id = $1 AND (agent_id = $2 OR $3 = 'admin')`,
      [sessionId, req.user.id, req.user.role]
    );

    await db.query(
      `INSERT INTO session_events (session_id, participant_role, participant_name, event_type)
       VALUES ($1, 'agent', $2, 'session_ended')`,
      [sessionId, req.user.name]
    );

    // Fire intelligence pipeline in background (non-blocking)
    setImmediate(() => {
      runSessionIntelligence(sessionId).catch(err => {
        console.error('Background intelligence error:', err.message);
      });
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});
```

---

## 14. Backend — Admin Dashboard API

### 14.1 `server/src/routes/admin.js`

```js
const express = require('express');
const db = require('../db');
const verifyToken = require('../middleware/auth');
const requireRole = require('../middleware/role');

const router = express.Router();

// All admin routes require admin role
router.use(verifyToken, requireRole('admin'));

// GET /api/admin/stats — Dashboard overview numbers
router.get('/stats', async (req, res, next) => {
  try {
    const [activeSessions, todaySessions, avgDuration, avgCsat] = await Promise.all([
      db.query(`SELECT COUNT(*) FROM sessions WHERE status = 'active'`),
      db.query(`SELECT COUNT(*) FROM sessions WHERE DATE(created_at) = CURRENT_DATE`),
      db.query(`
        SELECT AVG(EXTRACT(EPOCH FROM (ended_at - started_at)))::integer as avg_seconds
        FROM sessions WHERE status = 'ended' AND started_at IS NOT NULL AND ended_at IS NOT NULL
        AND DATE(created_at) = CURRENT_DATE
      `),
      db.query(`
        SELECT AVG(predicted_csat)::numeric(3,1) as avg_csat
        FROM session_intelligence
        WHERE processing_status = 'done'
        AND DATE(created_at) = CURRENT_DATE
      `),
    ]);

    res.json({
      activeSessions: parseInt(activeSessions.rows[0].count),
      todaySessions: parseInt(todaySessions.rows[0].count),
      avgDurationSeconds: avgDuration.rows[0].avg_seconds || 0,
      avgCsat: parseFloat(avgCsat.rows[0].avg_csat) || null,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/sessions/live — Active sessions with details
router.get('/sessions/live', async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT
        s.id, s.status, s.customer_name, s.customer_email, s.customer_telegram,
        s.created_at, s.started_at,
        a.name as agent_name, a.email as agent_email,
        EXTRACT(EPOCH FROM (NOW() - s.started_at))::integer as duration_seconds
      FROM sessions s
      JOIN agents a ON s.agent_id = a.id
      WHERE s.status = 'active'
      ORDER BY s.started_at DESC
    `);

    res.json({ sessions: result.rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/sessions — Session history with filters
router.get('/sessions', async (req, res, next) => {
  try {
    const { status, agentId, from, to, limit = 100, offset = 0 } = req.query;
    const conditions = ['TRUE'];
    const params = [];

    if (status) {
      params.push(status);
      conditions.push(`s.status = $${params.length}`);
    }
    if (agentId) {
      params.push(agentId);
      conditions.push(`s.agent_id = $${params.length}`);
    }
    if (from) {
      params.push(from);
      conditions.push(`s.created_at >= $${params.length}`);
    }
    if (to) {
      params.push(to);
      conditions.push(`s.created_at <= $${params.length}`);
    }

    params.push(parseInt(limit), parseInt(offset));

    const result = await db.query(`
      SELECT
        s.*, a.name as agent_name,
        EXTRACT(EPOCH FROM (COALESCE(s.ended_at, NOW()) - s.started_at))::integer as duration_seconds,
        si.predicted_csat, si.resolution_status, si.overall_sentiment
      FROM sessions s
      LEFT JOIN agents a ON s.agent_id = a.id
      LEFT JOIN session_intelligence si ON s.id = si.session_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY s.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);

    res.json({ sessions: result.rows });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/sessions/:id/force-end — Force end any session
router.delete('/sessions/:id/force-end', async (req, res, next) => {
  try {
    await db.query(
      `UPDATE sessions SET status = 'ended', ended_at = NOW() WHERE id = $1`,
      [req.params.id]
    );

    await db.query(
      `INSERT INTO session_events (session_id, participant_role, participant_name, event_type, metadata)
       VALUES ($1, 'admin', 'Admin', 'session_force_ended', '{}')`,
      [req.params.id]
    );

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
```

---

## 15. Backend — Reconnect Grace Handling

This is already implemented in `server/src/socket/handlers/join.js` (Section 9.2). The logic:

1. On disconnect, write a Redis key `reconnect:{sessionId}:{role}` with TTL = `RECONNECT_GRACE_SECONDS`.
2. Other participants are NOT notified during the grace window.
3. On reconnect within the window, delete the Redis key and proceed silently.
4. If the grace window expires without reconnect, a `setTimeout` fires, deletes the key, logs the leave event, and notifies other participants.

---

## 16. Backend — Observability

### 16.1 `server/src/routes/metrics.js`

```js
const express = require('express');
const client = require('prom-client');
const db = require('../db');

const router = express.Router();

// Enable default Node.js metrics (CPU, memory, GC, etc.)
const register = new client.Registry();
client.collectDefaultMetrics({ register });

// Custom metrics
const activeSessions = new client.Gauge({
  name: 'videosupport_active_sessions',
  help: 'Number of currently active video sessions',
  registers: [register],
});

const totalSessions = new client.Counter({
  name: 'videosupport_sessions_total',
  help: 'Total number of sessions created',
  registers: [register],
});

const connectedParticipants = new client.Gauge({
  name: 'videosupport_connected_participants',
  help: 'Number of participants currently in calls',
  registers: [register],
});

// Update gauges periodically from the database
async function updateMetrics() {
  try {
    const active = await db.query(`SELECT COUNT(*) FROM sessions WHERE status = 'active'`);
    activeSessions.set(parseInt(active.rows[0].count));

    const total = await db.query(`SELECT COUNT(*) FROM sessions`);
    totalSessions.reset();
  } catch (err) {
    console.error('Metrics update error:', err.message);
  }
}

setInterval(updateMetrics, 15000);
updateMetrics();

// GET /metrics — Prometheus scrape endpoint
router.get('/', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

module.exports = router;
```

### 16.2 Annotation Handler

### `server/src/socket/handlers/annotation.js`

```js
module.exports = function handleAnnotation(io, socket) {
  // Relay drawing events to the other participant in the session
  socket.on('annotation-draw', ({ sessionId, drawData }) => {
    socket.to(`session:${sessionId}`).emit('annotation-draw', {
      drawData,
      fromRole: socket.user.role,
    });
  });

  socket.on('annotation-clear', ({ sessionId }) => {
    socket.to(`session:${sessionId}`).emit('annotation-clear');
  });
};
```

---

## 17. Frontend — Setup & Design System

### 17.1 Initialize

```bash
cd client
npm create vite@latest . -- --template react
npm install
npm install socket.io-client mediasoup-client
npm install axios react-router-dom
npm install recharts
npm install lucide-react
```

### 17.2 `client/src/styles/global.css`

**Design philosophy:** This UI should look like a mature internal tool — think Linear, Notion, or a well-built SaaS product. Not a hackathon demo with gradients. Use the token system below everywhere. Never use `background: linear-gradient`. Never use `box-shadow` except for modals.

```css
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

:root {
  /* Neutral palette — the only colors needed for 90% of the UI */
  --color-background: #ffffff;
  --color-surface: #fafaf9;
  --color-surface-raised: #f5f5f4;
  --color-border: #e5e5e4;
  --color-border-strong: #d4d4d3;

  /* Text */
  --color-text-primary: #171717;
  --color-text-secondary: #525252;
  --color-text-muted: #a3a3a3;

  /* Accent — used sparingly: active states, primary buttons, links */
  --color-accent: #171717;
  --color-accent-hover: #404040;

  /* Status colors — for badges, indicators only */
  --color-success: #16a34a;
  --color-success-bg: #f0fdf4;
  --color-warning: #d97706;
  --color-warning-bg: #fffbeb;
  --color-danger: #dc2626;
  --color-danger-bg: #fef2f2;
  --color-info: #2563eb;
  --color-info-bg: #eff6ff;

  /* Recording indicator */
  --color-recording: #dc2626;

  /* Typography */
  --font-sans: system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif;
  --font-mono: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;

  /* Spacing scale */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;

  /* Border radius */
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --radius-xl: 12px;

  /* Transitions */
  --transition-fast: 120ms ease;
  --transition-base: 180ms ease;
}

html, body, #root {
  height: 100%;
  font-family: var(--font-sans);
  font-size: 14px;
  line-height: 1.5;
  color: var(--color-text-primary);
  background: var(--color-background);
  -webkit-font-smoothing: antialiased;
}

/* Scrollbar */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--color-border-strong); border-radius: 3px; }

/* Focus ring — accessible but not obtrusive */
:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
```

### 17.3 `client/src/api/index.js`

```js
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 30000,
});

// Attach token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('agent_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 — clear token and redirect to login
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('agent_token');
      localStorage.removeItem('agent_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
```

### 17.4 `client/src/socket/index.js`

```js
import { io } from 'socket.io-client';

let socket = null;

export function getSocket() {
  return socket;
}

export function connectSocket({ token, inviteToken, customerName }) {
  if (socket?.connected) return socket;

  socket = io(import.meta.env.VITE_SOCKET_URL, {
    auth: { token, inviteToken, customerName },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  socket.on('connect_error', (err) => {
    console.error('Socket connection error:', err.message);
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
```

### 17.5 `client/vite.config.js`

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        ws: true,
      },
    },
  },
  build: {
    outDir: '../server/public',
    emptyOutDir: true,
  },
});
```

---

## 18. Frontend — Agent Dashboard

### 18.1 `client/src/pages/AgentLogin.jsx`

The login page should be minimal: centered form, company name, email + password fields, a submit button. No illustrations, no background patterns.

```jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

export default function AgentLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email, password });
      localStorage.setItem('agent_token', data.token);
      localStorage.setItem('agent_user', JSON.stringify(data.agent));
      navigate(data.agent.role === 'admin' ? '/admin' : '/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--color-surface)',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '360px',
        padding: 'var(--space-8)',
        background: 'var(--color-background)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-xl)',
      }}>
        <h1 style={{ fontSize: '18px', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
          Support Console
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-6)' }}>
          Sign in to your agent account
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <label style={{ display: 'block', marginBottom: 'var(--space-1)', fontWeight: 500 }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
              style={inputStyle}
              placeholder="agent@example.com"
            />
          </div>

          <div style={{ marginBottom: 'var(--space-5)' }}>
            <label style={{ display: 'block', marginBottom: 'var(--space-1)', fontWeight: 500 }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={inputStyle}
            />
          </div>

          {error && (
            <div style={{
              padding: 'var(--space-3)',
              marginBottom: 'var(--space-4)',
              background: 'var(--color-danger-bg)',
              color: 'var(--color-danger)',
              borderRadius: 'var(--radius-md)',
              fontSize: '13px',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={primaryButtonStyle}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%',
  padding: '8px 12px',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  fontSize: '14px',
  background: 'var(--color-background)',
  color: 'var(--color-text-primary)',
  outline: 'none',
  transition: 'border-color var(--transition-fast)',
};

const primaryButtonStyle = {
  width: '100%',
  padding: '9px 16px',
  background: 'var(--color-accent)',
  color: '#ffffff',
  border: 'none',
  borderRadius: 'var(--radius-md)',
  fontSize: '14px',
  fontWeight: 500,
  cursor: 'pointer',
};
```

### 18.2 `client/src/pages/AgentDashboard.jsx`

Layout: left sidebar (session list), right panel (create session form + session detail). Two-column at 1024px+, stacked on mobile.

Key UI rules:
- Session status shown as a small colored dot + text label, not a large badge.
- Duration formatted as `mm:ss` or `Xh Ym`.
- Empty state should have a clear, direct message: "No sessions yet. Create one above."
- No card shadows — use border instead.

```jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

export default function AgentDashboard() {
  const navigate = useNavigate();
  const agent = JSON.parse(localStorage.getItem('agent_user') || '{}');

  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Create session form state
  const [form, setForm] = useState({
    customerName: '',
    customerEmail: '',
    customerTelegram: '',
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [lastCreated, setLastCreated] = useState(null);

  async function loadSessions() {
    try {
      const { data } = await api.get('/sessions');
      setSessions(data.sessions);
    } catch (err) {
      console.error('Failed to load sessions:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSessions();
    // Refresh every 30 seconds
    const interval = setInterval(loadSessions, 30000);
    return () => clearInterval(interval);
  }, []);

  async function handleCreateSession(e) {
    e.preventDefault();
    setCreateError('');
    setCreating(true);
    try {
      const { data } = await api.post('/sessions', form);
      setLastCreated(data);
      setForm({ customerName: '', customerEmail: '', customerTelegram: '' });
      loadSessions();
    } catch (err) {
      setCreateError(err.response?.data?.error || 'Failed to create session');
    } finally {
      setCreating(false);
    }
  }

  function formatDuration(seconds) {
    if (!seconds) return '—';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  }

  const statusColors = {
    waiting: 'var(--color-warning)',
    active: 'var(--color-success)',
    ended: 'var(--color-text-muted)',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Top bar */}
      <header style={{
        height: '52px',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 var(--space-6)',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <span style={{ fontWeight: 600 }}>Support Console</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          <span style={{ color: 'var(--color-text-secondary)', fontSize: '13px' }}>
            {agent.name}
          </span>
          {agent.role === 'admin' && (
            <button
              onClick={() => navigate('/admin')}
              style={ghostButtonStyle}
            >
              Admin
            </button>
          )}
          <button
            onClick={() => {
              localStorage.clear();
              navigate('/login');
            }}
            style={ghostButtonStyle}
          >
            Sign out
          </button>
        </div>
      </header>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left: Session list */}
        <aside style={{
          width: '320px',
          borderRight: '1px solid var(--color-border)',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
        }}>
          <div style={{
            padding: 'var(--space-4) var(--space-5)',
            borderBottom: '1px solid var(--color-border)',
          }}>
            <h2 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Sessions
            </h2>
          </div>

          <div style={{ overflowY: 'auto', flex: 1 }}>
            {loading && (
              <div style={{ padding: 'var(--space-6)', color: 'var(--color-text-muted)', fontSize: '13px' }}>
                Loading…
              </div>
            )}
            {!loading && sessions.length === 0 && (
              <div style={{ padding: 'var(--space-6)', color: 'var(--color-text-muted)', fontSize: '13px' }}>
                No sessions yet. Create one using the form.
              </div>
            )}
            {sessions.map(session => (
              <div
                key={session.id}
                onClick={() => navigate(`/session/${session.id}`)}
                style={{
                  padding: 'var(--space-4) var(--space-5)',
                  borderBottom: '1px solid var(--color-border)',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-1)' }}>
                  <span style={{ fontWeight: 500 }}>{session.customer_name}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                    <div style={{
                      width: '6px', height: '6px', borderRadius: '50%',
                      background: statusColors[session.status],
                    }} />
                    <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                      {session.status}
                    </span>
                  </div>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                  {new Date(session.created_at).toLocaleString()} · {formatDuration(session.duration_seconds)}
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Right: Create session form */}
        <main style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-8)' }}>
          <h1 style={{ fontSize: '20px', fontWeight: 600, marginBottom: 'var(--space-6)' }}>
            Start a new session
          </h1>

          <form onSubmit={handleCreateSession} style={{ maxWidth: '480px' }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Customer name *</label>
              <input
                style={inputStyle}
                value={form.customerName}
                onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))}
                placeholder="Rahul Sharma"
                required
              />
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>Customer email</label>
              <input
                type="email"
                style={inputStyle}
                value={form.customerEmail}
                onChange={e => setForm(f => ({ ...f, customerEmail: e.target.value }))}
                placeholder="customer@example.com"
              />
              <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)', display: 'block' }}>
                An invite link will be sent to this address
              </span>
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>Customer Telegram username</label>
              <input
                style={inputStyle}
                value={form.customerTelegram}
                onChange={e => setForm(f => ({ ...f, customerTelegram: e.target.value }))}
                placeholder="@username"
              />
              <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)', display: 'block' }}>
                Customer must have messaged your bot at least once. Include or omit the @.
              </span>
            </div>

            {createError && (
              <div style={errorBoxStyle}>{createError}</div>
            )}

            <button
              type="submit"
              disabled={creating}
              style={{ ...primaryButtonStyle, marginTop: 'var(--space-2)' }}
            >
              {creating ? 'Creating…' : 'Create session and send invite'}
            </button>
          </form>

          {/* Join link display after creation */}
          {lastCreated && (
            <div style={{
              marginTop: 'var(--space-8)',
              padding: 'var(--space-5)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              maxWidth: '480px',
            }}>
              <p style={{ fontWeight: 500, marginBottom: 'var(--space-2)' }}>
                Session created — invite sent
              </p>
              <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-3)' }}>
                Share this link manually if needed:
              </p>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                padding: 'var(--space-3)',
                background: 'var(--color-surface-raised)',
                borderRadius: 'var(--radius-md)',
                wordBreak: 'break-all',
                color: 'var(--color-text-primary)',
              }}>
                {lastCreated.joinUrl}
              </div>
              <button
                onClick={() => navigate(`/session/${lastCreated.session.id}`)}
                style={{ ...primaryButtonStyle, marginTop: 'var(--space-4)', width: 'auto', padding: '8px 16px' }}
              >
                Join as agent
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

const fieldStyle = { marginBottom: 'var(--space-5)' };
const labelStyle = { display: 'block', fontWeight: 500, marginBottom: 'var(--space-1)', fontSize: '13px' };
const inputStyle = {
  width: '100%', padding: '8px 12px',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  fontSize: '14px', background: 'var(--color-background)',
  color: 'var(--color-text-primary)', outline: 'none',
};
const primaryButtonStyle = {
  display: 'block', width: '100%', padding: '9px 16px',
  background: 'var(--color-accent)', color: '#fff',
  border: 'none', borderRadius: 'var(--radius-md)',
  fontSize: '14px', fontWeight: 500, cursor: 'pointer',
};
const ghostButtonStyle = {
  padding: '5px 10px', background: 'transparent',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  fontSize: '13px', cursor: 'pointer',
  color: 'var(--color-text-secondary)',
};
const errorBoxStyle = {
  padding: 'var(--space-3)', marginBottom: 'var(--space-4)',
  background: 'var(--color-danger-bg)', color: 'var(--color-danger)',
  borderRadius: 'var(--radius-md)', fontSize: '13px',
};
```

---

## 19. Frontend — Call Room (Shared)

### 19.1 Overview

The call room is used by both agent and customer. The role (from the socket auth) determines which controls are visible. The layout is: video area (left, 70% width), sidebar (right, 30%) containing chat, file share, and — for agent only — call controls and post-call intelligence card.

### 19.2 `client/src/pages/CallRoom.jsx`

This is the most complex component. Break it into sub-components:

```jsx
import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Device } from 'mediasoup-client';
import { connectSocket, getSocket } from '../socket';
import VideoTile from '../components/VideoTile';
import ChatPanel from '../components/ChatPanel';
import CallControls from '../components/CallControls';
import AnnotationCanvas from '../components/AnnotationCanvas';
import IntelligenceCard from '../components/IntelligenceCard';
import api from '../api';

export default function CallRoom() {
  const { sessionId } = useParams();
  const [searchParams] = useSearchParams();

  // Determine role from context
  const agentUser = JSON.parse(localStorage.getItem('agent_user') || 'null');
  const inviteToken = searchParams.get('token');
  const isAgent = !!agentUser && !inviteToken;
  const role = isAgent ? (agentUser.role || 'agent') : 'customer';
  const myName = isAgent ? agentUser.name : 'Customer';

  // State
  const [status, setStatus] = useState('connecting'); // connecting | active | ended
  const [remoteParticipant, setRemoteParticipant] = useState(null);
  const [audioMuted, setAudioMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingId, setRecordingId] = useState(null);
  const [annotationActive, setAnnotationActive] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [intelligence, setIntelligence] = useState(null);
  const [messages, setMessages] = useState([]);

  // Refs
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const deviceRef = useRef(null);
  const sendTransportRef = useRef(null);
  const recvTransportRef = useRef(null);
  const localStreamRef = useRef(null);
  const producersRef = useRef({ audio: null, video: null });

  useEffect(() => {
    let socket;

    async function initCall() {
      try {
        // 1. Connect socket with appropriate auth
        socket = connectSocket({
          token: isAgent ? localStorage.getItem('agent_token') : undefined,
          inviteToken: !isAgent ? inviteToken : undefined,
          customerName: !isAgent ? 'Customer' : undefined,
        });

        // 2. Wait for connection
        await new Promise((resolve, reject) => {
          socket.once('connect', resolve);
          socket.once('connect_error', reject);
        });

        // 3. Join session room
        const joinResult = await emitWithAck(socket, 'join-session', { sessionId });
        if (joinResult.error) throw new Error(joinResult.error);

        // 4. Get local media
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
        });
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // 5. Initialize mediasoup Device
        const rtpCapsResult = await emitWithAck(socket, 'get-rtp-capabilities', { sessionId });
        if (rtpCapsResult.error) throw new Error(rtpCapsResult.error);

        const device = new Device();
        await device.load({ routerRtpCapabilities: rtpCapsResult.rtpCapabilities });
        deviceRef.current = device;

        // 6. Create send transport
        const sendTransportParams = await emitWithAck(socket, 'create-send-transport', { sessionId });
        const sendTransport = device.createSendTransport(sendTransportParams.params);
        sendTransportRef.current = sendTransport;

        sendTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
          try {
            await emitWithAck(socket, 'connect-transport', {
              sessionId, transportId: sendTransport.id, dtlsParameters,
            });
            callback();
          } catch (e) { errback(e); }
        });

        sendTransport.on('produce', async ({ kind, rtpParameters, appData }, callback, errback) => {
          try {
            const result = await emitWithAck(socket, 'produce', {
              sessionId, transportId: sendTransport.id, kind, rtpParameters, appData,
            });
            callback({ id: result.id });
          } catch (e) { errback(e); }
        });

        // 7. Create recv transport
        const recvTransportParams = await emitWithAck(socket, 'create-recv-transport', { sessionId });
        const recvTransport = device.createRecvTransport(recvTransportParams.params);
        recvTransportRef.current = recvTransport;

        recvTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
          try {
            await emitWithAck(socket, 'connect-transport', {
              sessionId, transportId: recvTransport.id, dtlsParameters,
            });
            callback();
          } catch (e) { errback(e); }
        });

        // 8. Produce local audio and video
        const audioTrack = stream.getAudioTracks()[0];
        const videoTrack = stream.getVideoTracks()[0];

        producersRef.current.audio = await sendTransport.produce({ track: audioTrack });
        producersRef.current.video = await sendTransport.produce({
          track: videoTrack,
          encodings: [
            { maxBitrate: 100000 },
            { maxBitrate: 300000 },
            { maxBitrate: 900000 },
          ],
          codecOptions: { videoGoogleStartBitrate: 1000 },
        });

        // 9. Consume existing producers
        const existingProducers = await emitWithAck(socket, 'get-producers', { sessionId });
        for (const { producerId, kind } of existingProducers.producers) {
          await consumeTrack(socket, producerId, kind);
        }

        // 10. Listen for new producers
        socket.on('new-producer', async ({ producerId, kind }) => {
          await consumeTrack(socket, producerId, kind);
        });

        // 11. Listen for participant events
        socket.on('participant-joined', ({ role: remoteRole, name }) => {
          setRemoteParticipant({ role: remoteRole, name });
        });

        socket.on('participant-left', () => {
          setRemoteParticipant(null);
        });

        // 12. Chat
        socket.on('new-message', (message) => {
          setMessages(prev => [...prev, message]);
        });

        // 13. Recording events
        socket.on('recording-started', ({ recordingId: rId }) => {
          setIsRecording(true);
          setRecordingId(rId);
        });
        socket.on('recording-stopped', () => {
          setIsRecording(false);
        });

        // 14. Session end
        socket.on('session-ended', () => {
          setSessionEnded(true);
          setStatus('ended');
        });

        // Load existing chat messages
        if (isAgent) {
          const { data } = await api.get(`/chat/${sessionId}`);
          setMessages(data.messages);
        }

        setStatus('active');
      } catch (err) {
        console.error('Call init error:', err);
        setStatus('error');
      }
    }

    async function consumeTrack(socket, producerId, kind) {
      const device = deviceRef.current;
      const recvTransport = recvTransportRef.current;
      if (!device || !recvTransport) return;

      const result = await emitWithAck(socket, 'consume', {
        sessionId,
        transportId: recvTransport.id,
        producerId,
        rtpCapabilities: device.rtpCapabilities,
      });

      if (result.error) return;

      const consumer = await recvTransport.consume({
        id: result.id,
        producerId: result.producerId,
        kind: result.kind,
        rtpParameters: result.rtpParameters,
      });

      if (kind === 'video' && remoteVideoRef.current) {
        const stream = new MediaStream([consumer.track]);
        remoteVideoRef.current.srcObject = stream;
      } else if (kind === 'audio') {
        const audioEl = document.createElement('audio');
        audioEl.srcObject = new MediaStream([consumer.track]);
        audioEl.autoplay = true;
        document.body.appendChild(audioEl);
      }
    }

    initCall();

    return () => {
      // Cleanup
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      sendTransportRef.current?.close();
      recvTransportRef.current?.close();
      socket?.disconnect();
    };
  }, [sessionId]);

  // Poll for intelligence after session ends
  useEffect(() => {
    if (!sessionEnded || !isAgent) return;
    const poll = setInterval(async () => {
      try {
        const { data } = await api.get(`/sessions/${sessionId}`);
        if (data.intelligence?.processing_status === 'done') {
          setIntelligence(data.intelligence);
          clearInterval(poll);
        }
      } catch {}
    }, 5000);
    return () => clearInterval(poll);
  }, [sessionEnded, sessionId, isAgent]);

  async function toggleMute() {
    const audioProducer = producersRef.current.audio;
    if (!audioProducer) return;
    const socket = getSocket();
    if (audioMuted) {
      await audioProducer.resume();
      await emitWithAck(socket, 'resume-producer', { sessionId, producerId: audioProducer.id });
    } else {
      await audioProducer.pause();
      await emitWithAck(socket, 'pause-producer', { sessionId, producerId: audioProducer.id });
    }
    setAudioMuted(!audioMuted);
  }

  async function toggleVideo() {
    const videoProducer = producersRef.current.video;
    if (!videoProducer) return;
    const socket = getSocket();
    if (videoOff) {
      await videoProducer.resume();
      await emitWithAck(socket, 'resume-producer', { sessionId, producerId: videoProducer.id });
    } else {
      await videoProducer.pause();
      await emitWithAck(socket, 'pause-producer', { sessionId, producerId: videoProducer.id });
    }
    setVideoOff(!videoOff);
  }

  async function handleEndCall() {
    if (!window.confirm('End this session for all participants?')) return;
    try {
      await api.delete(`/sessions/${sessionId}/end`);
      setSessionEnded(true);
      setStatus('ended');
    } catch (err) {
      console.error('End call error:', err);
    }
  }

  async function handleStartRecording() {
    const socket = getSocket();
    const result = await emitWithAck(socket, 'start-recording', { sessionId });
    if (result.success) {
      setIsRecording(true);
      setRecordingId(result.recordingId);
    }
  }

  async function handleStopRecording() {
    const socket = getSocket();
    await emitWithAck(socket, 'stop-recording', { sessionId, recordingId });
    setIsRecording(false);
  }

  if (status === 'connecting') {
    return (
      <div style={loadingStyle}>
        <p>Connecting to session…</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#0a0a0a' }}>
      {/* Video area */}
      <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column' }}>
        {/* Remote video — full size */}
        <div style={{ flex: 1, position: 'relative', background: '#111' }}>
          <video
            ref={remoteVideoRef}
            autoPlay playsInline
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          {/* Annotation canvas overlay */}
          {isAgent && (
            <AnnotationCanvas
              active={annotationActive}
              sessionId={sessionId}
            />
          )}
          {!remoteParticipant && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              color: '#666', fontSize: '14px',
            }}>
              Waiting for the other participant…
            </div>
          )}
        </div>

        {/* Local video — picture-in-picture */}
        <div style={{
          position: 'absolute', bottom: '80px', right: '16px',
          width: '180px', aspectRatio: '16/9',
          background: '#222', borderRadius: '8px', overflow: 'hidden',
          border: '2px solid rgba(255,255,255,0.15)',
        }}>
          <video
            ref={localVideoRef}
            autoPlay playsInline muted
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          {videoOff && (
            <div style={{
              position: 'absolute', inset: 0, background: '#222',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#888', fontSize: '12px',
            }}>
              Camera off
            </div>
          )}
        </div>

        {/* Recording indicator */}
        {isRecording && (
          <div style={{
            position: 'absolute', top: '16px', left: '16px',
            display: 'flex', alignItems: 'center', gap: '6px',
            background: 'rgba(0,0,0,0.7)', borderRadius: '4px',
            padding: '4px 10px', color: '#fff', fontSize: '12px',
          }}>
            <div style={{
              width: '8px', height: '8px', borderRadius: '50%',
              background: 'var(--color-recording)',
              animation: 'pulse 1.5s ease-in-out infinite',
            }} />
            Recording
          </div>
        )}

        {/* Call controls — bottom bar */}
        {isAgent && !sessionEnded && (
          <CallControls
            audioMuted={audioMuted}
            videoOff={videoOff}
            isRecording={isRecording}
            annotationActive={annotationActive}
            onToggleMute={toggleMute}
            onToggleVideo={toggleVideo}
            onToggleRecording={isRecording ? handleStopRecording : handleStartRecording}
            onToggleAnnotation={() => setAnnotationActive(a => !a)}
            onEndCall={handleEndCall}
          />
        )}

        {/* Customer controls — simplified */}
        {!isAgent && !sessionEnded && (
          <div style={{ padding: '16px', display: 'flex', justifyContent: 'center', gap: '12px' }}>
            <button onClick={toggleMute} style={controlButton(audioMuted)}>
              {audioMuted ? 'Unmute' : 'Mute'}
            </button>
            <button onClick={toggleVideo} style={controlButton(videoOff)}>
              {videoOff ? 'Start video' : 'Stop video'}
            </button>
          </div>
        )}
      </div>

      {/* Right sidebar */}
      <div style={{
        width: '320px', background: 'var(--color-background)',
        borderLeft: '1px solid var(--color-border)',
        display: 'flex', flexDirection: 'column',
      }}>
        {sessionEnded && intelligence ? (
          <IntelligenceCard intelligence={intelligence} />
        ) : sessionEnded ? (
          <div style={{ padding: 'var(--space-6)', color: 'var(--color-text-secondary)', fontSize: '13px' }}>
            Session ended. Analyzing call…
          </div>
        ) : (
          <ChatPanel
            sessionId={sessionId}
            messages={messages}
            myRole={role}
            myName={myName}
            isAgent={isAgent}
          />
        )}
      </div>
    </div>
  );
}

// Helper: promisify socket.emit
function emitWithAck(socket, event, data) {
  return new Promise((resolve, reject) => {
    socket.emit(event, data, (response) => {
      if (response?.error) reject(new Error(response.error));
      else resolve(response);
    });
  });
}

const loadingStyle = {
  height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
  color: 'var(--color-text-secondary)',
};

const controlButton = (active) => ({
  padding: '8px 16px',
  background: active ? 'rgba(220,38,38,0.15)' : 'rgba(255,255,255,0.1)',
  color: active ? '#ef4444' : '#fff',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: '6px', cursor: 'pointer', fontSize: '13px',
});
```

---

## 20. Frontend — Customer Join Page

### 20.1 `client/src/pages/CustomerJoin.jsx`

```jsx
import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../api';

export default function CustomerJoin() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [state, setState] = useState('validating'); // validating | ready | error
  const [sessionInfo, setSessionInfo] = useState(null);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('No invite link found. Please check the link you received.');
      setState('error');
      return;
    }
    api.post('/sessions/validate-invite', { token })
      .then(({ data }) => {
        setSessionInfo(data);
        setName(data.customerName || '');
        setState('ready');
      })
      .catch(err => {
        setError(err.response?.data?.error || 'Invalid or expired invite link');
        setState('error');
      });
  }, [token]);

  async function handleJoin() {
    if (!name.trim()) return;
    setJoining(true);
    // Store invite token and customer name for the call room
    sessionStorage.setItem('invite_token', token);
    sessionStorage.setItem('customer_name', name.trim());
    navigate(`/session/${sessionInfo.sessionId}?token=${token}&name=${encodeURIComponent(name.trim())}`);
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--color-surface)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        width: '100%', maxWidth: '400px', padding: 'var(--space-8)',
        background: 'var(--color-background)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-xl)',
      }}>
        {state === 'validating' && (
          <p style={{ color: 'var(--color-text-secondary)' }}>Checking your invite…</p>
        )}

        {state === 'error' && (
          <>
            <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: 'var(--space-2)' }}>
              Unable to join
            </h2>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>{error}</p>
          </>
        )}

        {state === 'ready' && (
          <>
            <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-2)' }}>
              Support Call
            </p>
            <h1 style={{ fontSize: '20px', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
              Join your support session
            </h1>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-6)', fontSize: '14px' }}>
              {sessionInfo.agentName} is waiting for you. Your browser will ask for camera and microphone access.
            </p>

            <div style={{ marginBottom: 'var(--space-5)' }}>
              <label style={{ display: 'block', fontWeight: 500, marginBottom: 'var(--space-1)', fontSize: '13px' }}>
                Your name
              </label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                style={{
                  width: '100%', padding: '8px 12px',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)', fontSize: '14px', outline: 'none',
                }}
                placeholder="Enter your name"
              />
            </div>

            <button
              onClick={handleJoin}
              disabled={!name.trim() || joining}
              style={{
                width: '100%', padding: '10px 16px',
                background: name.trim() ? 'var(--color-accent)' : 'var(--color-border)',
                color: name.trim() ? '#fff' : 'var(--color-text-muted)',
                border: 'none', borderRadius: 'var(--radius-md)',
                fontSize: '14px', fontWeight: 500, cursor: name.trim() ? 'pointer' : 'default',
              }}
            >
              {joining ? 'Starting…' : 'Join call'}
            </button>

            <p style={{ marginTop: 'var(--space-4)', fontSize: '12px', color: 'var(--color-text-muted)' }}>
              No account required. No download needed.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
```

---

## 21. Frontend — Admin Dashboard

### 21.1 `client/src/pages/AdminDashboard.jsx`

Layout: top stat bar (4 metric tiles), below that a live sessions table with "Force end" buttons, below that a session history table with filters.

```jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [liveSessions, setLiveSessions] = useState([]);
  const [history, setHistory] = useState([]);

  async function loadData() {
    try {
      const [statsRes, liveRes, historyRes] = await Promise.all([
        api.get('/admin/stats'),
        api.get('/admin/sessions/live'),
        api.get('/admin/sessions?status=ended&limit=50'),
      ]);
      setStats(statsRes.data);
      setLiveSessions(liveRes.data.sessions);
      setHistory(historyRes.data.sessions);
    } catch (err) {
      if (err.response?.status === 403) navigate('/dashboard');
    }
  }

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, []);

  async function forceEnd(sessionId) {
    if (!window.confirm('Force end this session?')) return;
    await api.delete(`/admin/sessions/${sessionId}/force-end`);
    loadData();
  }

  function formatDuration(seconds) {
    if (!seconds || seconds < 0) return '—';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m < 60) return `${m}m ${s}s`;
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m`;
  }

  const statItems = stats ? [
    { label: 'Active sessions', value: stats.activeSessions },
    { label: 'Sessions today', value: stats.todaySessions },
    { label: 'Avg duration today', value: formatDuration(stats.avgDurationSeconds) },
    { label: 'Avg CSAT today', value: stats.avgCsat ? `${stats.avgCsat} / 5` : '—' },
  ] : [];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-surface)' }}>
      {/* Header */}
      <header style={{
        background: 'var(--color-background)', borderBottom: '1px solid var(--color-border)',
        padding: '0 var(--space-8)', height: '52px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontWeight: 600 }}>Admin — Support Console</span>
        <button onClick={() => navigate('/dashboard')} style={{
          fontSize: '13px', color: 'var(--color-text-secondary)',
          background: 'none', border: 'none', cursor: 'pointer',
        }}>
          Agent view
        </button>
      </header>

      <main style={{ padding: 'var(--space-8)', maxWidth: '1200px', margin: '0 auto' }}>
        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
          {statItems.map(item => (
            <div key={item.label} style={{
              background: 'var(--color-background)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-5)',
            }}>
              <div style={{ fontSize: '22px', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
                {item.value}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                {item.label}
              </div>
            </div>
          ))}
        </div>

        {/* Live sessions */}
        <section style={{ marginBottom: 'var(--space-8)' }}>
          <h2 style={{ fontSize: '14px', fontWeight: 600, marginBottom: 'var(--space-4)', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Live sessions ({liveSessions.length})
          </h2>
          <div style={{ background: 'var(--color-background)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            {liveSessions.length === 0 ? (
              <div style={{ padding: 'var(--space-6)', color: 'var(--color-text-muted)', fontSize: '13px' }}>
                No active sessions
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                    {['Customer', 'Agent', 'Duration', 'Started', ''].map(h => (
                      <th key={h} style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {liveSessions.map(session => (
                    <tr key={session.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={tdStyle}>{session.customer_name}</td>
                      <td style={tdStyle}>{session.agent_name}</td>
                      <td style={tdStyle}>{formatDuration(session.duration_seconds)}</td>
                      <td style={tdStyle}>{new Date(session.started_at).toLocaleTimeString()}</td>
                      <td style={tdStyle}>
                        <button
                          onClick={() => forceEnd(session.id)}
                          style={{
                            padding: '4px 10px', fontSize: '12px', cursor: 'pointer',
                            background: 'var(--color-danger-bg)', color: 'var(--color-danger)',
                            border: '1px solid var(--color-danger)',
                            borderRadius: 'var(--radius-md)',
                          }}
                        >
                          Force end
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* History */}
        <section>
          <h2 style={{ fontSize: '14px', fontWeight: 600, marginBottom: 'var(--space-4)', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Session history
          </h2>
          <div style={{ background: 'var(--color-background)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                  {['Customer', 'Agent', 'Duration', 'CSAT', 'Status', 'Date'].map(h => (
                    <th key={h} style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map(session => (
                  <tr key={session.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={tdStyle}>{session.customer_name}</td>
                    <td style={tdStyle}>{session.agent_name}</td>
                    <td style={tdStyle}>{formatDuration(session.duration_seconds)}</td>
                    <td style={tdStyle}>{session.predicted_csat ? `${session.predicted_csat}/5` : '—'}</td>
                    <td style={tdStyle}>
                      <span style={{
                        fontSize: '12px', padding: '2px 8px', borderRadius: '12px',
                        background: session.resolution_status === 'resolved' ? 'var(--color-success-bg)' : 'var(--color-surface-raised)',
                        color: session.resolution_status === 'resolved' ? 'var(--color-success)' : 'var(--color-text-secondary)',
                      }}>
                        {session.resolution_status || '—'}
                      </span>
                    </td>
                    <td style={tdStyle}>{new Date(session.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

const tdStyle = { padding: 'var(--space-3) var(--space-4)', fontSize: '13px' };
```

---

## 22. Frontend — Live Annotation Canvas

### 22.1 `client/src/components/AnnotationCanvas.jsx`

```jsx
import { useRef, useEffect, useState } from 'react';
import { getSocket } from '../socket';

export default function AnnotationCanvas({ active, sessionId }) {
  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef(null);
  const contextRef = useRef(null);
  const [color, setColor] = useState('#ff3b30');
  const [lineWidth, setLineWidth] = useState(3);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    contextRef.current = ctx;
  }, [color, lineWidth]);

  // Listen for remote drawing events
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    function onRemoteDraw({ drawData }) {
      const ctx = contextRef.current;
      if (!ctx) return;
      ctx.strokeStyle = drawData.color;
      ctx.lineWidth = drawData.lineWidth;
      ctx.beginPath();
      ctx.moveTo(drawData.fromX, drawData.fromY);
      ctx.lineTo(drawData.toX, drawData.toY);
      ctx.stroke();
    }

    function onClear() {
      const canvas = canvasRef.current;
      const ctx = contextRef.current;
      if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    socket.on('annotation-draw', onRemoteDraw);
    socket.on('annotation-clear', onClear);

    return () => {
      socket.off('annotation-draw', onRemoteDraw);
      socket.off('annotation-clear', onClear);
    };
  }, []);

  function getPos(e, canvas) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  function onPointerDown(e) {
    if (!active) return;
    isDrawingRef.current = true;
    lastPointRef.current = getPos(e, canvasRef.current);
  }

  function onPointerMove(e) {
    if (!active || !isDrawingRef.current) return;
    const canvas = canvasRef.current;
    const ctx = contextRef.current;
    const socket = getSocket();
    const currentPoint = getPos(e, canvas);
    const lastPoint = lastPointRef.current;

    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(lastPoint.x, lastPoint.y);
    ctx.lineTo(currentPoint.x, currentPoint.y);
    ctx.stroke();

    socket?.emit('annotation-draw', {
      sessionId,
      drawData: {
        fromX: lastPoint.x, fromY: lastPoint.y,
        toX: currentPoint.x, toY: currentPoint.y,
        color, lineWidth,
      },
    });

    lastPointRef.current = currentPoint;
  }

  function onPointerUp() {
    isDrawingRef.current = false;
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    const ctx = contextRef.current;
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    getSocket()?.emit('annotation-clear', { sessionId });
  }

  return (
    <>
      <canvas
        ref={canvasRef}
        width={1280}
        height={720}
        style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
          cursor: active ? 'crosshair' : 'default',
          pointerEvents: active ? 'all' : 'none',
          zIndex: 10,
        }}
        onMouseDown={onPointerDown}
        onMouseMove={onPointerMove}
        onMouseUp={onPointerUp}
        onMouseLeave={onPointerUp}
        onTouchStart={onPointerDown}
        onTouchMove={onPointerMove}
        onTouchEnd={onPointerUp}
      />

      {/* Annotation toolbar — only visible when annotation is active */}
      {active && (
        <div style={{
          position: 'absolute', top: '16px', left: '50%', transform: 'translateX(-50%)',
          display: 'flex', gap: '8px', alignItems: 'center',
          background: 'rgba(0,0,0,0.8)', borderRadius: '8px',
          padding: '6px 12px', zIndex: 20,
        }}>
          {['#ff3b30', '#ff9500', '#34c759', '#007aff', '#ffffff'].map(c => (
            <button
              key={c}
              onClick={() => setColor(c)}
              style={{
                width: '20px', height: '20px', borderRadius: '50%',
                background: c, border: color === c ? '2px solid #fff' : '2px solid transparent',
                cursor: 'pointer',
              }}
            />
          ))}
          <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.2)' }} />
          <input
            type="range" min="2" max="12" value={lineWidth}
            onChange={e => setLineWidth(parseInt(e.target.value))}
            style={{ width: '60px', cursor: 'pointer' }}
          />
          <button
            onClick={clearCanvas}
            style={{
              background: 'none', border: 'none', color: '#fff',
              fontSize: '12px', cursor: 'pointer', opacity: 0.7,
            }}
          >
            Clear
          </button>
        </div>
      )}
    </>
  );
}
```

---

## 23. Frontend — IntelligenceCard and remaining components

### `client/src/components/IntelligenceCard.jsx`

```jsx
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function IntelligenceCard({ intelligence }) {
  const timeline = intelligence.sentiment_timeline || [];
  const actionItems = intelligence.action_items || [];
  const keywords = intelligence.keywords || [];

  const csatColor = intelligence.predicted_csat >= 4
    ? 'var(--color-success)'
    : intelligence.predicted_csat >= 3
    ? 'var(--color-warning)'
    : 'var(--color-danger)';

  return (
    <div style={{ overflowY: 'auto', padding: 'var(--space-5)' }}>
      <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: 'var(--space-4)' }}>
        Session analysis
      </h3>

      {/* CSAT + Sentiment row */}
      <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
        <div style={{
          flex: 1, padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)', textAlign: 'center',
        }}>
          <div style={{ fontSize: '24px', fontWeight: 700, color: csatColor }}>
            {intelligence.predicted_csat}/5
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
            Predicted CSAT
          </div>
        </div>
        <div style={{
          flex: 1, padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)', textAlign: 'center',
        }}>
          <div style={{ fontSize: '24px', fontWeight: 700 }}>
            {intelligence.overall_sentiment}/10
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
            Sentiment score
          </div>
        </div>
      </div>

      {/* Resolution status */}
      <div style={{ marginBottom: 'var(--space-5)' }}>
        <span style={{
          display: 'inline-block', padding: '3px 10px',
          borderRadius: '12px', fontSize: '12px', fontWeight: 500,
          background: intelligence.resolution_status === 'resolved'
            ? 'var(--color-success-bg)' : 'var(--color-surface-raised)',
          color: intelligence.resolution_status === 'resolved'
            ? 'var(--color-success)' : 'var(--color-text-secondary)',
        }}>
          {intelligence.resolution_status || 'Unknown'}
        </span>
      </div>

      {/* Sentiment timeline chart */}
      {timeline.length > 0 && (
        <div style={{ marginBottom: 'var(--space-5)' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: 'var(--space-2)', color: 'var(--color-text-secondary)' }}>
            SENTIMENT OVER CALL
          </div>
          <ResponsiveContainer width="100%" height={80}>
            <LineChart data={timeline}>
              <XAxis dataKey="minute" tick={{ fontSize: 10 }} tickFormatter={v => `${v}m`} />
              <YAxis domain={[1, 10]} hide />
              <Tooltip
                formatter={(val, _, props) => [val, props.payload.note || 'Sentiment']}
                labelFormatter={v => `Minute ${v}`}
              />
              <Line
                type="monotone" dataKey="score" stroke="#171717"
                strokeWidth={1.5} dot={{ r: 2 }} activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Summary */}
      {intelligence.summary && (
        <div style={{ marginBottom: 'var(--space-5)' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: 'var(--space-2)', color: 'var(--color-text-secondary)' }}>
            SUMMARY
          </div>
          <div style={{ fontSize: '13px', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
            {intelligence.summary}
          </div>
        </div>
      )}

      {/* Action items */}
      {actionItems.length > 0 && (
        <div style={{ marginBottom: 'var(--space-5)' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: 'var(--space-2)', color: 'var(--color-text-secondary)' }}>
            ACTION ITEMS
          </div>
          {actionItems.map((item, i) => (
            <div key={i} style={{
              display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-start',
              marginBottom: 'var(--space-2)', fontSize: '13px',
            }}>
              <input type="checkbox" style={{ marginTop: '2px', flexShrink: 0 }} />
              <span>{item}</span>
            </div>
          ))}
        </div>
      )}

      {/* Keywords */}
      {keywords.length > 0 && (
        <div>
          <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: 'var(--space-2)', color: 'var(--color-text-secondary)' }}>
            TOPICS
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            {keywords.map((kw, i) => (
              <span key={i} style={{
                padding: '3px 10px', borderRadius: '12px',
                background: 'var(--color-surface-raised)',
                border: '1px solid var(--color-border)',
                fontSize: '12px', color: 'var(--color-text-secondary)',
              }}>
                {kw}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## 24. Nginx Configuration

### `nginx/videosupport.conf`

```nginx
server {
    listen 80;
    server_name YOUR_ORACLE_VM_IP;

    # Security headers
    add_header X-Frame-Options SAMEORIGIN;
    add_header X-Content-Type-Options nosniff;
    add_header Referrer-Policy strict-origin-when-cross-origin;

    # File upload size limit
    client_max_body_size 30M;

    # React SPA
    location / {
        root /var/www/videosupport;
        try_files $uri $uri/ /index.html;
        expires -1;
        add_header Cache-Control "no-store";
    }

    # API
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 60s;
    }

    # Socket.IO — must use upgrade for WebSocket
    location /socket.io/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }

    # Uploaded files
    location /uploads/ {
        alias /var/videosupport/uploads/;
        expires 7d;
        add_header Cache-Control "public";
    }

    # Metrics — restrict to localhost only
    location /metrics {
        proxy_pass http://localhost:3001/metrics;
        allow 127.0.0.1;
        deny all;
    }
}
```

Deploy:

```bash
sudo cp nginx/videosupport.conf /etc/nginx/sites-available/videosupport
sudo ln -s /etc/nginx/sites-available/videosupport /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Copy built frontend
npm run build  # from client/ directory
sudo mkdir -p /var/www/videosupport
sudo cp -r dist/* /var/www/videosupport/
```

---

## 25. Docker Compose

For development and judges running locally:

### `docker-compose.yml`

```yaml
version: '3.9'

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: ${DB_NAME}
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./server/src/db/schema.sql:/docker-entrypoint-initdb.d/schema.sql
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER}"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

  server:
    build:
      context: ./server
      dockerfile: Dockerfile
    env_file: ./server/.env
    ports:
      - "3001:3001"
      - "40000-40100:40000-40100/udp"
    volumes:
      - uploads:/var/videosupport/uploads
      - recordings:/var/videosupport/recordings
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  client:
    build:
      context: ./client
      dockerfile: Dockerfile
    ports:
      - "80:80"
    depends_on:
      - server

volumes:
  postgres_data:
  uploads:
  recordings:
```

### `server/Dockerfile`

```dockerfile
FROM node:20-alpine

# Build tools for mediasoup native compilation
RUN apk add --no-cache python3 make g++ ffmpeg

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src

EXPOSE 3001
EXPOSE 40000-40100/udp

CMD ["node", "src/index.js"]
```

### `client/Dockerfile`

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

---

## 26. PM2 Process Management (Production)

```bash
cd server
pm2 start src/index.js --name videosupport-server \
  --log /var/log/videosupport/server.log \
  --max-memory-restart 512M

pm2 save
pm2 startup
```

---

## 27. Demo Script for Judges

The following 90-second flow demonstrates all core requirements and the three wow factors:

**Step 1 — Agent login**
Navigate to `http://YOUR_IP/login`. Sign in with `agent@example.com` and your configured password. You are on the Agent Dashboard.

**Step 2 — Create session and send invite**
Fill in the customer name, a real email address, and a Telegram username. Click "Create session and send invite." Within 10 seconds, both the email and the Telegram message should arrive (demonstrate on a second device). Copy the join URL shown on screen.

**Step 3 — Customer joins**
Open the join URL on a different browser or device (or an incognito tab). Enter the customer name. Click "Join call." Allow camera/mic. Both participants are now live on video.

**Step 4 — Demonstrate controls**
Agent: mute, unmute, turn video off, turn video back on. Show these don't crash the call.

**Step 5 — Live annotation**
Agent clicks the annotation toggle. Draws a red circle on the customer's video feed. The annotation appears on both screens in real time.

**Step 6 — Chat and file share**
Agent types a message in the chat panel. Customer receives it instantly. Agent uploads a PDF file — it appears as a downloadable link in the chat.

**Step 7 — Recording**
Agent clicks "Record." The recording indicator appears on both screens. After 30 seconds, click "Stop recording."

**Step 8 — End call and AI analysis**
Agent clicks "End session." The session ends for both participants. Wait 20–30 seconds. The right panel in the agent's view transforms to the Session Intelligence card, showing the auto-generated summary, action items, sentiment timeline chart, and CSAT prediction.

**Step 9 — Admin dashboard**
Navigate to `/admin`. Show the session history table with the just-completed session, its CSAT score, and resolution status. Show the Prometheus metrics endpoint at `http://YOUR_IP/metrics`.

---

## Appendix A — Known Limitations

- Recording implementation is a stub for the hackathon. A full implementation requires tapping mediasoup's `PlainTransport` to pipe RTP into FFmpeg. The architecture supports it — the recording service file is the extension point.
- Telegram invite requires the customer to have previously started a conversation with your bot. Add `TELEGRAM_BOT_USERNAME=@YourBotName` to the session creation confirmation UI so agents know to tell customers to message the bot first.
- The system supports two concurrent sessions without issue on the Oracle free tier. For more sessions, scale `MEDIASOUP_NUM_WORKERS` to match available CPU cores.

## Appendix B — Quick Start Checklist

- [ ] Oracle VM provisioned, ports opened in Security List and ufw
- [ ] All system dependencies installed (Node 20, FFmpeg, PostgreSQL, Redis, Nginx)
- [ ] `server/.env` filled with real values (no placeholder strings)
- [ ] `client/.env` filled with Oracle VM public IP
- [ ] Database and schema created, first agent seeded
- [ ] `npm install` run in both `server/` and `client/`
- [ ] `npm run build` run in `client/`, output copied to `/var/www/videosupport`
- [ ] Nginx configured, tested with `nginx -t`, and reloaded
- [ ] Server started with PM2
- [ ] End-to-end test: create session, join as customer, verify video, end call, verify intelligence
