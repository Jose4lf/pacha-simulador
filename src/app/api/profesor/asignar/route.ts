import { error, ok, body } from '@/lib/pacha/api-helpers'
import { requireRol } from '@/lib/pacha/auth'
import { db } from '@/lib/db'
import { PachaError } from '@/lib/pacha/tipos'

/** Asigna (o desasigna) un alumno a un equipo. */
export async function POST(req: Request) {
  try {
    await requireRol('PROFESOR')
    const { equipoId, alumnoId } = await body<{ equipoId: string; alumnoId: string | null }>(req)
    const equipo = await db.equipo.findUnique({ where: { id: equipoId } })
    if (!equipo) throw new PachaError('Equipo no encontrado', 404)

    if (alumnoId) {
      const alumno = await db.usuario.findUnique({ where: { id: alumnoId } })
      if (!alumno || alumno.rol !== 'ALUMNO') throw new PachaError('El usuario no es un alumno')
      const ocupado = await db.equipo.findUnique({ where: { alumnoId } })
      if (ocupado && ocupado.id !== equipoId) throw new PachaError(`${alumno.nombre} ya pertenece al equipo ${ocupado.nombre}`)
    }

    await db.equipo.update({ where: { id: equipoId }, data: { alumnoId } })
    return ok()
  } catch (e) {
    return error(e)
  }
}
