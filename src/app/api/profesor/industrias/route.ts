import { error, ok, body } from '@/lib/pacha/api-helpers'
import { requireRol } from '@/lib/pacha/auth'
import { crearIndustria, eliminarIndustria, type EmpresaEntrada } from '@/lib/pacha/simulacion'
import { PachaError } from '@/lib/pacha/tipos'

/**
 * Crea una simulación: 2-10 empresas, cada una con UN solo GERENTE (1 alumno,
 * se crea si no existe) y el nº de periodos configurado.
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

/**
 * ELIMINA una simulación completa: ?id=<industriaId>
 * Los estudiantes que participaban quedan SIN DESIGNAR (sus cuentas se
 * conservan; verán ese estado al iniciar sesión hasta ser asignados de nuevo).
 */
export async function DELETE(req: Request) {
  try {
    const usuario = await requireRol('PROFESOR')
    const id = new URL(req.url).searchParams.get('id')
    if (!id) throw new PachaError('Falta el id de la simulación')
    const res = await eliminarIndustria(id, usuario.id)
    return ok(res)
  } catch (e) {
    return error(e)
  }
}
