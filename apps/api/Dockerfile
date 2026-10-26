FROM oven/bun:1.4.4-slim@sha256:1846adf22496bd711036aae8be147e57bdebbaea2e5264e3e0b5af1db187d9a4 AS base
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
