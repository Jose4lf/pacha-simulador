import { PrismaClient } from '@prisma/client'

/**
 * Cliente Prisma sobre PostgreSQL.
 *
 * La conexión se define 100% por la variable de entorno DATABASE_URL
 * (ver .env.example): esto permite desplegar en cualquier plataforma
 * — Vercel+Neon, Railway, Render, Fly, Docker o VPS — sin cambios de
 * código. El archivo SQLite `db/custom.db.respaldo-sqlite` se conserva
 * solo como respaldo histórico de la migración.
 *
 * En desarrollo local: `bun run db` arranca un PostgreSQL embebido en
 * el puerto 5433 (scripts/dev-db.ts, sin root ni Docker).
 */
function urlRequerida(): string {
  const url = process.env.DATABASE_URL
  if (!url || (!url.startsWith('postgresql://') && !url.startsWith('postgres://'))) {
    throw new Error(
      '[PACHA] DATABASE_URL no está definida o no es PostgreSQL. ' +
        'En desarrollo: `bun run db` y .env con postgresql://pacha:pacha@localhost:5433/pacha. ' +
        'En producción usa la URL que te dé Neon/Railway/Render (ver docs/DESPLIEGUE.md).'
    )
  }
  return url
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    datasources: { db: { url: urlRequerida() } },
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
