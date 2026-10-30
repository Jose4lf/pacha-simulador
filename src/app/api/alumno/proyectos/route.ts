import { error, ok, body } from '@/lib/pacha/api-helpers'
import { requireRol } from '@/lib/pacha/auth'
import { db } from '@/lib/db'
import { registrarProyecto } from '@/lib/pacha/simulacion'
import { PachaError } from '@/lib/pacha/tipos'

export async function POST(req: Request) {
  try {
    const usuario = await requireRol('ALUMNO')
    const equipo = await db.equipo.findUnique({ where: { alumnoId: usuario.id } })
    if (!equipo) throw new PachaError('No tienes un equipo asignado', 404)

    const { nombre, atributos, presupuesto } = await body<{ nombre: string; atributos: number[]; presupuesto: number }>(req)
    const res = await registrarProyecto(equipo.id, nombre, atributos, presupuesto)
    return ok(res)
  } catch (e) {
    return error(e)
  }
}

export async function GET() {
  try {
    const usuario = await requireRol('ALUMNO')
    const equipo = await db.equipo.findUnique({ where: { alumnoId: usuario.id } })
    if (!equipo) throw new PachaError('No tienes un equipo asignado', 404)
    const proyectos = await db.proyectoID.findMany({ where: { equipoId: equipo.id }, orderBy: { anioInicio: 'asc' } })
    return ok({ proyectos })
  } catch (e) {
    return error(e)
  }
}
