import { error, ok } from '@/lib/pacha/api-helpers'
import { requireRol } from '@/lib/pacha/auth'
import { db } from '@/lib/db'
import { parseJson, PachaError } from '@/lib/pacha/tipos'

/** Reporte anual detallado del equipo (por marca, canal y segmento). */
export async function GET(req: Request) {
  try {
    const usuario = await requireRol('ALUMNO')
    const equipo = await db.equipo.findUnique({ where: { alumnoId: usuario.id } })
    if (!equipo) throw new PachaError('No tienes un equipo asignado', 404)

    const url = new URL(req.url)
    const anioParam = url.searchParams.get('anio')
    const reporte = await db.reporte.findFirst({
      where: { equipoId: equipo.id, ...(anioParam ? { anio: Number(anioParam) } : {}) },
      orderBy: { anio: 'desc' },
      include: { marcas: true },
    })
    if (!reporte) throw new PachaError('Aún no hay reportes para tu equipo', 404)

    return ok({
      anio: reporte.anio,
      ventas: reporte.ventas,
      ingresos: reporte.ingresos,
      costos: reporte.costos,
      publicidad: reporte.publicidad,
      fuerzaVentas: reporte.fuerzaVentas,
      investigacionMercado: reporte.investigacionMercado,
      contribucion: reporte.contribucion,
      participacion: reporte.participacion,
      sinDecision: reporte.sinDecision,
      marcas: reporte.marcas.map((m) => ({
        marcaNombre: m.marcaNombre,
        ventas: m.ventas,
        produccion: m.produccion,
        inventario: m.inventario,
        ingresos: m.ingresos,
        costos: m.costos,
        contribucion: m.contribucion,
        participacion: m.participacion,
        porCanal: parseJson<{ canalId: string; ventas: number; ingresos: number }[]>(m.porCanal, []),
        porSegmento: parseJson<{ segmentoId: string; ventas: number; ingresos: number }[]>(m.porSegmento, []),
      })),
    })
  } catch (e) {
    return error(e)
  }
}
