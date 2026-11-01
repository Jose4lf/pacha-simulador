import { error, ok, body } from '@/lib/pacha/api-helpers'
import { requireRol } from '@/lib/pacha/auth'
import { db } from '@/lib/db'
import { cambiarPermisoArea } from '@/lib/pacha/simulacion'
import { PachaError } from '@/lib/pacha/tipos'

/**
 * El gerente responsable de un área abre/cierra el acceso del equipo a su área.
 * POST { cargo, abierto }
 */
export async function POST(req: Request) {
  try {
    const usuario = await requireRol('ALUMNO')
    const membresia = await db.membresia.findFirst({ where: { usuarioId: usuario.id } })
    if (!membresia) throw new PachaError('No perteneces a ninguna empresa', 404)

    const { cargo, abierto } = await body<{ cargo?: string; abierto?: boolean }>(req)
    if (!cargo || typeof abierto !== 'boolean') throw new PachaError('Faltan cargo o abierto')

    const res = await cambiarPermisoArea(membresia.equipoId, usuario.id, cargo, abierto)
    return ok(res)
  } catch (e) {
    return error(e)
  }
}
