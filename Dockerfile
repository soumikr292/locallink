FROM node:20-alpine

WORKDIR /app

# Install backend production dependencies first for better layer caching
COPY backend/package.json backend/package-lock.json* ./backend/
RUN cd backend && \
    if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

# Copy backend API and frontend web/PWA assets
COPY backend ./backend
COPY frontend ./frontend

ENV NODE_ENV=production
ENV PORT=5001

EXPOSE 5001

# If AUTO_INIT_DB=true is configured, safely ensure tables exist & seed only empty DB before booting
CMD ["sh", "-c", "if [ \"$AUTO_INIT_DB\" = \"true\" ]; then node backend/scripts/initCloudDb.js; fi && exec node backend/server.js"]
