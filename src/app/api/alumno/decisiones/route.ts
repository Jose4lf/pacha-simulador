import { error, ok, body } from '@/lib/pacha/api-helpers'
import { requireRol } from '@/lib/pacha/auth'
import { db } from '@/lib/db'
import { enviarDecision, guardarBorradorArea } from '@/lib/pacha/simulacion'
import { PachaError } from '@/lib/pacha/tipos'

type Accion = 'borrador-area' | 'enviar'

export async function POST(req: Request) {
  try {
    const usuario = await requireRol('ALUMNO')
    const membresia = await db.membresia.findFirst({ where: { usuarioId: usuario.id } })
    if (!membresia) throw new PachaError('No perteneces a ninguna empresa', 404)

    const { accion, cargo, contenido } = await body<{ accion: Accion; cargo?: string; contenido?: unknown }>(req)

    if (accion === 'borrador-area') {
      if (!cargo) throw new PachaError('Falta el cargo (área) del borrador')
      const res = await guardarBorradorArea(membresia.equipoId, usuario.id, cargo, contenido ?? {})
      return ok(res)
    }
    if (accion === 'enviar') {
      const res = await enviarDecision(membresia.equipoId, usuario.id)
      return ok(res)
    }
    throw new PachaError('Acción inválida')
  } catch (e) {
    return error(e)
  }
}
