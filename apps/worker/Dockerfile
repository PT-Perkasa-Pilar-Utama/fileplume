FROM oven/bun:1.4.3-slim@sha256:14a223fa35747ec728bce300ef85888bc5f7958164d15bbba6a54b22b52a3288 AS base
WORKDIR /app

FROM base AS deps
COPY package.json bun.lock ./
COPY apps/ apps/
COPY packages/ packages/
RUN bun install --frozen-lockfile --production

FROM base AS runtime
COPY --from=deps /app /app
USER bun
CMD ["bun", "run", "apps/worker/src/index.ts"]
