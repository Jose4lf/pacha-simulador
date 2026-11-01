import { body, error, ok } from '@/lib/pacha/api-helpers'
import { requireRol } from '@/lib/pacha/auth'
import { db } from '@/lib/db'
import { PachaError } from '@/lib/pacha/tipos'
import { prepararPeriodo } from '@/lib/pacha/simulacion'
import type { Escenario } from '@/lib/pacha/inflacion'

/**
 * Vista previa del entorno del periodo (doc §15, §18.10): eventos resueltos
 * e inflación π_t con sus factores. El docente consulta antes de ejecutar;
 * con POST puede fijar el escenario (o dejar el sorteo con semilla registrada).
 */
export async function GET(req: Request) {
  try {
    const usuario = await requireRol('PROFESOR')
    const url = new URL(req.url)
    const industriaId = url.searchParams.get('industriaId')
    if (!industriaId) throw new PachaError('Falta industriaId')
    const industria = await db.industria.findUnique({ where: { id: industriaId } })
    if (!industria) throw new PachaError('Industria no encontrada', 404)
    if (industria.profesorId !== usuario.id) throw new PachaError('No es tu industria', 403)

    const vista = await prepararPeriodo(industriaId)
    return ok(vista)
  } catch (e) {
    return error(e)
  }
}

export async function POST(req: Request) {
  try {
    const usuario = await requireRol('PROFESOR')
    const { industriaId, escenario } = await body<{ industriaId: string; escenario?: string }>(req)
    if (!industriaId) throw new PachaError('Falta industriaId')
    const industria = await db.industria.findUnique({ where: { id: industriaId } })
    if (!industria) throw new PachaError('Industria no encontrada', 404)
    if (industria.profesorId !== usuario.id) throw new PachaError('No es tu industria', 403)

    const macro = await db.macroPeriodo.findUnique({ where: { industriaId_anio: { industriaId, anio: industria.anioActual } } })
    if (macro?.ejecutado) throw new PachaError('El periodo ya fue ejecutado y es inmutable')

    const escenariosValidos = ['FAVORABLE', 'ESTABLE', 'DESFAVORABLE']
    if (escenario && !escenariosValidos.includes(escenario)) throw new PachaError('Escenario inválido')

    // si el docente fija el escenario, se recalcula la vista previa (doc §18.10)
    const vista = await prepararPeriodo(industriaId, escenario as Escenario | undefined)
    return ok(vista)
  } catch (e) {
    return error(e)
  }
}
