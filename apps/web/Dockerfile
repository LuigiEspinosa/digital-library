FROM node:22-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/web/package.json ./apps/web/

RUN pnpm install --frozen-lockfile --filter @digital-library/web...

FROM deps AS build
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web
ENV PUBLIC_API_URL=http://api:4000
RUN pnpm --filter @digital-library/web build

FROM node:22-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

RUN corepack enable

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/web/build ./apps/web/build
COPY --from=build /app/apps/web/package.json ./apps/web/

EXPOSE 3000

CMD ["node", "apps/web/build/index.js"]
