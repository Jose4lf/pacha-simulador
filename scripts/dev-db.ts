// Arranca un PostgreSQL embebido (binarios locales, sin root ni Docker)
// SOLO para desarrollo local. En producción se usa Neon/Railway/Render/Docker.
// Uso: bun run scripts/dev-db.ts   (deja el proceso corriendo)
import EmbeddedPostgres from 'embedded-postgres'
import fs from 'fs'

const DATA_DIR = process.cwd() + '/db/pgdata-dev'
const PORT = 5433

async function main() {
  const yaExiste = fs.existsSync(DATA_DIR) && fs.readdirSync(DATA_DIR).length > 0

  const pg = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user: 'pacha',
    password: 'pacha',
    port: PORT,
    persistent: true,
  })

  if (!yaExiste) {
    console.log(`[dev-db] Inicializando clúster nuevo en ${DATA_DIR} ...`)
    await pg.initialise()
  } else {
    console.log('[dev-db] Clúster existente, omitiendo initdb')
  }

  console.log(`[dev-db] Arrancando PostgreSQL en puerto ${PORT} ...`)
  await pg.start()

  try {
    await pg.createDatabase('pacha')
    console.log('[dev-db] Base de datos «pacha» creada')
  } catch {
    console.log('[dev-db] Base de datos «pacha» ya existía')
  }

  console.log(`[dev-db] ✅ LISTO  →  postgresql://pacha:pacha@localhost:${PORT}/pacha`)

  // Mantener el proceso vivo
  setInterval(() => {}, 60_000)
}

main().catch((e) => {
  console.error('[dev-db] FALLO:', e)
  process.exit(1)
})
