FROM oven/bun:1.3.8-slim AS base
WORKDIR /app

FROM base AS deps
COPY package.json bun.lock ./
COPY apps/ apps/
COPY packages/ packages/
RUN bun install --frozen-lockfile --production

FROM base AS runtime
COPY --from=deps /app /app
USER bun
CMD ["bun", "run", "apps/api/src/index.ts"]
