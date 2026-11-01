// ============================================================
// PACHA Simulador · Migración de datos SQLite → PostgreSQL
// Uso:  bun run scripts/migrar-sqlite-a-postgres.ts [ruta-custom.db]
// Lee el archivo SQLite original (solo lectura) y vuelca TODAS las
// tablas a la base PostgreSQL indicada en DATABASE_URL, respetando
// el orden de llaves foráneas. Idempotente solo sobre base vacía.
// ============================================================
import { PrismaClient } from '@prisma/client'
import { Database } from 'bun:sqlite'

const RUTA_SQLITE = process.argv[2] ?? process.cwd() + '/db/custom.db'
const URL_PG = process.env.DATABASE_URL
if (!URL_PG || !URL_PG.startsWith('postgresql')) {
  console.error('FATAL: DATABASE_URL debe apuntar a PostgreSQL antes de migrar.')
  process.exit(1)
}

// Prisma SQLite guarda fechas como texto «2025-10-31 23:45:00.123 +00:00»
// (y algunas como milisegundos epoch, p. ej. 1793490461086)
function toDate(v: unknown): Date | null {
  if (v == null) return null
  if (v instanceof Date) return v
  const crudo = String(v).trim()
  if (/^\d{10,}$/.test(crudo)) return new Date(Number(crudo)) // epoch ms
  const iso = crudo.replace(' ', 'T').replace(/ /g, '')
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) throw new Error(`Fecha ilegible: ${JSON.stringify(v)}`)
  return d
}

function toBool(v: unknown): boolean {
  return v === 1 || v === true || v === '1'
}

interface TablaPlan {
  m: string // propiedad del cliente Prisma
  t: string // nombre de la tabla en SQLite
  b: string[] // columnas booleanas (SQLite las guarda 0/1)
  f: string[] // columnas DateTime
}

// Orden según dependencias de llaves foráneas del schema.prisma
const TABLAS: TablaPlan[] = [
  { m: 'usuario', t: 'Usuario', b: [], f: ['createdAt'] },
  { m: 'industria', t: 'Industria', b: [], f: ['createdAt'] },
  { m: 'equipo', t: 'Equipo', b: [], f: ['createdAt'] },
  { m: 'membresia', t: 'Membresia', b: [], f: ['createdAt'] },
  { m: 'permisoArea', t: 'PermisoArea', b: ['abierto'], f: ['actualizadoAt'] },
  { m: 'marca', t: 'Marca', b: ['activa'], f: [] },
  { m: 'decision', t: 'Decision', b: [], f: ['createdAt'] },
  { m: 'borradorArea', t: 'BorradorArea', b: ['enviado'], f: ['enviadoAt', 'updatedAt'] },
  { m: 'compraEstudio', t: 'CompraEstudio', b: [], f: [] },
  { m: 'proyectoID', t: 'ProyectoID', b: [], f: [] },
  { m: 'penalizacion', t: 'Penalizacion', b: [], f: ['createdAt'] },
  { m: 'eventoCatalogo', t: 'EventoCatalogo', b: ['activo'], f: ['createdAt'] },
  { m: 'eventoPeriodo', t: 'EventoPeriodo', b: ['activo'], f: [] },
  { m: 'eventoPlan', t: 'EventoPlan', b: [], f: ['createdAt'] },
  { m: 'macroPeriodo', t: 'MacroPeriodo', b: ['ejecutado'], f: ['preparadoAt', 'ejecutadoAt'] },
  { m: 'reporte', t: 'Reporte', b: ['sinDecision'], f: [] },
  { m: 'reporteMarca', t: 'ReporteMarca', b: [], f: [] },
]

async function main() {
  const sqlite = new Database(RUTA_SQLITE, { readonly: true })
  const pg = new PrismaClient()

  const tablasSqlite = (
    sqlite.query(
      `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '\\_%' ESCAPE '\\' ORDER BY name`
    ).all() as { name: string }[]
  ).map((r) => r.name)
  console.log(`Tablas en SQLite: ${tablasSqlite.join(', ')}`)

  const planTablas = new Set(TABLAS.map((x) => x.t))
  const fueraDePlan = tablasSqlite.filter((t) => !planTablas.has(t))
  if (fueraDePlan.length) {
    console.warn(`⚠️  Tablas SQLite fuera del plan (no se migran): ${fueraDePlan.join(', ')}`)
  }

  console.log(`\nMigrando ${RUTA_SQLITE} → ${URL_PG.replace(/:[^:@/]+@/, ':****@')}\n`)
  const resumen: string[] = []

  for (const t of TABLAS) {
    const filas = sqlite.query(`SELECT * FROM "${t.t}"`).all() as Record<string, unknown>[]
    if (filas.length === 0) {
      resumen.push(`${t.t}: 0`)
      continue
    }
    const datos = filas.map((f) => {
      const d: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(f)) {
        if (t.b.includes(k)) d[k] = toBool(v)
        else if (t.f.includes(k)) d[k] = toDate(v)
        else d[k] = v
      }
      return d
    })
    const modelo = (pg as unknown as Record<string, { createMany: (a: unknown) => Promise<{ count: number }> }>)[t.m]
    const { count } = await modelo.createMany({ data: datos })
    resumen.push(`${t.t}: ${count}`)
  }

  // Verificación: comparar conteos
  console.log('Verificación SQLite → PostgreSQL:')
  let ok = true
  for (const t of TABLAS) {
    const origen = (sqlite.query(`SELECT COUNT(*) AS n FROM "${t.t}"`).get() as { n: number }).n
    const destino = await (pg as unknown as Record<string, { count: () => Promise<number> }>)[t.m].count()
    const marca = origen === destino ? '✅' : '❌'
    if (origen !== destino) ok = false
    console.log(`  ${marca} ${t.t.padEnd(16)} sqlite=${origen}  postgres=${destino}`)
  }

  await pg.$disconnect()
  sqlite.close()
  console.log('\n' + (ok ? '🎉 MIGRACIÓN COMPLETA Y VERIFICADA' : '❌ HAY DIFERENCIAS — REVISAR'))
  if (!ok) process.exit(2)
}

main().catch((e) => {
  console.error('FALLO MIGRACIÓN:', e)
  process.exit(1)
})
