// Bootstrap del sistema — VERSIÓN LIMPIA (idempotente)
// El sistema arranca con UNA sola cuenta: el Administrador (Rectorado).
// El docente se registra después desde el panel del Rectorado y cada
// profesor crea sus propias simulaciones con sus alumnos. El catálogo de
// eventos de Bolivia (doc §10) se siembra porque el plan de eventos del
// docente lo necesita desde el primer momento.
import { db } from '@/lib/db'
import { hashPassword } from './auth'
import { sembrarCatalogoEventos } from './simulacion'

const CLAVE_INICIAL_ADMIN = '321'

let seedPromise: Promise<void> | null = null

export function seedSistema(): Promise<void> {
  if (!seedPromise) seedPromise = ejecutarSeed().catch((e) => { seedPromise = null; throw e })
  return seedPromise
}

async function ejecutarSeed(): Promise<void> {
  const admin = await db.usuario.findUnique({ where: { nombre: 'Admin' } })
  if (admin) return // ya inicializado

  // 1) Única cuenta inicial: Administrador (Rectorado), clave 321
  await db.usuario.create({
    data: { nombre: 'Admin', passwordHash: hashPassword(CLAVE_INICIAL_ADMIN), rol: 'DECANO' },
  })

  // 2) Catálogo de eventos de Bolivia (doc §10) disponible desde el inicio
  await sembrarCatalogoEventos()
}
