import { error, ok, body } from '@/lib/pacha/api-helpers'
import { requireRol } from '@/lib/pacha/auth'
import { db } from '@/lib/db'
import { definirRepresentante } from '@/lib/pacha/simulacion'
import { PachaError } from '@/lib/pacha/tipos'

/**
 * El docente designa (o cambia) al REPRESENTANTE de una empresa.
 * POST { equipoId, usuarioId }
 */
export async function POST(req: Request) {
  try {
    const usuario = await requireRol('PROFESOR')
    const { equipoId, usuarioId } = await body<{ equipoId?: string; usuarioId?: string }>(req)
    if (!equipoId || !usuarioId) throw new PachaError('Faltan equipoId o usuarioId')

    // Verificar que la empresa pertenece a una simulación de este docente
    const equipo = await db.equipo.findUnique({
      where: { id: equipoId },
      select: { industria: { select: { profesorId: true } } },
    })
    if (!equipo) throw new PachaError('Empresa no encontrada', 404)
    if (equipo.industria.profesorId !== usuario.id) throw new PachaError('No es tu simulación', 403)

    const res = await definirRepresentante(equipoId, usuarioId)
    return ok(res)
  } catch (e) {
    return error(e)
  }
}
