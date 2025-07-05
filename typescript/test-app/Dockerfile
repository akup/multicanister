# Use Node.js 22 Alpine as base image
FROM node:22-alpine

# Install pnpm
RUN npm install -g pnpm

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN pnpm install --prod

# Copy source code
COPY . .

# Build the TypeScript application
RUN pnpm run build

# Expose port
EXPOSE 3000

# Start the application
CMD ["pnpm", "start"] 