# Homed web app (Next.js standalone) for Fly.io. Build context: repo root.
FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 HOMED_STANDALONE=1
# Manifests first so dependency install is cached. apps/mobile/package.json is only here because the
# lockfile lists the workspace; its (large) Expo dependencies are not installed.
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY packages/data/package.json packages/data/
COPY packages/db/package.json packages/db/
COPY apps/web/package.json apps/web/
COPY apps/mobile/package.json apps/mobile/
RUN npm ci -w @homed/web --include-workspace-root --ignore-scripts --no-audit --no-fund
COPY tsconfig.base.json ./
COPY packages packages
COPY apps/web apps/web
RUN npm run build -w @homed/web

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=8080 HOSTNAME=0.0.0.0 HOMED_DATA_DIR=/data
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public
EXPOSE 8080
CMD ["node", "apps/web/server.js"]
