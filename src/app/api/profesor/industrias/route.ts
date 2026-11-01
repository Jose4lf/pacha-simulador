import { error, ok, body } from '@/lib/pacha/api-helpers'
import { requireRol } from '@/lib/pacha/auth'
import { crearIndustria, type EmpresaEntrada } from '@/lib/pacha/simulacion'
import { PachaError } from '@/lib/pacha/tipos'

/**
 * Crea una simulación: 2-10 empresas, cada una con sus gerentes (alumnos,
 * se crean si no existen) y el nº de periodos configurado por el docente.
 */
export async function POST(req: Request) {
  try {
    const usuario = await requireRol('PROFESOR')
    const { nombre, periodos, empresas } = await body<{
      nombre: string
      periodos?: number
      empresas?: EmpresaEntrada[]
    }>(req)
    if (!Array.isArray(empresas)) throw new PachaError('Falta la lista de empresas')
    const industria = await crearIndustria(nombre, usuario.id, { periodos, empresas })
    return ok({ id: industria.id, nombre: industria.nombre, anioMaximo: industria.anioMaximo })
  } catch (e) {
    return error(e)
  }
}
