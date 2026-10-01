# syntax=docker/dockerfile:1

# ConnectWOL: multi-stage build producing a small Next.js "standalone" image.
# Works on linux/amd64 and linux/arm64 (Raspberry Pi 4/5 with a 64-bit OS). On 32-bit ARM the native
# modules are compiled from source, which is why the build stage installs a compiler toolchain.

FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    # Docker sets HOSTNAME to the container name; Next would try to bind to it. Bind to all addresses.
    HOSTNAME=0.0.0.0 \
    DATABASE_PATH=/data/connectwol.db
WORKDIR /app

# SQLite lives on a volume so upgrades never touch your data.
RUN mkdir -p /data && chown node:node /data

COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/drizzle ./drizzle

# Sending UDP broadcasts does not need root.
USER node
EXPOSE 3000
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
