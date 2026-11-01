# ============================================================
# PACHA Simulador · Imagen de producción (Bun + Next standalone)
# Uso:
#   docker build -t pacha-simulador .
#   docker run -p 3000:3000 -e DATABASE_URL="postgresql://..." pacha-simulador
# ============================================================
FROM oven/bun:1 AS deps
WORKDIR /app
# Prisma necesita OpenSSL en Debian (base de oven/bun)
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY package.json bun.lock ./
COPY prisma ./prisma
RUN bun install --frozen-lockfile

FROM deps AS builder
WORKDIR /app
COPY . .
# build = prisma generate && next build && copia standalone
RUN bun run build

FROM oven/bun:1-slim AS runner
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/prisma ./prisma
EXPOSE 3000
# Aplica migraciones pendientes y arranca el servidor standalone con Bun
CMD ["sh", "-c", "bunx prisma migrate deploy && bun server.js"]
