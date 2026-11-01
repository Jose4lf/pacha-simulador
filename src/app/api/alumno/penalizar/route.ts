import { error, ok, body } from '@/lib/pacha/api-helpers'
import { requireRol } from '@/lib/pacha/auth'
import { db } from '@/lib/db'
import { penalizarGerente } from '@/lib/pacha/simulacion'
import { PachaError } from '@/lib/pacha/tipos'

/** El comité penaliza a un gerente con desempeño muy negativo (opción elegida por el grupo). */
export async function POST(req: Request) {
  try {
    const usuario = await requireRol('ALUMNO')
    const membresia = await db.membresia.findFirst({ where: { usuarioId: usuario.id } })
    if (!membresia) throw new PachaError('No perteneces a ninguna empresa', 404)

    const equipo = await db.equipo.findUnique({ where: { id: membresia.equipoId }, include: { industria: true } })
    if (!equipo) throw new PachaError('Equipo no encontrado', 404)

    const { usuarioId, tipo, puntos, motivo } = await body<{
      usuarioId: string
      tipo: 'AMONESTACION' | 'PUNTOS' | 'EXPULSION'
      puntos?: number
      motivo?: string
    }>(req)
    if (!usuarioId) throw new PachaError('Falta el gerente a penalizar')
    if (!tipo) throw new PachaError('Falta el tipo de penalización')

    const res = await penalizarGerente(
      membresia.equipoId,
      usuarioId,
      tipo,
      Number(puntos) || 0,
      motivo ?? '',
      usuario.id,
      equipo.industria.anioActual
    )
    return ok(res)
  } catch (e) {
    return error(e)
  }
}
