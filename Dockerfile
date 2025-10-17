# Use Node.js LTS Alpine image
FROM node:20.19.0-alpine

# Set working directory
WORKDIR /usr/src/app

# Set production environment
ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

# Copy package files
COPY package*.json ./

# Install dependencies (including Prisma)
RUN npm ci --only=production

# Copy Prisma schema
COPY prisma ./prisma

# Generate Prisma Client
RUN npx prisma generate

# Copy application source code
COPY src ./src

# Expose port (Fly.io uses PORT env variable, defaults to 8080)
EXPOSE 8080

# Start the application
CMD ["node", "src/app.js"]