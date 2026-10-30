import { error, ok } from '@/lib/pacha/api-helpers'
import { requireRol } from '@/lib/pacha/auth'
import { db } from '@/lib/db'
import { parseJson, PachaError } from '@/lib/pacha/tipos'

/** Datos de los estudios de mercado comprados (solo años ya procesados). */
export async function GET() {
  try {
    const usuario = await requireRol('ALUMNO')
    const equipo = await db.equipo.findUnique({
      where: { alumnoId: usuario.id },
      include: { industria: true },
    })
    if (!equipo) throw new PachaError('No tienes un equipo asignado', 404)

    const compras = await db.compraEstudio.findMany({
      where: { equipoId: equipo.id },
      orderBy: [{ anio: 'desc' }, { estudioId: 'asc' }],
    })

    return ok({
      estudios: compras.map((c) => ({
        anio: c.anio,
        estudioId: c.estudioId,
        costo: c.costo,
        datos: parseJson<unknown>(c.datos, null),
      })),
    })
  } catch (e) {
    return error(e)
  }
}
