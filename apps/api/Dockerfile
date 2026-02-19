# Pin Node 22-slim
# required to avoid canvas native addon rebuild failures on deploy
FROM node:22-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# ---- Dependencies ----
FROM base AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/

RUN pnpm install --frozen-lockfile --filter @digital-library/api...

# ---- Build ----
FROM deps AS build
COPY tsconfig.json ./
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
RUN pnpm --filter @digital-library/api build

# ---- Runtime ----
FROM node:22-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

RUN corepack enable
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/shared ./packages/shared
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/

# /data is the persistent volume mount point
VOLUME ["/data"]

EXPOSE 4000

CMD ["node", "apps/api/dist/index.js"]
