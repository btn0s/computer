FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source
COPY prisma ./prisma
COPY src ./src
COPY tsconfig.json ./

# Generate Prisma client
RUN npx prisma generate

# Build
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev

# Copy Prisma files and generate client
COPY prisma ./prisma
RUN npx prisma generate

# Copy built files
COPY --from=builder /app/dist ./dist

# Set environment
ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "dist/index.js"]
