import { body, error, ok } from '@/lib/pacha/api-helpers'
import { requireRol } from '@/lib/pacha/auth'
import { db } from '@/lib/db'
import { asignarEventoPlan, autocompletarPlan, planDeEventos, quitarEventoPlan } from '@/lib/pacha/simulacion'
import { PachaError } from '@/lib/pacha/tipos'

/**
 * PLAN de eventos por año (corrección): los eventos ocurren dentro de cada
 * simulación, por años; el docente fija un evento para un año determinado
 * (1 a 3 por año, sin repetir categoría en el mismo año).
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

    const plan = await planDeEventos(industriaId)
    return ok(plan)
  } catch (e) {
    return error(e)
  }
}

/** Acciones del plan: asignar un evento a un año, quitarlo o autocompletar años vacíos. */
export async function POST(req: Request) {
  try {
    const usuario = await requireRol('PROFESOR')
    const { industriaId, accion, anio, catalogoId, planId } = await body<{
      industriaId: string
      accion: 'asignar' | 'quitar' | 'autocompletar'
      anio?: number
      catalogoId?: string
      planId?: string
    }>(req)
    if (!industriaId) throw new PachaError('Falta industriaId')
    const industria = await db.industria.findUnique({ where: { id: industriaId } })
    if (!industria) throw new PachaError('Industria no encontrada', 404)
    if (industria.profesorId !== usuario.id) throw new PachaError('No es tu industria', 403)

    if (accion === 'asignar') {
      if (!anio || !catalogoId) throw new PachaError('Faltan anio o catalogoId')
      const r = await asignarEventoPlan(industriaId, Math.round(Number(anio)), catalogoId)
      return ok({ ...r, plan: await planDeEventos(industriaId) })
    }
    if (accion === 'quitar') {
      if (!planId) throw new PachaError('Falta planId')
      const r = await quitarEventoPlan(industriaId, planId)
      return ok({ ...r, plan: await planDeEventos(industriaId) })
    }
    if (accion === 'autocompletar') {
      const r = await autocompletarPlan(industriaId)
      return ok({ ...r, plan: await planDeEventos(industriaId) })
    }
    throw new PachaError('Acción inválida (asignar | quitar | autocompletar)')
  } catch (e) {
    return error(e)
  }
}

/** El docente ajusta (o desactiva) un evento YA resuelto del periodo ANTES de ejecutar (doc §15, §16). */
export async function PATCH(req: Request) {
  try {
    const usuario = await requireRol('PROFESOR')
    const { eventoId, activo, efectoDemanda, efectoCosto, efectoLogistica, meses, region } = await body<{
      eventoId: string
      activo?: boolean
      efectoDemanda?: number
      efectoCosto?: number
      efectoLogistica?: number
      meses?: number[]
      region?: string
    }>(req)
    if (!eventoId) throw new PachaError('Falta eventoId')

    const evento = await db.eventoPeriodo.findUnique({ where: { id: eventoId }, include: { industria: true } })
    if (!evento) throw new PachaError('Evento no encontrado', 404)
    if (evento.industria.profesorId !== usuario.id) throw new PachaError('No es tu industria', 403)
    const macro = await db.macroPeriodo.findUnique({ where: { industriaId_anio: { industriaId: evento.industriaId, anio: evento.anio } } })
    if (macro?.ejecutado) throw new PachaError('El periodo ya fue ejecutado y es inmutable')

    const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, Number(v) || 0))
    const data: Record<string, unknown> = {}
    if (typeof activo === 'boolean') data.activo = activo
    if (efectoDemanda !== undefined) data.efectoDemanda = clamp(efectoDemanda, -0.2, 0.25) // topes doc §11
    if (efectoCosto !== undefined) data.efectoCosto = clamp(efectoCosto, -0.1, 0.3)
    if (efectoLogistica !== undefined) data.efectoLogistica = clamp(efectoLogistica, 0, 0.5)
    if (Array.isArray(meses) && meses.length > 0) {
      const validos = meses.map((m) => Math.round(clamp(m, 1, 12)))
      data.mesesJson = JSON.stringify([...new Set(validos)].sort((a, b) => a - b))
    }
    if (region) data.region = region

    const actualizado = await db.eventoPeriodo.update({ where: { id: eventoId }, data })
    return ok({ ok: true, evento: actualizado })
  } catch (e) {
    return error(e)
  }
}
