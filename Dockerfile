# Use the official Node.js 18 slim image
FROM node:18-slim

# Install build dependencies needed by better-sqlite3 (and other native modules)
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /app

# Copy dependency definitions
COPY package*.json ./

# Install dependencies (omit dev dependencies)
RUN npm ci --omit=dev

# Copy the application source
COPY . .

# Create required directories
RUN mkdir -p database public/uploads

# Fix permissions
RUN chown -R node:node /app

# Drop root privileges
USER node

# Expose the app port
EXPOSE 3000

# Healthcheck for container orchestration
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the app
CMD ["npm", "start"]