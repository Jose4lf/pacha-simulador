import { ok } from '@/lib/pacha/api-helpers'
import { db } from '@/lib/db'

/**
 * Cuentas de acceso reales del sistema (solo administrador y profesores).
 * Público: alimenta la sección «Cuentas actuales» del login.
 */
export async function GET() {
  const usuarios = await db.usuario.findMany({
    where: { rol: { in: ['DECANO', 'PROFESOR'] } },
    select: { nombre: true, rol: true },
    orderBy: [{ rol: 'asc' }, { nombre: 'asc' }],
  })
  return ok({ cuentas: usuarios })
}
