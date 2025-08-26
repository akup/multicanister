# Use Node.js 22 Alpine as base image
FROM node:22-alpine

RUN apk add --no-cache curl

# Install pnpm
RUN npm install -g pnpm

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for build)
RUN pnpm install

# Copy source code
COPY . .

# Build the TypeScript application
RUN pnpm run build

# Remove dev dependencies to reduce image size
RUN pnpm prune --prod

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "dist/index.js"] 