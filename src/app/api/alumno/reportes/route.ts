import { error, ok } from '@/lib/pacha/api-helpers'
import { requireRol } from '@/lib/pacha/auth'
import { db } from '@/lib/db'
import { parseJson, PachaError } from '@/lib/pacha/tipos'

/** Reporte anual detallado del equipo (por marca, canal, segmento, región,
 * con detalle mensual, finanzas, eventos e inflación del periodo).
 * Para el Año 0 incluye la historia de los 3 años anteriores. */
export async function GET(req: Request) {
  try {
    const usuario = await requireRol('ALUMNO')
    const membresia = await db.membresia.findFirst({ where: { usuarioId: usuario.id }, include: { equipo: true } })
    if (!membresia) throw new PachaError('No perteneces a ninguna empresa', 404)
    const equipo = membresia.equipo

    const url = new URL(req.url)
    const anioParam = url.searchParams.get('anio')
    const reporte = await db.reporte.findFirst({
      where: { equipoId: equipo.id, ...(anioParam ? { anio: Number(anioParam) } : {}) },
      orderBy: { anio: 'desc' },
      include: { marcas: true },
    })
    if (!reporte) throw new PachaError('Aún no hay reportes para tu equipo', 404)

    // Historia del mercado para el reporte general del Año 0 (los 3 años anteriores)
    let historia: { anio: number; ventasMercado: number; ventasEquipo: number; participacion: number; contribucion: number }[] | undefined
    if (reporte.anio === 0) {
      const historicos = await db.reporte.findMany({ where: { equipoId: equipo.id, anio: { lte: 0 } }, orderBy: { anio: 'asc' } })
      const aniosHistoria = [...new Set(historicos.map((r) => r.anio))].sort((a, b) => a - b)
      if (aniosHistoria.length > 0) {
        const todos = await db.reporte.findMany({ where: { anio: { in: aniosHistoria } } })
        historia = aniosHistoria.map((a) => {
          const filas = todos.filter((r) => r.anio === a)
          const ventasMercado = Math.round(filas.reduce((s, r) => s + r.ventas, 0) * 10) / 10
          const propia = filas.find((r) => r.equipoId === equipo.id)
          return {
            anio: a,
            ventasMercado,
            ventasEquipo: propia?.ventas ?? 0,
            participacion: propia?.participacion ?? 0,
            contribucion: propia?.contribucion ?? 0,
          }
        })
      }
    }

    // Detalle Bolivia: mensual, regional, finanzas, eventos e inflación (doc §13, §14, §18.11)
    const detalle = reporte.detalleJson
      ? parseJson<{
          mercado?: { demandaTotal: number; ventasEmpresas: number; ventasResto: number; capturaEmpresas: number }
          detalleMensual?: { mes: number; demandaTotal: number; ventasEmpresas: number; ventasResto: number }[]
          porRegion?: { regionId: string; ventas: number }[]
          finanzas?: Record<string, number | boolean> | null
          produccionAnio?: Record<string, number> | null
          marcasMensual?: Record<string, number[]>
          inflacion?: { anio: number; escenario: string; pi: number; factores: { factor: string; senal: number; aporte: number }[]; indicePreciosFin: number; tipoCambioFinal: number; tasasComponentes: Record<string, number> }
          eventos?: { variable: string; region: string; mes: number; eventos: { nombre: string; efecto: number; peso: number }[]; total: number }[]
        }>(reporte.detalleJson, {})
      : {}

    // Inflación histórica ejecutada (los alumnos ven el historial hasta el último
    // periodo ejecutado; no ven la del periodo en curso, doc §18.10)
    const macroHistoria = await db.macroPeriodo.findMany({
      where: { industriaId: equipo.industriaId, ejecutado: true },
      orderBy: { anio: 'asc' },
    })

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
      historia,
      detalle,
      macroHistoria: macroHistoria.map((m) => ({
        anio: m.anio,
        escenario: m.escenario,
        inflacionAnual: m.inflacionAnual,
        indicePreciosFin: m.indicePreciosFin,
        tipoCambioFinal: m.tipoCambioFinal,
        factores: parseJson<{ factor: string; senal: number; aporte: number }[]>(m.factoresJson, []),
      })),
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
