# ==========================================
# Stage 1: Build the React + Vite Frontend
# ==========================================
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .
RUN npm run build

# ==========================================
# Stage 2: Production Server (Node.js + Express API + Persistent Storage)
# ==========================================
FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

# Copy built frontend assets into dist/
COPY --from=builder /app/dist ./dist

# Copy backend API server and initial data
COPY server.js ./
COPY data ./data
COPY recorder ./recorder

ENV NODE_ENV=production
ENV PORT=80
ENV DATA_DIR=/app/data/projects
ENV PDF_DIR=/app/data/pdfs

EXPOSE 80

HEALTHCHECK --interval=20s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:80/api/health || exit 1

CMD ["node", "server.js"]
