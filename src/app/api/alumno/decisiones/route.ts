import { error, ok, body } from '@/lib/pacha/api-helpers'
import { requireRol } from '@/lib/pacha/auth'
import { db } from '@/lib/db'
import { enviarDecision } from '@/lib/pacha/simulacion'
import { PachaError } from '@/lib/pacha/tipos'

/** ENVÍO DIRECTO de la decisión del año: una sola llamada con todo el contenido
 *  (precios, publicidad, producción + inversión, ventas, I+D). Sin borradores. */
export async function POST(req: Request) {
  try {
    const usuario = await requireRol('ALUMNO')
    const membresia = await db.membresia.findFirst({ where: { usuarioId: usuario.id } })
    if (!membresia) throw new PachaError('No perteneces a ninguna empresa', 404)

    const { contenido } = await body<{ contenido?: unknown }>(req)
    const res = await enviarDecision(membresia.equipoId, usuario.id, contenido ?? {})
    return ok(res)
  } catch (e) {
    return error(e)
  }
}
