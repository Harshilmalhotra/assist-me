-- PostgreSQL database schema for Real-Time Video Support Platform

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Agents (support staff)
CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'agent' CHECK (role IN ('agent', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sessions
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agents(id),
  customer_name TEXT,
  customer_email TEXT,
  customer_telegram TEXT,
  customer_phone TEXT,
  invite_token TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting', 'active', 'ended')),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Session events (audit log)
CREATE TABLE IF NOT EXISTS session_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  participant_role TEXT NOT NULL CHECK (participant_role IN ('agent', 'customer', 'admin')),
  participant_name TEXT,
  event_type TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat messages
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('agent', 'customer', 'admin')),
  sender_name TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'file')),
  content TEXT NOT NULL,
  file_url TEXT,
  file_name TEXT,
  file_size INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Recordings
CREATE TABLE IF NOT EXISTS recordings (
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
CREATE TABLE IF NOT EXISTS session_intelligence (
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
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_agent_id ON sessions(agent_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_session_events_session_id ON session_events(session_id);
CREATE INDEX IF NOT EXISTS idx_recordings_session_id ON recordings(session_id);

-- Seed default accounts (bcrypt hashes of 'admin123' and 'agent123')
INSERT INTO agents (email, name, password_hash, role) VALUES
  ('admin@example.com', 'Admin User', '$2b$12$iUMiXWKwpqnCU.8IuFLYk.NyFnWAb86H/pcxBAxK0qs10ZDMjhi/y', 'admin'),
  ('agent@example.com', 'Support Agent', '$2b$12$3QzZXj9w18Gb5bcL9wyU9.kOU6KsScGtSraI3598htyOAo7Hk8cFG', 'agent')
ON CONFLICT (email) DO NOTHING;
