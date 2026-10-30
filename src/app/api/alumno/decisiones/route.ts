import { error, ok, body } from '@/lib/pacha/api-helpers'
import { requireRol } from '@/lib/pacha/auth'
import { db } from '@/lib/db'
import { enviarDecision, guardarBorrador } from '@/lib/pacha/simulacion'
import { PachaError, type DecisionContenido } from '@/lib/pacha/tipos'

export async function POST(req: Request) {
  try {
    const usuario = await requireRol('ALUMNO')
    const equipo = await db.equipo.findUnique({ where: { alumnoId: usuario.id } })
    if (!equipo) throw new PachaError('No tienes un equipo asignado', 404)

    const { accion, contenido } = await body<{ accion: 'borrador' | 'enviar'; contenido?: DecisionContenido }>(req)

    if (accion === 'borrador') {
      if (!contenido) throw new PachaError('Falta el contenido de la decisión')
      const res = await guardarBorrador(equipo.id, contenido)
      return ok(res)
    }
    if (accion === 'enviar') {
      const res = await enviarDecision(equipo.id)
      return ok(res)
    }
    throw new PachaError('Acción inválida')
  } catch (e) {
    return error(e)
  }
}
