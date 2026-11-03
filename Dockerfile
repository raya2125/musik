FROM node:20-bookworm-slim

# Install system dependencies: Python 3, pip, ffmpeg, ca-certificates
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    ffmpeg \
    ca-certificates \
    curl \
 && rm -rf /var/lib/apt/lists/*

# Install yt-dlp python package for the audio streaming daemon
RUN pip3 install --no-cache-dir --break-system-packages -U yt-dlp

WORKDIR /app

# Copy dependency files first for layer caching
COPY package*.json ./

# Install npm dependencies (including vite to build frontend)
RUN npm install

# Copy application source
COPY . .

# Build the frontend to /app/dist
RUN npm run build

# Default environment
ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

# Start the combined server (serves frontend + stream & radio API)
CMD ["node", "server/index.js"]

