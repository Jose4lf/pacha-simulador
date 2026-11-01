import { error, ok, body } from '@/lib/pacha/api-helpers'
import { requireRol } from '@/lib/pacha/auth'
import { aprobarDecision } from '@/lib/pacha/simulacion'
import { PachaError } from '@/lib/pacha/tipos'

/** El docente da (o retira) el visto bueno a la decisión anual de una empresa. */
export async function POST(req: Request) {
  try {
    const usuario = await requireRol('PROFESOR')
    const { decisionId, aprobada } = await body<{ decisionId: string; aprobada: boolean }>(req)
    if (!decisionId) throw new PachaError('Falta decisionId')
    const res = await aprobarDecision(decisionId, usuario.id, aprobada !== false)
    return ok(res)
  } catch (e) {
    return error(e)
  }
}
