# dashboard/Dockerfile
# Multi-stage build: install deps → build → copy only the standalone output
# into a slim runtime image. Requires next.config.mjs to have
# `output: 'standalone'`.

FROM node:20-slim AS deps
WORKDIR /app
COPY dashboard/package.json dashboard/package-lock.json* ./
RUN npm ci

FROM node:20-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY dashboard/ ./
# scripts/bundle-models.mjs (npm's prebuild hook) reads dbt/models/* as the
# source of truth for the SQL shown in <SqlDrawer> / Methodology page. It
# locates that dir by going two levels up from its own path (repo_root/
# dashboard/scripts/../.. == repo_root locally). Since dashboard/'s contents
# are flattened into /app here, the same two-levels-up lands at container
# root, so dbt/models must live at /dbt/models, not /app/dbt/models.
COPY dbt/models /dbt/models
# This project has no public/ dir (no static assets yet). Next.js doesn't
# require one, but the runner stage below copies it unconditionally, so make
# sure it exists (even empty) rather than failing the build.
RUN mkdir -p public
RUN npm run build

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]