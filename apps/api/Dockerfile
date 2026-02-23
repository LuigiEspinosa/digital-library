# Pin Node 22-slim
# required to avoid canvas native addon rebuild failures on deploy
FROM node:22-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

RUN apt-get update && apt-get install -y --no-install-recommends \
    unrar-free \
    && rm -rf /var/lib/apt/lists/*

# ---- Dependencies ----
FROM base AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    pkg-config \
    unrar-free \
    && rm -rf /var/lib/apt/lists/*

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/

RUN pnpm install --frozen-lockfile --filter @digital-library/api...

# ---- Build ----
FROM deps AS build
WORKDIR /app
COPY tsconfig.json ./
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

RUN pnpm --filter @digital-library/shared build
RUN pnpm --filter @digital-library/api build

# ---- Deploy (flatten pnpm workspace symlinks) ----
# pnpm deploy produces a regular node_modules with no symlinks.
# @digital-library/shared is bundled directly inside it via the files field.
FROM build AS deploy
RUN pnpm --filter @digital-library/api deploy --prod /app/api-prod --legacy

# ---- Runtime ----
FROM node:22-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

RUN corepack enable
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    pkg-config \
    unrar-free \
    && rm -rf /var/lib/apt/lists/*

# Flat node_modules - no workspace symlinks, shared package bundled inside
COPY --from=deploy /app/api-prod/node_modules ./node_modules

# Compiled API
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/

# /data is the persistent volume mount point
VOLUME ["/data"]

EXPOSE 4000

CMD ["node", "apps/api/dist/index.js"]
