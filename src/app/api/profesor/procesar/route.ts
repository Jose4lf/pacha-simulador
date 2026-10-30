import { error, ok, body } from '@/lib/pacha/api-helpers'
import { requireRol } from '@/lib/pacha/auth'
import { db } from '@/lib/db'
import { PachaError } from '@/lib/pacha/tipos'
import { procesarRonda } from '@/lib/pacha/simulacion'

/** El profesor dispara el motor: procesa la ronda del año actual. */
export async function POST(req: Request) {
  try {
    const usuario = await requireRol('PROFESOR')
    const { industriaId } = await body<{ industriaId: string }>(req)
    if (!industriaId) throw new PachaError('Falta industriaId')

    const industria = await db.industria.findUnique({ where: { id: industriaId } })
    if (!industria) throw new PachaError('Industria no encontrada', 404)
    if (industria.profesorId !== usuario.id) throw new PachaError('No es tu industria', 403)

    const res = await procesarRonda(industriaId)
    return ok(res)
  } catch (e) {
    return error(e)
  }
}
