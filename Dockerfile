# ── Build stage ───────────────────────────────────────────────────────────────
FROM oven/bun:1.2 AS builder

WORKDIR /app

# Copier les fichiers de config du monorepo
COPY package.json bun.lock turbo.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/db/package.json ./packages/db/
COPY packages/types/package.json ./packages/types/ 2>/dev/null || true

# Installer les dépendances
RUN bun install --frozen-lockfile

# Copier le code source
COPY apps/api ./apps/api
COPY packages ./packages

# Compiler l'API
RUN bun build apps/api/src/index.ts --outdir apps/api/dist --target bun

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM oven/bun:1.2-slim AS runner

WORKDIR /app

# Copier uniquement le nécessaire
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules 2>/dev/null || true
COPY --from=builder /app/packages ./packages

EXPOSE 3000

CMD ["bun", "dist/index.js"]
