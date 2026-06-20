FROM node:22-alpine

WORKDIR /app

# Install dependencies first (caching layer)
COPY package*.json ./
RUN npm ci

# Copy the rest of the application files
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build the Next.js application
RUN npm run build

# Expose the default port
EXPOSE 8080

# Environment variables for production running
ENV PORT=8080
ENV HOSTNAME="0.0.0.0"
ENV NODE_ENV=production

# Start Next.js server on port 8080
CMD ["npx", "next", "start", "-p", "8080"]
