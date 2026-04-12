# build
FROM oven/bun:1 AS builder

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .

# runtime
FROM oven/bun:1-slim AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy node_modules from builder (includes devDeps like drizzle-kit for migrations)
COPY --from=builder /app/node_modules ./node_modules

# Copy source & config
COPY --from=builder /app/src  ./src
COPY --from=builder /app/drizzle  ./drizzle
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/bunfig.toml  ./bunfig.toml

EXPOSE 3000

# Run migrations then start the server
CMD ["bun", "run", "start"]