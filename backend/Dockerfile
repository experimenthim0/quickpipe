# Stage 1: Build dependencies
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm ci --only=production

# Stage 2: Production release
FROM node:20-alpine

WORKDIR /usr/src/app

# Set production environment variables
ENV NODE_ENV=production
ENV PORT=5000

# Copy node modules and sources from builder stage
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY . .

# Run as non-root user for security hardening
USER node

EXPOSE 5000

# Container healthcheck definition
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:5000/').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["node", "server.js"]
