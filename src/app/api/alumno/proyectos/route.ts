import { error, ok, body } from '@/lib/pacha/api-helpers'
import { requireRol } from '@/lib/pacha/auth'
import { db } from '@/lib/db'
import { registrarProyecto } from '@/lib/pacha/simulacion'
import { PachaError } from '@/lib/pacha/tipos'

export async function POST(req: Request) {
  try {
    const usuario = await requireRol('ALUMNO')
    const membresia = await db.membresia.findFirst({ where: { usuarioId: usuario.id } })
    if (!membresia) throw new PachaError('No perteneces a ninguna empresa', 404)

    const { nombre, atributos, presupuesto } = await body<{ nombre: string; atributos: number[]; presupuesto: number }>(req)
    const res = await registrarProyecto(membresia.equipoId, usuario.id, nombre, atributos, presupuesto)
    return ok(res)
  } catch (e) {
    return error(e)
  }
}

export async function GET() {
  try {
    const usuario = await requireRol('ALUMNO')
    const membresia = await db.membresia.findFirst({ where: { usuarioId: usuario.id } })
    if (!membresia) throw new PachaError('No perteneces a ninguna empresa', 404)
    const proyectos = await db.proyectoID.findMany({ where: { equipoId: membresia.equipoId }, orderBy: { anioInicio: 'asc' } })
    return ok({ proyectos })
  } catch (e) {
    return error(e)
  }
}
