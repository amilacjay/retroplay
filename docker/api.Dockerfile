# NestJS API. Build context is the repo root (npm workspaces share one lockfile).
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --workspace @cassete/api --include-workspace-root
COPY apps/api apps/api
RUN npm run build --workspace @cassete/api

FROM node:22-alpine
ENV NODE_ENV=production API_HOST=0.0.0.0 API_PORT=3000
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --workspace @cassete/api --omit=dev && npm cache clean --force
COPY --from=build /app/apps/api/dist apps/api/dist
WORKDIR /app/apps/api
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/session').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "dist/main.js"]
