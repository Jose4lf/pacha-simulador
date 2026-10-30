import { error, ok, body } from '@/lib/pacha/api-helpers'
import { requireRol } from '@/lib/pacha/auth'
import { crearIndustria } from '@/lib/pacha/simulacion'

export async function POST(req: Request) {
  try {
    const usuario = await requireRol('PROFESOR')
    const { nombre, equipos } = await body<{ nombre: string; equipos: string[] }>(req)
    const industria = await crearIndustria(nombre, usuario.id, Array.isArray(equipos) ? equipos : [])
    return ok({ id: industria.id, nombre: industria.nombre })
  } catch (e) {
    return error(e)
  }
}
