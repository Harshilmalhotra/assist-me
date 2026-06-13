FROM node:20-alpine

# Build tools for mediasoup native compilation and FFmpeg for recording
RUN apk add --no-cache python3 make g++ ffmpeg

WORKDIR /app
COPY package*.json ./

# Install packages with legacy peer deps
RUN npm ci --omit=dev --legacy-peer-deps

COPY src ./src

EXPOSE 3001
EXPOSE 40000-40100/udp

CMD ["node", "src/index.js"]
