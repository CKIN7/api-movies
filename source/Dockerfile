# syntax=docker/dockerfile:1

# ═══════════════════════════════════════════════════════════════
#  Builder: instala devDependencies y compila TypeScript
# ═══════════════════════════════════════════════════════════════
FROM node:24-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ═══════════════════════════════════════════════════════════════
#  Runtime: solo dependencias de produccion + artefactos
# ═══════════════════════════════════════════════════════════════
FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public

# tsc no copia archivos .sql. migrate.ts y seed.ts los resuelven
# desde __dirname, asi que se dejan junto al JS compilado.
COPY --from=builder /app/db/migrations ./dist/db/migrations
COPY --from=builder /app/db/schema.sql ./dist/db/schema.sql

# Winston escribe logs/error.log y logs/combined.log en el cwd.
RUN mkdir -p /app/logs && chown -R node:node /app

USER node
EXPOSE 8089

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8089/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "dist/api.js"]
