# Real-Time Video Support Platform

This repository contains a self-hosted, browser-based customer support video platform built with React, Node.js, mediasoup, PostgreSQL, Redis, and Google Gemini integration.

## Key Features

- **Agent / Customer Roles**
  - Support agents can create sessions, invite customers, join calls, end calls, record sessions, and view session intelligence.
  - Customers join using a secure invite link or token and cannot perform agent-only actions.
  - Role enforcement is server-side using JWT authentication and role middleware.

- **Session Management**
  - Agents create sessions from the dashboard and generate a customer invite link.
  - Invite tokens are signed and expire automatically.
  - Session history is persisted in PostgreSQL.
  - Active session state and participant presence are tracked in real time.

- **Self-Hosted WebRTC Media**
  - Media flows through a self-hosted **mediasoup** SFU.
  - The platform does not rely on peer-to-peer connections or third-party hosted video APIs like Twilio Video, Agora, Daily, or Vonage.
  - Supports audio/video exchange between agent and customer with mute/unmute and video on/off controls.

- **Real-Time Chat**
  - In-call chat messages are sent via Socket.IO and persisted for later retrieval.
  - Chat history can be fetched after the session ends.
  - Supports file sharing in chat by uploading images, PDFs, text, DOC/DOCX files.

- **Recording**
  - Agents can start and stop session recording.
  - Recordings are saved to local disk and tracked in PostgreSQL.
  - Recording status transitions through `recording`, `processing`, and `ready` states.
  - Once processing completes, recordings are available for download.

- **Invite Dispatch**
  - The platform can send invite links through:
    - **Email** using Nodemailer.
    - **Telegram** using `node-telegram-bot-api`.
    - **SMS** using Twilio.
  - If integrations are not configured, the system falls back to mock console logs for invite dispatch.

- **Session Intelligence / AI**
  - After a call ends, a background intelligence pipeline processes the session.
  - Uses **Google Gemini** (`@google/generative-ai`) for:
    - audio transcription,
    - structured session analysis,
    - summary generation,
    - action item extraction,
    - sentiment timeline,
    - predicted CSAT score.
  - If Gemini is not configured, the app returns realistic mock transcript and analysis data.

- **Admin Dashboard & Observability**
  - Admin API provides live sessions, session history, and force-end actions.
  - Prometheus-style metrics exposed at `/metrics`.
  - Metrics include active sessions, total sessions, and connected participants.

- **Reconnect Grace Handling**
  - Unexpected disconnects are handled with a reconnect grace window.
  - Customers can rejoin seamlessly during the grace period without disturbing the other participant.

## Repository Structure

- `server/`
  - `src/index.js` — Express + Socket.IO entry point.
  - `src/config.js` — environment configuration and service key handling.
  - `src/db.js` — PostgreSQL connection pool.
  - `src/redis.js` — Redis client.
  - `src/routes/` — REST APIs for auth, sessions, chat, recordings, admin, metrics.
  - `src/socket/` — Socket.IO setup and real-time handlers.
  - `src/media/` — mediasoup worker/router/transport management.
  - `src/services/` — invite dispatch, intelligence pipeline, recording management.
  - `src/middleware/` — auth and role enforcement.

- `client/`
  - `src/main.jsx` — React app entry point.
  - `src/App.jsx` — app routing and page shell.
  - `src/api/` — API client and helper functions.
  - `src/socket/` — Socket.IO client connection.
  - `src/pages/` — Agent dashboard, call room, customer join page, admin dashboard.
  - `src/components/` — video tiles, chat panel, annotation canvas, call controls, intelligence card, file share.
  - `src/styles/` — shared CSS.

- `BUILD_INSTRUCTIONS.md` — detailed architecture and setup instructions.
- `run.md` — run and verification guide.
- `docker-compose.yml` — container orchestration setup.

## Supported Configuration

Configuration is handled via environment variables in `server/.env` and `client/.env`.

### Server environment highlights

- `PUBLIC_URL` — public app base URL.
- `JWT_SECRET`, `JWT_INVITE_SECRET`, `JWT_INVITE_EXPIRY` — authentication and invite token security.
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` — PostgreSQL settings.
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` — Redis settings.
- `MEDIASOUP_ANNOUNCED_IP`, `MEDIASOUP_RTC_MIN_PORT`, `MEDIASOUP_RTC_MAX_PORT`, `MEDIASOUP_NUM_WORKERS` — mediasoup config.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM_NAME` — email invite dispatch.
- `TELEGRAM_BOT_TOKEN` — Telegram invite dispatch.
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` — Twilio SMS invite dispatch.
- `GEMINI_API_KEY` — Google Gemini AI for transcription and intelligent session analysis.
- `UPLOAD_DIR`, `RECORDING_DIR` — local storage directories.
- `RECONNECT_GRACE_SECONDS` — disconnect grace timeout.

### Client environment highlights

- `VITE_API_URL` — backend API origin.
- `VITE_SOCKET_URL` — Socket.IO server origin.

## Running the Project

### Using Docker Compose

From the repository root:

```bash
docker compose up --build
```

If you want to run detached:

```bash
docker compose up -d --build
```

### Local Development

- `server`: `npm install && npm run dev`
- `client`: `npm install && npm run dev`

## What’s Implemented

### Mail, SMS, and Telegram Invite Sending

- Email invites are composed using a polished HTML email template and sent through Nodemailer.
- Telegram invites are sent using a bot and include inline join buttons.
- SMS invites are sent through Twilio, with support for a URL shortener stored in Redis.
- The backend logs mock invite payloads when integrations are missing.

### Call Recording

- Call recording is managed by the backend service and stored locally.
- Recording metadata is persisted in the `recordings` table.
- The agent can start and stop recording via the call controls.
- Once stopped, the recording enters processing state and becomes available for download.

### Gemini / AI Session Intelligence

- The system uses `@google/generative-ai` to integrate with Google Gemini.
- Gemini can transcribe recorded audio and analyze session content to produce:
  - call summary
  - action items
  - sentiment timeline
  - overall sentiment score
  - predicted CSAT
  - resolution status
  - keywords
- If `GEMINI_API_KEY` is missing, the intelligence pipeline still completes using mock fallback responses.

### Live Chat and File Sharing

- Text chat messages are delivered in real time via Socket.IO and persisted in PostgreSQL.
- File uploads are handled with multer and stored to the server's upload directory.
- Supported file types include images, PDFs, text, and Word documents.

### mediasoup SFU

- Media routing is handled through mediasoup workers and routers.
- WebRTC is established with server-side transport creation, producer/consumer management, and SFU stream forwarding.
- No third-party video SDKs are used.

### Admin & Observability

- Admin APIs expose metrics and session history.
- Force-end session capability is available for admins.
- Prometheus-compatible metrics are served on `/metrics`.

## Notes

- The project includes strong separation of concerns between signaling, media, session state, and intelligence services.
- The platform is built to be extensible: additional invite channels, analytics integrations, and recording pipelines can be added with minimal changes.
- For local testing, missing external API keys will not block basic session lifecycle functionality.

## Useful Files

- `BUILD_INSTRUCTIONS.md` — architecture and deep setup documentation.
- `run.md` — operational runbook and demo flow.
- `server/src/services/invite.js` — invite sending implementation.
- `server/src/services/intelligence.js` — Gemini intelligence pipeline and mock fallback.
- `server/src/routes/sessions.js` — session lifecycle APIs, invite handling, upload endpoint.
- `server/src/config.js` — environment and feature gate configuration.
