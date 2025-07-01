# ---------- Build Stage ----------
FROM node:20-slim AS build
WORKDIR /src

# Copy dependency definitions
COPY package.json package-lock.json ./
RUN npm ci

# Copy Prisma schema and files
COPY prisma ./prisma

# Copy application source
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build the application
RUN npm run build

# ---------- Run Stage ----------
FROM node:20-slim AS run
WORKDIR /src

# Copy built app and dependencies
COPY --from=build /src/dist ./dist
COPY --from=build /src/node_modules ./node_modules
COPY --from=build /src/package.json ./
COPY --from=build /src/tsconfig*.json ./

# Optional: copy Prisma files only if using runtime seed or migrations
COPY --from=build /src/prisma ./prisma

# Development start (switch to prod as needed)
CMD ["npm", "run", "start:dev"]
# For production: CMD ["npm", "start:prod"]

EXPOSE 3000