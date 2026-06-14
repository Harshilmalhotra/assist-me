# Deploying to production (assistme.harshilmalhotra.dev)

This guide shows how to host the project on a fresh Oracle server for the domain `assistme.harshilmalhotra.dev`.

## Prerequisites
- An Oracle VM with a public IP and SSH access
- DNS A record for `assistme.harshilmalhotra.dev` pointing to the VM IP
- Docker and Docker Compose installed on the VM
- Ports opened in the VM security list / firewall: `80/tcp`, `443/tcp`, `40000-40100/udp`

## 1) Clone the repo on the server

```bash
cd /home/opc
git clone <your-repo-url> video-call
cd video-call
```

## 2) Prepare environment files

- `server/.env` — create a production `.env` (DO NOT commit). Minimal example:

```
NODE_ENV=production
PORT=3001
PUBLIC_URL=https://assistme.harshilmalhotra.dev
CLIENT_URL=https://assistme.harshilmalhotra.dev

# Postgres/Redis (using docker-compose services)
DB_HOST=postgres
DB_PORT=5432
DB_NAME=videosupport
DB_USER=videosupport_user
DB_PASSWORD=<STRONG_DB_PASSWORD>

REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=<STRONG_REDIS_PASSWORD>

# mediasoup — MUST be reachable by clients (public IP or domain)
MEDIASOUP_ANNOUNCED_IP=<YOUR_SERVER_PUBLIC_IP_OR_DOMAIN>
MEDIASOUP_RTC_MIN_PORT=40000
MEDIASOUP_RTC_MAX_PORT=40100
MEDIASOUP_NUM_WORKERS=1

# Security
JWT_SECRET=<STRONG_RANDOM_SECRET>
JWT_INVITE_SECRET=<STRONG_RANDOM_SECRET>

# Optional integrations
# SMTP, TELEGRAM, GEMINI, TWILIO — configure if you want them live
```

- Replace `<STRONG_DB_PASSWORD>` and `<STRONG_REDIS_PASSWORD>` with actual secrets. Do not leave any `REPLACE_WITH_*` placeholders in production.
- `MEDIASOUP_ANNOUNCED_IP` should be your public server IP or domain name that clients can reach.
- For local development outside Docker Compose, use `localhost` hosts and the exposed ports instead of `postgres`/`redis` service names.

- `client/.env` — already set to production in this repo: `VITE_API_URL=https://assistme.harshilmalhotra.dev/api` and `VITE_SOCKET_URL=https://assistme.harshilmalhotra.dev`

## 3) Verify `client/nginx.conf` uses internal service name

The repo's `client/nginx.conf` should proxy `/api` and `/socket.io` to the `server:3001` service name (this repo already contains that config). Keep it as-is for Docker Compose networking.

## 4) Open ports on Oracle and host firewall

- In the OCI Console, open the VM's subnet security list or instance security list for:
  - `80/tcp`, `443/tcp` (HTTP/HTTPS)
  - `40000-40100/udp` (mediasoup RTP/RTCP ports)

- On the VM (example using `firewall-cmd`/firewalld):

```bash
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --permanent --add-port=40000-40100/udp
sudo firewall-cmd --reload
```

## 5) (Recommended) Use host nginx for TLS termination

Run the client container on an internal port (8080) and let a host nginx terminate TLS and proxy traffic.

- Edit `docker-compose.yml` client ports mapping if needed:

```yaml
services:
  client:
    ports:
      - "8080:80"
```

- Host nginx example (save as `/etc/nginx/conf.d/assistme.conf`):

```
server { listen 80; server_name assistme.harshilmalhotra.dev; return 301 https://$host$request_uri; }

server {
  listen 443 ssl;
  server_name assistme.harshilmalhotra.dev;

  ssl_certificate /etc/letsencrypt/live/assistme.harshilmalhotra.dev/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/assistme.harshilmalhotra.dev/privkey.pem;

  location / {
    proxy_pass http://127.0.0.1:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location /api/ {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}
```

Obtain TLS certs with Certbot (`--nginx` plugin if nginx runs, or `--standalone` while stopping containers during issuance):

```bash
# install certbot (Ubuntu/Debian example)
sudo apt update && sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d assistme.harshilmalhotra.dev
```

## 6) Start the application stack

```bash
# from repo root
docker compose down
docker compose up -d --build
docker compose ps
docker compose logs -f server
```

## 7) Verify

- Visit: https://assistme.harshilmalhotra.dev
- Health: https://assistme.harshilmalhotra.dev/api/health
- Check that WebRTC works from remote networks; if you see media/connectivity failures, inspect UDP reachability and server logs.

## 8) TURN server (recommended for NAT traversal)

If users behind symmetric NATs fail to connect, deploy a TURN server (coturn). Example `docker-compose` service snippet:

```yaml
  coturn:
    image: instrumentisto/coturn:latest
    restart: unless-stopped
    ports:
      - "3478:3478/tcp"
      - "3478:3478/udp"
    environment:
      - REALM=assistme.harshilmalhotra.dev
      - LISTEN_ON_PUBLIC_IP=1
      - EXTERNAL_IP=<YOUR_PUBLIC_IP>
    command: ["--min-port=49152","--max-port=65535","--lt-cred-mech","--use-auth-secret","--static-auth-secret=your_static_secret"]
```

Then configure your client to use the TURN server `turn:assistme.harshilmalhotra.dev:3478` with credentials (or use the server to generate ephemeral credentials). I can help add coturn and client/server ICE config if you want.

## 9) Troubleshooting tips

- If the client cannot reach `/api` or `/socket.io`, confirm host nginx proxies and that `client/nginx.conf` proxies to `server:3001` within Docker network.
- If mediasoup producers/consumers fail, ensure the UDP port range is open and `MEDIASOUP_ANNOUNCED_IP` is your public IP.
- Check logs: `docker compose logs -f server`, `docker compose logs client`.

## 10) Security & maintenance

- Keep `.env` files out of git and rotate secrets periodically.
- Run regular backups for PostgreSQL (or switch to managed DB).
- Add monitoring (Prometheus, Grafana) if you run this in production scale.

If you want, I can:
- generate a secure `server/.env` template with randomized secrets,
- add a `docker-compose` coturn service and wire the client to use it,
- prepare the exact `certbot` + nginx commands for your VM OS (Oracle Linux / Ubuntu).

---

File references in this repo:
- `server/.env` — server environment template you must create
- `client/.env` — already set to production
- `client/nginx.conf` — internal proxy from web to `server:3001`
