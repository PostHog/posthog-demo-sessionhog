FROM node:18-slim

# Install required dependencies for Playwright
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-freefont-ttf \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Changed from npm ci to npm install
RUN npm install

# Copy app files maintaining structure
COPY app/ ./app/
COPY tools/ ./tools/

# Create non-root user
RUN adduser --disabled-password --gecos "" appuser
USER appuser

# Start the cron process
CMD ["node", "app/sessions_server.js"]