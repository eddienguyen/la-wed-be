# Use Node.js LTS Alpine image
FROM node:20.19.0-alpine

# Set working directory
WORKDIR /usr/src/app

# Set production environment
ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

# Build-time arguments for versioning
ARG GIT_COMMIT_HASH=unknown
ARG GIT_BRANCH=unknown
ARG BUILD_TIMESTAMP=unknown

# Set environment variables for runtime access
ENV GIT_COMMIT_HASH=${GIT_COMMIT_HASH}
ENV GIT_BRANCH=${GIT_BRANCH}
ENV BUILD_TIMESTAMP=${BUILD_TIMESTAMP}
ENV DEPLOYED_AT=${BUILD_TIMESTAMP}

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

# Expose port (Render will set PORT env variable)
EXPOSE 3000

# Start the application
CMD ["node", "src/app.js"]