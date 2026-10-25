# Static React build served by Caddy, which also terminates TLS and proxies /api and /auth to the API.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --workspace @cassete/web --include-workspace-root
COPY apps/web apps/web
RUN npm run build --workspace @cassete/web

FROM caddy:2.8-alpine
COPY docker/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/apps/web/dist /srv
