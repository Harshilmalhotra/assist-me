# Real-Time Video Support Platform — Running & Testing Guide

This guide describes how to configure, run, and verify the Real-Time Video Support Platform. The application is containerized using Docker and Docker Compose, compiling and managing:
1. **PostgreSQL** (Port `5433` on Host) - For persistent storage.
2. **Redis** (Port `6379` on Host) - For session coordination.
3. **Express Server** (Port `3001` on Host) - Handing WebRTC signaling (mediasoup SFU), chat uploads, API routes, and the Gemini AI pipeline.
4. **Nginx Frontend Gateway** (Port `80` on Host) - Serves the compiled Vite + React Single Page Application.

---

## 1. Prerequisites

Ensure you have the following installed on your machine:
* [Docker Desktop](https://www.docker.com/products/docker-desktop/) (includes Docker Compose)
* A web browser with camera and microphone permissions enabled

---

## 2. Configuration & API Keys

Before starting, review the environment configuration in [server/.env](file:///Users/harshil/Desktop/video-call/server/.env).

### Optional API Keys & Fail-Safe Fallbacks
If any keys are missing from the configuration, the server will output colored console flags (`[KNP]` Key Not Present) at startup and automatically run in **mock/fallback mode** so that the entire session lifecycle remains fully testable locally:

* **Google Gemini API**: Add `GEMINI_API_KEY` to enable actual audio recording transcriptions and structured JSON analysis. If left blank, the platform simulates the intelligence pipeline with a highly realistic mock router-cabling troubleshooting transcript and CSAT evaluation.
* **SMTP (Brevo / Gmail)**: Add `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, and `SMTP_PASS` to dispatch invite links via email.
* **Telegram Bot**: Add `TELEGRAM_BOT_TOKEN` to send automated chat channel invite links via Telegram.
* **Twilio SMS**: Add `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_FROM_NUMBER` to send join links directly to the customer's phone.

---

## 3. Running the Platform

1. **Launch the Container Stack**:
   From the project root directory, run:
   ```bash
   docker compose up --build
   ```
   *Note: Add `-d` to run in detached background mode (e.g., `docker compose up -d`).*

2. **Verify Containers are Active**:
   ```bash
   docker compose ps
   ```
   You should see all 4 services listed as `Up` (or `healthy` for database services).

3. **Check Server Logs**:
   ```bash
   docker compose logs -f server
   ```
   Observe the initialization sequence ensuring PostgreSQL and Redis connections succeed and worker pools boot.

---

## 4. Default Seed Accounts

The platform automatically seeds two support accounts on setup:
1. **Support Agent**:
   * **Email**: `agent@example.com`
   * **Password**: `agent123`
2. **Administrator**:
   * **Email**: `admin@example.com`
   * **Password**: `admin123`

---

## 5. End-to-End Session Walkthrough

Follow these steps to test the full support lifecycle:

### Step 1: Support Login & Session Creation
1. Open your browser to the Support Console: **[http://localhost/login](http://localhost/login)**.
2. Sign in using the support agent credentials (`agent@example.com` / `agent123`).
3. You will be redirected to the Agent Dashboard. Under **Start a new session**, input:
   * **Customer Name**: *e.g., John Doe*
   * **Email/Telegram/Phone**: Input at least one contact channel (e.g. `john@example.com`).
4. Click **Create session and send invite**. The backend creates the session and sends the invite link via email/SMS/Telegram (or logs the dispatch message text directly to the server terminal in mock mode).

### Step 2: Establish the WebRTC Call
1. In the dashboard's success panel, copy the generated manual invite URL (looks like `http://localhost/join?token=...`).
2. Open an **Incognito Browser Window** or a separate web browser.
3. Paste the invite URL. Wait for validation, enter the customer's name, and click **Join call**.
4. Switch back to your original Agent tab and click the **Join as agent** button.
5. Grant browser camera and microphone permissions when prompted. You will now see the live video tiles.

### Step 3: Interactive Features & Call Recording
1. **Real-time Chat**: Open the Chat drawer on both sides. Type messages and verify they transmit instantly. Try uploading an image/PDF file using the chat input.
2. **On-screen Drawing Canvas**: On the agent tab, click the **Draw** control button. Click and drag on the video feed area to draw lines. The drawings appear instantly on the customer's screen in real time. Click **Clear** to wipe the canvas.
3. **Call Recording**: On the agent tab, click **Record**. The recording indicator pulses red. Wait 10-15 seconds and click the record button again to stop.

### Step 4: Call Termination & AI Post-Call Summary
1. On the agent tab, click the red **End Call** button and confirm. The call ends for all participants.
2. The agent's view immediately transitions to a processing state.
3. Wait **15-20 seconds** for the background intelligence pipeline to process the recording transcription and run the Gemini summarization model.
4. Once completed, the **Intelligence Summary Card** loads:
   * Read the bulleted **Call Summary**.
   * Review identified **Action Items**.
   * Observe the **Sentiment Timeline Chart** tracking user mood levels minute-by-minute.
   * View the predicted **CSAT** score and **Resolution Status**.

### Step 5: Administration & Metrics
1. Click the **Admin** button in the header (or navigate to **[http://localhost/admin](http://localhost/admin)**). Sign in as the admin user (`admin@example.com` / `admin123`) if prompted.
2. Review the aggregated statistics (Active sessions, Avg duration, average CSAT score).
3. The **Session History** table shows a complete record of the call you just completed, detailing duration, final CSAT, and resolution status.
4. Access raw scraper-compatible Prometheus metrics at: **[http://localhost:3001/metrics](http://localhost:3001/metrics)**.

---

## 6. Development & Troubleshooting

* **Restarting Services**: If you modify configuration values, restart with `docker compose down && docker compose up -d --build`.
* **Database Reset**: To wipe data and start fresh, run `docker compose down -v` to delete the persistent volumes, then rebuild.
