# ---------- Build Stage ----------
FROM node:20-slim AS build
WORKDIR /src

# Set faster Yarn registry
RUN yarn config set registry https://registry.npmjs.org

# Copy dependency definitions
COPY package.json yarn.lock ./
 RUN yarn install --frozen-lockfile

# Copy Prisma schema and files
COPY prisma ./prisma

# Copy application source
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build the application
RUN yarn build

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
CMD ["yarn", "run", "start:dev"]
# For production: CMD ["yarn", "start:prod"]

EXPOSE 3000